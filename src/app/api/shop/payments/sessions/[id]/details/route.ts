import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBankConfig } from "@/lib/admin-settings";

export const runtime = "nodejs";

export async function GET(
    _request: NextRequest,
    context: { params: Promise<{ id: string }> },
) {
    try {
        const sessionUser = await getServerSession(authOptions);

        if (!sessionUser?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await context.params;

        const checkoutSession = await prisma.checkoutSession.findFirst({
            where: {
                id,
                userId: sessionUser.user.id,
            },
        });

        if (!checkoutSession) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        const bankConfig = await getBankConfig();

        return NextResponse.json({
            sessionId: checkoutSession.id,
            provider: checkoutSession.provider,
            status: checkoutSession.status,
            expiresAt: checkoutSession.expiresAt.toISOString(),
            amount: Number(checkoutSession.amount),
            currency: checkoutSession.currency,
            paymentUrl: checkoutSession.paymentUrl,
            providerRef: checkoutSession.providerRef,
            bankInfo: {
                bankId: bankConfig.bankId,
                bankName: `Ngân hàng ${bankConfig.bankId}`,
                accountNo: bankConfig.accountNo,
                accountName: bankConfig.accountName,
            },
        });
    } catch (error) {
        console.error("[SessionDetails][GET] Failed to fetch session details", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
