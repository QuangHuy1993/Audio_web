"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MdStar, MdStarOutline } from "react-icons/md";
import { toast } from "sonner";
import styles from "./ReviewForm.module.css";

interface ReviewFormProps {
    productId: string;
    orderId?: string;
    initialData?: {
        id: string;
        rating: number;
        comment: string;
    };
    onSuccess: (review: any) => void;
    onCancel?: () => void;
}

export default function ReviewForm({ productId, orderId, initialData, onSuccess, onCancel }: ReviewFormProps) {
    const [rating, setRating] = useState(initialData?.rating || 5);
    const [comment, setComment] = useState(initialData?.comment || "");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hoverRating, setHoverRating] = useState(0);

    const isEdit = !!initialData;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const url = isEdit ? `/api/shop/reviews/${initialData.id}` : "/api/shop/reviews";
            const method = isEdit ? "PATCH" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    productId,
                    orderId,
                    rating,
                    comment
                })
            });

            const data = await res.json();

            if (!res.ok) {
                toast.error(data.error || "Có lỗi xảy ra khi gửi đánh giá");
            } else {
                toast.success(isEdit ? "Cập nhật đánh giá thành công" : "Cảm ơn bạn đã đánh giá sản phẩm!");
                onSuccess(data);
            }
        } catch (error) {
            toast.error("Lỗi kết nối máy chủ");
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form className={styles.reviewForm} onSubmit={handleSubmit}>
            <div className={styles.ratingGroup}>
                <label className={styles.label}>Chất lượng sản phẩm:</label>
                <div className={styles.stars}>
                    {[1, 2, 3, 4, 5].map((star) => (
                        <motion.button
                            key={star}
                            type="button"
                            className={styles.starBtn}
                            onClick={() => setRating(star)}
                            onMouseEnter={() => setHoverRating(star)}
                            onMouseLeave={() => setHoverRating(0)}
                            whileHover={{ scale: 1.25, rotate: 15 }}
                            whileTap={{ scale: 0.85 }}
                        >
                            {(hoverRating || rating) >= star ? (
                                <MdStar className={styles.starFilled} />
                            ) : (
                                <MdStarOutline className={styles.starEmpty} />
                            )}
                        </motion.button>
                    ))}
                    <AnimatePresence mode="wait">
                        <motion.span
                            key={rating}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            className={styles.ratingText}
                        >
                            {rating === 5 ? "Rất hài lòng" : rating === 4 ? "Hài lòng" : rating === 3 ? "Bình thường" : rating === 2 ? "Không hài lòng" : "Tệ"}
                        </motion.span>
                    </AnimatePresence>
                </div>
            </div>

            <div className={styles.inputGroup}>
                <label className={styles.label} htmlFor="comment">Chia sẻ trải nghiệm của bạn:</label>
                <textarea
                    id="comment"
                    className={styles.textarea}
                    placeholder="Hãy chia sẻ những điều bạn thích về sản phẩm này nhé..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={4}
                />
            </div>

            <div className={styles.actions}>
                {onCancel && (
                    <button type="button" className={styles.cancelBtn} onClick={onCancel} disabled={isSubmitting}>
                        Hủy
                    </button>
                )}
                <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                    {isSubmitting ? "Đang gửi..." : isEdit ? "Cập nhật" : "Gửi đánh giá"}
                </button>
            </div>
        </form>
    );
}
