import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Yêu cầu đăng nhập để xem phiên thanh toán." },
      { status: 401 },
    );
  }

  const now = new Date();

  // @ts-expect-error CheckoutSession sẽ tồn tại sau khi prisma generate
  const pending = await prisma.checkoutSession.findFirst({
    where: {
      userId: session.user.id,
      provider: "VNPAY",
      status: "PENDING",
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!pending) {
    return NextResponse.json({ session: null }, { status: 200 });
  }

  return NextResponse.json(
    {
      session: {
        sessionId: pending.id,
        provider: pending.provider,
        status: pending.status,
        expiresAt: pending.expiresAt.toISOString(),
        amount: Number(pending.amount),
        currency: pending.currency,
        paymentUrl: pending.paymentUrl ?? null,
      },
    },
    { status: 200 },
  );
}

