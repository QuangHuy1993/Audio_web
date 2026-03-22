import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    try {
        const body = await request.json();
        const { rating, comment } = body;

        const review = await prisma.review.findUnique({
            where: { id }
        });

        if (!review) {
            return NextResponse.json({ error: "Đánh giá không tồn tại" }, { status: 404 });
        }

        if (review.userId !== session.user.id) {
            return NextResponse.json({ error: "Bạn không có quyền chỉnh sửa đánh giá này" }, { status: 403 });
        }

        const data: any = {};
        if (rating !== undefined) {
            const ratingNum = Number(rating);
            if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
                return NextResponse.json({ error: "Rating phải từ 1 đến 5" }, { status: 400 });
            }
            data.rating = ratingNum;
        }
        if (comment !== undefined) {
            data.comment = comment;
        }

        const updatedReview = await prisma.review.update({
            where: { id },
            data,
            include: {
                user: {
                    select: { name: true, image: true }
                }
            }
        });

        return NextResponse.json(updatedReview);
    } catch (error) {
        console.error("[Reviews API][PATCH] Error:", error);
        return NextResponse.json({ error: "Không thể cập nhật đánh giá" }, { status: 500 });
    }
}

export async function DELETE(
    _request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    try {
        const review = await prisma.review.findUnique({
            where: { id },
            select: { userId: true }
        });

        if (!review) {
            return NextResponse.json({ error: "Đánh giá không tồn tại" }, { status: 404 });
        }

        // Chỉ cho phép chủ sở hữu đánh giá xóa (hoặc Admin)
        if (review.userId !== session.user.id && session.user.role !== "ADMIN") {
            return NextResponse.json({ error: "Bạn không có quyền xóa đánh giá này" }, { status: 403 });
        }

        await prisma.review.delete({
            where: { id }
        });

        return NextResponse.json({ message: "Đã xóa đánh giá thành công" });
    } catch (error) {
        console.error("[Reviews API][DELETE] Error:", error);
        return NextResponse.json({ error: "Không thể xóa đánh giá" }, { status: 500 });
    }
}
