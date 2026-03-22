"use client";

import React, { useState, useEffect } from "react";
import {
    MdRateReview,
    MdStar,
    MdEdit,
    MdDelete,
    MdOpenInNew
} from "react-icons/md";
import { toast } from "sonner";
import clsx from "clsx";
import styles from "./MyReviews.module.css";
import commonStyles from "./OrderHistory.module.css";
import ReviewModal from "@/features/shop/components/reviews/ReviewModal";
import Link from "next/link";

export default function MyReviews() {
    const [reviews, setReviews] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedReview, setSelectedReview] = useState<any | null>(null);

    useEffect(() => {
        fetchReviews();
    }, []);

    const fetchReviews = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/account/reviews");
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();
            setReviews(data);
        } catch (error) {
            console.error(error);
            toast.error("Không thể tải danh sách đánh giá.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteReview = async (id: string) => {
        if (!confirm("Bạn có chắc chắn muốn xóa đánh giá này?")) return;

        try {
            const res = await fetch(`/api/shop/reviews/${id}`, { method: "DELETE" });
            if (res.ok) {
                toast.success("Đã xóa đánh giá thành công.");
                setReviews(prev => prev.filter(r => r.id !== id));
            } else {
                const data = await res.json();
                toast.error(data.error || "Không thể xóa đánh giá.");
            }
        } catch (error) {
            toast.error("Lỗi hệ thống.");
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("vi-VN", {
            day: "2-digit", month: "long", year: "numeric"
        });
    };

    return (
        <div className={styles.container}>
            <header className={commonStyles["order-history-content__header"]}>
                <h2 className={commonStyles["order-history-content__title"]}>Đánh giá của tôi</h2>
                <p className={commonStyles["order-history-content__subtitle"]}>
                    Xem và quản lý tất cả các đánh giá sản phẩm của bạn.
                </p>
            </header>

            <div className={styles.list}>
                {isLoading ? (
                    <div className={styles.loading}>Đang tải đánh giá...</div>
                ) : reviews.length === 0 ? (
                    <div className={styles.empty}>
                        <MdRateReview size={48} color="rgba(255,255,255,0.1)" />
                        <p>Bạn chưa có đánh giá nào.</p>
                        <Link href="/account/orders" className={styles.shopLink}>
                            Đến xem đơn hàng của bạn
                        </Link>
                    </div>
                ) : (
                    reviews.map(review => (
                        <div key={review.id} className={styles.card}>
                            <div className={styles.cardHeader}>
                                <div className={styles.productInfo}>
                                    <div
                                        className={styles.productImage}
                                        style={{ backgroundImage: `url(${review.product?.images?.[0]?.url || ""})` }}
                                    />
                                    <div>
                                        <h3 className={styles.productName}>{review.product?.name}</h3>
                                        <p className={styles.date}>{formatDate(review.createdAt)}</p>
                                    </div>
                                </div>
                                <div className={styles.rating}>
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <MdStar
                                            key={star}
                                            color={star <= review.rating ? "#ffb340" : "rgba(255,255,255,0.1)"}
                                            size={18}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className={styles.comment}>
                                {review.comment || (
                                    <span className={styles.noComment}>Không có nội dung bình luận.</span>
                                )}
                            </div>

                            <div className={styles.actions}>
                                <button
                                    className={styles.actionBtn}
                                    onClick={() => setSelectedReview(review)}
                                >
                                    <MdEdit size={16} />
                                    Sửa
                                </button>
                                <button
                                    className={clsx(styles.actionBtn, styles.deleteBtn)}
                                    onClick={() => handleDeleteReview(review.id)}
                                >
                                    <MdDelete size={16} />
                                    Xóa
                                </button>
                                <Link
                                    href={`/shop/product/${review.product?.id}`}
                                    className={clsx(styles.actionBtn, styles.viewBtn)}
                                >
                                    <MdOpenInNew size={16} />
                                    Xem sản phẩm
                                </Link>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {selectedReview && (
                <ReviewModal
                    isOpen={!!selectedReview}
                    onClose={() => setSelectedReview(null)}
                    productId={selectedReview.productId}
                    productName={selectedReview.product?.name || ""}
                    orderId={selectedReview.orderId}
                    onSuccess={() => {
                        fetchReviews();
                        setSelectedReview(null);
                    }}
                />
            )}
        </div>
    );
}
