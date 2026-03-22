import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret) {
    const authorization = request.headers.get("authorization")?.trim() ?? "";
    if (authorization !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    // Dev fallback: cho phép chạy endpoint khi chưa cấu hình CRON_SECRET.
    console.warn(
      "[Cron][ExpireCheckoutSessions] CRON_SECRET is not configured. Running in dev fallback mode.",
    );
  }

  try {
    const now = new Date();
    const result = await prisma.checkoutSession.updateMany({
      where: {
        status: "PENDING",
        expiresAt: { lt: now },
      },
      data: {
        status: "EXPIRED",
      },
    });

    console.info(
      `[Cron][ExpireCheckoutSessions] Expired ${result.count} sessions at ${now.toISOString()}`,
    );

    return NextResponse.json({ expired: result.count });
  } catch (error) {
    console.error("[Cron][ExpireCheckoutSessions] Failed to expire sessions", error);
    return NextResponse.json(
      { error: "Không thể dọn dẹp phiên thanh toán hết hạn." },
      { status: 500 },
    );
  }
}
