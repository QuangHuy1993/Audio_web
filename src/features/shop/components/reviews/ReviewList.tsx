"use client";

import React from "react";
import Image from "next/image";
import { MdStar, MdStarOutline, MdStarHalf, MdVerified, MdEdit, MdDelete } from "react-icons/md";
import styles from "./ReviewList.module.css";

interface Review {
    id: string;
    userId: string;
    rating: number;
    comment: string | null;
    createdAt: string;
    isVerified?: boolean;
    user: {
        name: string | null;
        image: string | null;
    };
}

interface ReviewListProps {
    reviews: Review[];
    currentUserId?: string;
    onEdit?: (review: Review) => void;
    onDelete?: (reviewId: string) => void;
}

function renderStars(rating: number) {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
        if (i <= Math.floor(rating)) {
            stars.push(<MdStar key={i} className={styles.starFilled} />);
        } else if (i - rating < 1 && rating % 1 >= 0.5) {
            stars.push(<MdStarHalf key={i} className={styles.starFilled} />);
        } else {
            stars.push(<MdStarOutline key={i} className={styles.starEmpty} />);
        }
    }
    return stars;
}

function formatDate(dateString: string) {
    const d = new Date(dateString);
    return d.toLocaleDateString("vi-VN", {
        day: "2-digit", month: "long", year: "numeric"
    });
}

export default function ReviewList({ reviews, currentUserId, onEdit, onDelete }: ReviewListProps) {
    if (reviews.length === 0) {
        return (
            <div className={styles.empty}>
                <p>Chưa có đánh giá nào cho sản phẩm này.</p>
            </div>
        );
    }

    return (
        <div className={styles.list}>
            {reviews.map((review) => (
                <div key={review.id} className={styles.item}>
                    <div className={styles.header}>
                        <div className={styles.avatar}>
                            {review.user.image ? (
                                <Image
                                    src={review.user.image}
                                    alt={review.user.name || "User"}
                                    fill
                                    sizes="44px"
                                    className={styles.avatarImg}
                                />
                            ) : (
                                <span>{(review.user.name || "U").charAt(0).toUpperCase()}</span>
                            )}
                        </div>
                        <div className={styles.meta}>
                            <div className={styles.nameRow}>
                                <span className={styles.name}>{review.user.name || "Khách hàng"}</span>
                                {review.isVerified && (
                                    <span className={styles.verified} title="Người dùng đã mua hàng">
                                        <MdVerified /> Đã mua hàng
                                    </span>
                                )}
                                {currentUserId === review.userId && (
                                    <div className={styles.actions}>
                                        <button
                                            className={`${styles.actionBtn} ${styles.editBtn}`}
                                            onClick={() => onEdit?.(review)}
                                            title="Chỉnh sửa đánh giá"
                                        >
                                            <MdEdit size={16} />
                                        </button>
                                        <button
                                            className={`${styles.actionBtn} ${styles.deleteBtn}`}
                                            onClick={() => onDelete?.(review.id)}
                                            title="Xóa đánh giá"
                                        >
                                            <MdDelete size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className={styles.stars}>
                                {renderStars(review.rating)}
                            </div>
                        </div>
                        <span className={styles.date}>{formatDate(review.createdAt)}</span>
                    </div>
                    {review.comment && (
                        <p className={styles.comment}>{review.comment}</p>
                    )}
                </div>
            ))}
        </div>
    );
}
