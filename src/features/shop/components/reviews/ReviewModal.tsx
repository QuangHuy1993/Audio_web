import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MdClose, MdGrade } from "react-icons/md";
import ReviewForm from "./ReviewForm";

interface ReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    productId: string;
    productName: string;
    orderId?: string;
    onSuccess: (review: any) => void;
}

export default function ReviewModal({ isOpen, onClose, productId, productName, orderId, onSuccess }: ReviewModalProps) {
    const [existingReview, setExistingReview] = useState<any>(null);
    const [isLoadingReview, setIsLoadingReview] = useState(false);

    useEffect(() => {
        if (isOpen && productId && orderId) {
            setIsLoadingReview(true);
            fetch(`/api/shop/reviews?productId=${productId}&orderId=${orderId}`)
                .then(res => res.json())
                .then(data => {
                    if (data && data.id) {
                        setExistingReview(data);
                    } else {
                        setExistingReview(null);
                    }
                })
                .catch(err => console.error("Error fetching existing review:", err))
                .finally(() => setIsLoadingReview(false));
        } else if (!isOpen) {
            setExistingReview(null);
        }
    }, [isOpen, productId, orderId]);

    return (
        <AnimatePresence>
            {isOpen && (
                <div
                    key="review-modal-portal"
                    style={{
                        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                        zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center",
                        padding: "20px"
                    }}
                >
                    {/* Premium Glassmorphism Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                            background: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(20px)",
                        }}
                        onClick={onClose}
                    />

                    {/* Modal Content - Elegant Dark Theme */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 30 }}
                        transition={{ type: "spring", damping: 25, stiffness: 350 }}
                        style={{
                            position: "relative",
                            background: "linear-gradient(135deg, rgba(30, 30, 30, 0.9) 0%, rgba(20, 20, 20, 0.95) 100%)",
                            width: "100%", maxWidth: "520px",
                            borderRadius: "28px",
                            border: "1px solid rgba(255, 255, 255, 0.08)",
                            padding: "40px",
                            boxShadow: "0 40px 100px rgba(0,0,0,0.8), inset 0 0 0 1px rgba(255,255,255,0.05)",
                            overflow: "hidden"
                        }}
                    >
                        {/* Decorative Background Element */}
                        <div style={{
                            position: "absolute", top: "-50px", right: "-50px", width: "150px", height: "150px",
                            background: "var(--color-primary, #1db954)", filter: "blur(80px)", opacity: 0.15,
                            pointerEvents: "none"
                        }} />

                        <button
                            onClick={onClose}
                            style={{
                                position: "absolute", top: 24, right: 24,
                                background: "rgba(255,255,255,0.05)", border: "none", color: "rgba(255,255,255,0.5)",
                                cursor: "pointer", width: "36px", height: "36px", borderRadius: "50%",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                transition: "all 0.2s"
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "white"; }}
                            onMouseOut={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
                        >
                            <MdClose size={20} />
                        </button>

                        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                            <div style={{
                                background: "rgba(255, 179, 64, 0.1)", padding: '8px', borderRadius: '12px', display: 'flex',
                                width: '40px', height: '40px', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <MdGrade size={24} color="#ffb340" />
                            </div>
                            <h2 style={{ fontSize: "24px", fontWeight: "800", color: "white", margin: 0, letterSpacing: "-0.5px" }}>
                                {existingReview ? "Chỉnh sửa đánh giá" : "Chia sẻ cảm nhận"}
                            </h2>
                        </div>

                        <p style={{ fontSize: "15px", color: "rgba(255, 255, 255, 0.5)", marginBottom: "32px", lineHeight: "1.6" }}>
                            Bạn đang đánh giá cho: <span style={{ color: "white", fontWeight: "600" }}>{productName}</span>
                        </p>

                        <div style={{ position: "relative", zIndex: 1 }}>
                            {isLoadingReview ? (
                                <div style={{ padding: "40px", textAlign: "center", color: "rgba(255,255,255,0.5)" }}>
                                    Đang tải thông tin đánh giá...
                                </div>
                            ) : (
                                <ReviewForm
                                    productId={productId}
                                    orderId={orderId}
                                    initialData={existingReview}
                                    onSuccess={(data) => {
                                        onSuccess(data);
                                        onClose();
                                    }}
                                    onCancel={onClose}
                                />
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
