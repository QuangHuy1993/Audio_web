import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  AddressServiceError,
  deleteAddress,
  updateAddress,
} from "@/services/address-service";
import type { UpsertAddressRequestDto } from "@/types/order";

export const runtime = "nodejs";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let body: UpsertAddressRequestDto;
  try {
    body = (await request.json()) as UpsertAddressRequestDto;
  } catch {
    return NextResponse.json(
      { error: "Dữ liệu gửi lên không hợp lệ." },
      { status: 400 },
    );
  }

  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: "Địa chỉ không hợp lệ." },
      { status: 400 },
    );
  }

  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Yêu cầu đăng nhập để cập nhật địa chỉ giao hàng." },
      { status: 401 },
    );
  }

  if (!body.fullName?.trim()) {
    return NextResponse.json(
      { error: "Vui lòng nhập họ tên người nhận." },
      { status: 400 },
    );
  }

  if (!body.phone?.trim()) {
    return NextResponse.json(
      { error: "Vui lòng nhập số điện thoại người nhận." },
      { status: 400 },
    );
  }

  if (!body.line1?.trim()) {
    return NextResponse.json(
      { error: "Vui lòng nhập địa chỉ chi tiết (số nhà, tên đường)." },
      { status: 400 },
    );
  }

  if (!body.district?.trim() || !body.province?.trim()) {
    return NextResponse.json(
      { error: "Vui lòng chọn quận/huyện và tỉnh/thành phố." },
      { status: 400 },
    );
  }

  try {
    const updated = await updateAddress(session.user.id, id, body);
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AddressServiceError) {
      const status =
        error.code === "ADDRESS_NOT_FOUND"
          ? 404
          : error.code === "FORBIDDEN"
            ? 403
            : 400;

      return NextResponse.json({ error: error.message }, { status });
    }

    console.error("[Addresses][PUT] Failed to update address", error, {
      url: request.url,
    });

    return NextResponse.json(
      { error: "Không thể cập nhật địa chỉ. Vui lòng thử lại sau." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: "Địa chỉ không hợp lệ." },
      { status: 400 },
    );
  }

  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Yêu cầu đăng nhập để xóa địa chỉ giao hàng." },
      { status: 401 },
    );
  }

  try {
    await deleteAddress(session.user.id, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AddressServiceError) {
      const status =
        error.code === "ADDRESS_NOT_FOUND"
          ? 404
          : error.code === "FORBIDDEN"
            ? 403
            : 400;

      return NextResponse.json({ error: error.message }, { status });
    }

    console.error("[Addresses][DELETE] Failed to delete address", error, {
      url: request.url,
    });

    return NextResponse.json(
      { error: "Không thể xóa địa chỉ. Vui lòng thử lại sau." },
      { status: 500 },
    );
  }
}

