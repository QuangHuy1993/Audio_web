import { NextResponse } from "next/server";
import { ReviewModerationStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");
    const orderId = searchParams.get("orderId");

    if (!productId || !orderId) {
        return NextResponse.json({ error: "Thiếu productId hoặc orderId" }, { status: 400 });
    }

    try {
        const review = await prisma.review.findUnique({
            where: {
                userId_productId_orderId: {
                    userId: session.user.id,
                    productId,
                    orderId
                }
            }
        });

        return NextResponse.json(review);
    } catch (error) {
        console.error("[Reviews API][GET] Error:", error);
        return NextResponse.json({ error: "Không thể kiểm tra đánh giá" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { productId, orderId, rating, comment } = body;

        // 1. Validation cơ bản
        if (!productId || !rating) {
            return NextResponse.json({ error: "Thiếu dữ liệu (productId, rating)" }, { status: 400 });
        }

        const ratingNum = Number(rating);
        if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
            return NextResponse.json({ error: "Rating phải là số từ 1 đến 5" }, { status: 400 });
        }

        // 2. Kiểm tra nếu có orderId (Verified Purchase)
        if (orderId) {
            const order = await prisma.order.findUnique({
                where: { id: orderId, userId: session.user.id },
                include: { items: true }
            });

            if (!order) {
                return NextResponse.json({ error: "Đơn hàng không tồn tại hoặc không thuộc về bạn" }, { status: 404 });
            }

            if (order.status !== "COMPLETED") {
                return NextResponse.json({ error: "Chỉ có thể đánh giá đơn hàng đã hoàn thành" }, { status: 400 });
            }

            const hasProduct = order.items.some(item => item.productId === productId);
            if (!hasProduct) {
                return NextResponse.json({ error: "Sản phẩm không có trong đơn hàng này" }, { status: 400 });
            }

            // Kiểm tra xem đã đánh giá cho đơn hàng này chưa
            const existingReview = await prisma.review.findUnique({
                where: {
                    userId_productId_orderId: {
                        userId: session.user.id,
                        productId,
                        orderId
                    }
                }
            });

            if (existingReview) {
                return NextResponse.json({ error: "Bạn đã đánh giá sản phẩm này cho đơn hàng này rồi" }, { status: 400 });
            }
        }

        // 3. Tạo review
        const review = await prisma.review.create({
            data: {
                userId: session.user.id,
                productId,
                orderId: orderId || null,
                rating: ratingNum,
                comment,
                status: ReviewModerationStatus.APPROVED,
            },
            include: {
                user: {
                    select: { name: true, image: true }
                }
            }
        });

        return NextResponse.json(review);
    } catch (error) {
        console.error("[Reviews API][POST] Error:", error);
        return NextResponse.json({ error: "Không thể tạo đánh giá" }, { status: 500 });
    }
}
