import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();

    // Lazy sweep: mọi session pending quá hạn của user sẽ được chuyển EXPIRED.
    await prisma.checkoutSession.updateMany({
      where: {
        userId: session.user.id,
        status: "PENDING",
        expiresAt: { lt: now },
      },
      data: {
        status: "EXPIRED",
      },
    });

    const activeSession = await prisma.checkoutSession.findFirst({
      where: {
        userId: session.user.id,
        status: "PENDING",
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        provider: true,
        status: true,
        expiresAt: true,
        amount: true,
        currency: true,
        paymentUrl: true,
      },
    });

    if (!activeSession) {
      return NextResponse.json(null);
    }

    return NextResponse.json({
      id: activeSession.id,
      provider: activeSession.provider,
      status: activeSession.status,
      expiresAt: activeSession.expiresAt.toISOString(),
      amount: Number(activeSession.amount),
      currency: activeSession.currency,
      paymentUrl: activeSession.paymentUrl,
    });
  } catch (error) {
    console.error("[SessionActive][GET] Failed to check active session", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
