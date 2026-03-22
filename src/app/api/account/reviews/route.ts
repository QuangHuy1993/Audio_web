import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const reviews = await prisma.review.findMany({
            where: { userId: session.user.id },
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        images: {
                            where: { isPrimary: true },
                            take: 1
                        }
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json(reviews);
    } catch (error) {
        console.error("[Account Reviews API] Error:", error);
        return NextResponse.json({ error: "Không thể tải danh sách đánh giá" }, { status: 500 });
    }
}
