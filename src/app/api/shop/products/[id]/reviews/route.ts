import { NextResponse } from "next/server";
import { ReviewModerationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
    _request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const { id: productId } = await context.params;

    try {
        const reviews = await prisma.review.findMany({
            where: { productId, status: ReviewModerationStatus.APPROVED },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        image: true
                    }
                },
                order: {
                    select: {
                        id: true
                    }
                }
            },
            orderBy: {
                createdAt: "desc"
            }
        });

        const ratingGroups = await prisma.review.groupBy({
            by: ["rating"],
            where: { productId, status: ReviewModerationStatus.APPROVED },
            _count: { rating: true },
        });

        const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        let ratingSum = 0;
        let totalReviews = 0;

        for (const group of ratingGroups) {
            distribution[group.rating] = group._count.rating;
            ratingSum += group.rating * group._count.rating;
            totalReviews += group._count.rating;
        }

        const averageRating = totalReviews > 0 ? Math.round((ratingSum / totalReviews) * 10) / 10 : 0;

        return NextResponse.json({
            reviews: reviews.map((r) => ({
                ...r,
                isVerified: !!r.orderId
            })),
            stats: {
                averageRating,
                totalReviews,
                distribution
            }
        });
    } catch (error) {
        console.error("[Product Reviews API][GET] Error:", error);
        return NextResponse.json({ error: "Không thể lấy danh sách đánh giá" }, { status: 500 });
    }
}
