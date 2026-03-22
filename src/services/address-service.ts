import { prisma } from "@/lib/prisma";
import type { AddressDto, UpsertAddressRequestDto } from "@/types/order";
import { resolveGhnDistrictAndWard } from "@/services/ghn-masterdata-service";

export type AddressServiceErrorCode =
  | "ADDRESS_NOT_FOUND"
  | "FORBIDDEN"
  | "ADDRESS_LIMIT_REACHED";

export class AddressServiceError extends Error {
  code: AddressServiceErrorCode;

  constructor(code: AddressServiceErrorCode, message?: string) {
    super(message ?? code);
    this.name = "AddressServiceError";
    this.code = code;
  }
}

function mapAddressToDto(address: {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  ward: string | null;
  district: string | null;
  province: string | null;
  country: string;
  postalCode: string | null;
  isDefault: boolean;
  ghnDistrictId: number | null;
  ghnWardCode: string | null;
}): AddressDto {
  return {
    id: address.id,
    fullName: address.fullName,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2,
    ward: address.ward,
    district: address.district ?? "",
    province: address.province ?? "",
    country: address.country,
    postalCode: address.postalCode,
    isDefault: address.isDefault,
    ghnDistrictId: address.ghnDistrictId,
    ghnWardCode: address.ghnWardCode,
  };
}

export async function getAddressesByUser(
  userId: string,
): Promise<AddressDto[]> {
  const addresses = await prisma.address.findMany({
    where: { userId },
    orderBy: [
      { isDefault: "desc" },
      { createdAt: "asc" },
    ],
  });

  const enriched = await Promise.all(
    addresses.map(async (address) => {
      if (
        (!address.ghnDistrictId || !address.ghnWardCode) &&
        address.district &&
        address.province
      ) {
        try {
          const ghn = await resolveGhnDistrictAndWard({
            districtName: address.district,
            wardName: address.ward,
            provinceName: address.province,
          });

          if (ghn) {
            const updated = await prisma.address.update({
              where: { id: address.id },
              data: {
                ghnDistrictId: ghn.ghnDistrictId,
                ghnWardCode: ghn.ghnWardCode,
              },
            });
            return updated;
          }
        } catch {
          // giữ im lặng nếu enrich thất bại, không chặn luồng lấy địa chỉ
        }
      }

      return address;
    }),
  );

  return enriched.map(mapAddressToDto);
}

export async function createAddress(
  userId: string,
  payload: UpsertAddressRequestDto,
): Promise<AddressDto> {
  const existingCount = await prisma.address.count({
    where: { userId },
  });

  if (existingCount >= 4) {
    throw new AddressServiceError(
      "ADDRESS_LIMIT_REACHED",
      "Bạn chỉ được lưu tối đa 4 địa chỉ giao hàng.",
    );
  }

  const shouldBeDefault =
    payload.isDefault === true || existingCount === 0;

  if (shouldBeDefault && existingCount > 0) {
    await prisma.address.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  // eslint-disable-next-line no-console
  console.log("[AddressService][createAddress] resolve GHN input", {
    districtName: payload.district,
    wardName: payload.ward,
    provinceName: payload.province,
  });

  const ghn = await resolveGhnDistrictAndWard({
    districtName: payload.district,
    wardName: payload.ward,
    provinceName: payload.province,
  });

  // eslint-disable-next-line no-console
  console.log("[AddressService][createAddress] resolve GHN result", {
    ghn,
  });

  const created = await prisma.address.create({
    data: {
      userId,
      fullName: payload.fullName.trim(),
      phone: payload.phone.trim(),
      line1: payload.line1.trim(),
      line2: payload.line2?.trim() ?? null,
      ward: payload.ward?.trim() ?? null,
      district: payload.district.trim(),
      province: payload.province.trim(),
      postalCode: payload.postalCode?.trim() ?? null,
      isDefault: shouldBeDefault,
      ghnDistrictId: ghn?.ghnDistrictId ?? null,
      ghnWardCode: ghn?.ghnWardCode ?? null,
    },
  });

  // eslint-disable-next-line no-console
  console.log("[AddressService][createAddress] created prisma row", {
    id: created.id,
    ghnDistrictId: created.ghnDistrictId,
    ghnWardCode: created.ghnWardCode,
    district: created.district,
    province: created.province,
    ward: created.ward,
  });

  return mapAddressToDto(created);
}

export async function updateAddress(
  userId: string,
  addressId: string,
  payload: UpsertAddressRequestDto,
): Promise<AddressDto> {
  const address = await prisma.address.findUnique({
    where: { id: addressId },
  });

  if (!address) {
    throw new AddressServiceError(
      "ADDRESS_NOT_FOUND",
      "Không tìm thấy địa chỉ giao hàng.",
    );
  }

  if (address.userId !== userId) {
    throw new AddressServiceError(
      "FORBIDDEN",
      "Bạn không có quyền chỉnh sửa địa chỉ này.",
    );
  }

  const shouldBeDefault = payload.isDefault === true;

  if (shouldBeDefault) {
    await prisma.address.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const districtChanged =
    payload.district.trim() !== (address.district ?? "");
  const wardChanged = (payload.ward ?? "").trim() !== (address.ward ?? "");
  const provinceChanged =
    payload.province.trim() !== (address.province ?? "");

  let nextGhnDistrictId = address.ghnDistrictId;
  let nextGhnWardCode = address.ghnWardCode;

  if (
    !address.ghnDistrictId ||
    !address.ghnWardCode ||
    districtChanged ||
    wardChanged ||
    provinceChanged
  ) {
    const ghn = await resolveGhnDistrictAndWard({
      districtName: payload.district,
      wardName: payload.ward,
      provinceName: payload.province,
    });

    if (ghn) {
      nextGhnDistrictId = ghn.ghnDistrictId;
      nextGhnWardCode = ghn.ghnWardCode;
    }
  }

  const updated = await prisma.address.update({
    where: { id: addressId },
    data: {
      fullName: payload.fullName.trim(),
      phone: payload.phone.trim(),
      line1: payload.line1.trim(),
      line2: payload.line2?.trim() ?? null,
      ward: payload.ward?.trim() ?? null,
      district: payload.district.trim(),
      province: payload.province.trim(),
      postalCode: payload.postalCode?.trim() ?? null,
      isDefault: shouldBeDefault
        ? true
        : address.isDefault && payload.isDefault === false
          ? false
          : address.isDefault,
      ghnDistrictId: nextGhnDistrictId,
      ghnWardCode: nextGhnWardCode,
    },
  });

  return mapAddressToDto(updated);
}

export async function deleteAddress(
  userId: string,
  addressId: string,
): Promise<void> {
  const address = await prisma.address.findUnique({
    where: { id: addressId },
    select: {
      id: true,
      userId: true,
      isDefault: true,
    },
  });

  if (!address) {
    throw new AddressServiceError(
      "ADDRESS_NOT_FOUND",
      "Không tìm thấy địa chỉ giao hàng.",
    );
  }

  if (address.userId !== userId) {
    throw new AddressServiceError(
      "FORBIDDEN",
      "Bạn không có quyền xóa địa chỉ này.",
    );
  }

  await prisma.address.delete({
    where: { id: addressId },
  });

  if (address.isDefault) {
    const next = await prisma.address.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });

    if (next) {
      await prisma.address.update({
        where: { id: next.id },
        data: { isDefault: true },
      });
    }
  }
}

export async function updateAllUserPhones(userId: string, phone: string): Promise<void> {
  await prisma.address.updateMany({
    where: { userId },
    data: { phone: phone.trim() },
  });
}
