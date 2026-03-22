import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCheckoutSessionStatus } from "@/services/checkout-session-service";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Yêu cầu đăng nhập để xem phiên thanh toán." },
      { status: 401 },
    );
  }

  const { id } = await context.params;

  if (!id || typeof id !== "string") {
    return NextResponse.json(
      { error: "Mã phiên thanh toán không hợp lệ." },
      { status: 400 },
    );
  }

  const status = await getCheckoutSessionStatus(id, session.user.id);

  if (!status) {
    return NextResponse.json(
      { error: "Không tìm thấy phiên thanh toán." },
      { status: 404 },
    );
  }

  return NextResponse.json(status, { status: 200 });
}

