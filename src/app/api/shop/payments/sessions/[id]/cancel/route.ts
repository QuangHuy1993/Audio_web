import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(
    _request: NextRequest,
    context: { params: Promise<{ id: string }> },
) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await context.params;

        const existingSession = await prisma.checkoutSession.findFirst({
            where: {
                id,
                userId: session.user.id,
            },
        });

        if (!existingSession) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        if (existingSession.status !== "PENDING") {
            return NextResponse.json(
                { error: "Session is not pending" },
                { status: 400 }
            );
        }

        await prisma.checkoutSession.update({
            where: { id },
            data: { status: "CANCELLED" },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[SessionCancel][POST] Failed to cancel session", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
