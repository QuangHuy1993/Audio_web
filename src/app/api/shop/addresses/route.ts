import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  AddressServiceError,
  createAddress,
  getAddressesByUser,
} from "@/services/address-service";
import type { UpsertAddressRequestDto } from "@/types/order";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Yêu cầu đăng nhập để xem địa chỉ giao hàng." },
        { status: 401 },
      );
    }

    const addresses = await getAddressesByUser(session.user.id);

    return NextResponse.json(addresses);
  } catch (error) {
    console.error("[Addresses][GET] Failed to load addresses", error, {
      url: request.url,
    });

    return NextResponse.json(
      { error: "Không thể tải danh sách địa chỉ. Vui lòng thử lại sau." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  let body: UpsertAddressRequestDto;
  try {
    body = (await request.json()) as UpsertAddressRequestDto;
  } catch {
    return NextResponse.json(
      { error: "Dữ liệu gửi lên không hợp lệ." },
      { status: 400 },
    );
  }

  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Yêu cầu đăng nhập để thêm địa chỉ giao hàng." },
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
    // eslint-disable-next-line no-console
    console.log("[Addresses][POST] incoming body", {
      body,
      userId: session.user.id,
    });

    const created = await createAddress(session.user.id, body);
    // eslint-disable-next-line no-console
    console.log("[Addresses][POST] created address dto", created);

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof AddressServiceError) {
      if (error.code === "ADDRESS_LIMIT_REACHED") {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("[Addresses][POST] Failed to create address", error, {
      url: request.url,
    });

    return NextResponse.json(
      { error: "Không thể thêm địa chỉ mới. Vui lòng thử lại sau." },
      { status: 500 },
    );
  }
}

