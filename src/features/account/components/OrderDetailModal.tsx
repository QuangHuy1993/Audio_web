import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MdClose, MdWarning, MdInfo } from "react-icons/md";
import { toast } from "sonner";
import ReviewModal from "@/features/shop/components/reviews/ReviewModal";

interface OrderItem {
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: string | number;
    product: {
        images: { url: string }[];
    };
}

interface OrderDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: any;
    onOrderCancelled?: (orderId: string) => void;
    onOrderCompleted?: (orderId: string) => void;
}

export default function OrderDetailModal({ isOpen, onClose, order, onOrderCancelled, onOrderCompleted }: OrderDetailModalProps) {
    const [isCancelling, setIsCancelling] = useState(false);
    const [isCompleting, setIsCompleting] = useState(false);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [reviewProduct, setReviewProduct] = useState<{ id: string, name: string } | null>(null);

    if (!order) return null;
    // ... (omitted lines for brevity in instruction, but I'll provide full block below)

    const formatCurrency = (amount: number | string) => {
        return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Number(amount));
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString("vi-VN", {
            day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
        });
    };

    const handleCancelOrder = async () => {
        setIsCancelling(true);
        try {
            const res = await fetch(`/api/shop/orders/${order.id}/cancel`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason: "Người dùng tự huỷ đơn" })
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "Không thể huỷ đơn hàng lúc này.");
            } else {
                toast.success("Huỷ đơn hàng thành công.");
                setShowCancelConfirm(false);
                if (onOrderCancelled) onOrderCancelled(order.id);
                onClose();
            }
        } catch (error) {
            toast.error("Đã xảy ra lỗi hệ thống.");
            console.error(error);
        } finally {
            setIsCancelling(false);
        }
    };

    const handleCompleteOrder = async () => {
        setIsCompleting(true);
        try {
            const res = await fetch(`/api/shop/orders/${order.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "COMPLETED" })
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "Không thể cập nhật trạng thái đơn hàng.");
            } else {
                toast.success("Xác nhận đã nhận hàng thành công!");
                if (onOrderCompleted) onOrderCompleted(order.id);
            }
        } catch (error) {
            toast.error("Đã xảy ra lỗi hệ thống.");
            console.error(error);
        } finally {
            setIsCompleting(false);
        }
    };

    const canCancel = order.status === "PENDING" && (Date.now() - new Date(order.createdAt).getTime()) <= 24 * 60 * 60 * 1000;

    return (
        <AnimatePresence>
            {isOpen && (
                <div
                    key="order-detail-modal-root"
                    style={{
                        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                        zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
                        padding: "20px"
                    }}
                >
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                            background: "rgba(0, 0, 0, 0.7)", backdropFilter: "blur(4px)"
                        }}
                        onClick={onClose}
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        style={{
                            position: "relative",
                            background: "var(--color-surface, #1e1e1e)",
                            width: "100%", maxWidth: "600px",
                            maxHeight: "90vh",
                            borderRadius: "16px",
                            boxShadow: "0 24px 48px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)",
                            display: "flex", flexDirection: "column",
                            overflow: "hidden"
                        }}
                    >
                        {/* Header */}
                        <div style={{
                            padding: "20px 24px",
                            borderBottom: "1px solid rgba(255,255,255,0.05)",
                            display: "flex", justifyContent: "space-between", alignItems: "center"
                        }}>
                            <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "600" }}>Chi tiết đơn hàng</h2>
                            <button
                                onClick={onClose}
                                style={{
                                    background: "transparent", border: "none", color: "var(--color-text-secondary)",
                                    cursor: "pointer", padding: "4px", display: "flex", alignItems: "center", justifyContent: "center",
                                    borderRadius: "50%", transition: "background 0.2s"
                                }}
                            >
                                <MdClose size={24} />
                            </button>
                        </div>

                        {/* Body - Scrollable */}
                        <div style={{ padding: "24px", overflowY: "auto", flex: 1 }}>

                            {/* Order Info */}
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "24px" }}>
                                <div>
                                    <p style={{ color: "var(--color-text-secondary)", fontSize: "14px", marginBottom: "4px" }}>Mã đơn hàng</p>
                                    <p style={{ fontWeight: "600", fontSize: "16px", letterSpacing: "0.5px" }}>{order.orderNumber}</p>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                    <p style={{ color: "var(--color-text-secondary)", fontSize: "14px", marginBottom: "4px" }}>Thời gian đặt</p>
                                    <p style={{ fontSize: "15px" }}>{formatDate(order.createdAt)}</p>
                                </div>
                            </div>

                            {/* Status and Payment */}
                            <div style={{ display: "flex", gap: "12px", marginBottom: "32px", flexWrap: "wrap" }}>
                                <span style={{
                                    padding: "6px 12px", borderRadius: "20px", fontSize: "13px", fontWeight: "500",
                                    background: order.status === "COMPLETED" ? "rgba(29, 185, 84, 0.15)" : order.status === "CANCELLED" ? "rgba(255, 75, 75, 0.15)" : "rgba(255, 179, 64, 0.15)",
                                    color: order.status === "COMPLETED" ? "var(--color-primary)" : order.status === "CANCELLED" ? "#ff4b4b" : "#ffb340",
                                }}>
                                    {order.status === "PENDING" ? "Chờ thanh toán" : order.status === "PAID" ? "Đã thanh toán" : order.status === "SHIPPED" ? "Đang giao" : order.status === "COMPLETED" ? "Đã hoàn thành" : "Đã huỷ"}
                                </span>
                                <span style={{
                                    padding: "6px 12px", borderRadius: "20px", fontSize: "13px", fontWeight: "500",
                                    background: "rgba(255,255,255,0.05)", color: "var(--color-text-secondary)",
                                    border: "1px solid rgba(255,255,255,0.1)"
                                }}>
                                    Thanh toán: {order.paymentProvider === "COD" ? "Thanh toán khi nhận hàng (COD)" : order.paymentProvider === "QR_TRANSFER" ? "Chuyển khoản VietQR" : "Thẻ trực tuyến"}
                                </span>
                            </div>

                            {/* Items */}
                            <h3 style={{ fontSize: "16px", marginBottom: "16px", fontWeight: "600" }}>Sản phẩm</h3>
                            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "32px" }}>
                                {order.items.map((item: OrderItem) => (
                                    <div key={item.id} style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                                        <div style={{
                                            width: "60px", height: "60px", borderRadius: "8px", background: "rgba(255,255,255,0.05)",
                                            backgroundImage: `url(${item.product?.images?.[0]?.url || ''})`, backgroundSize: "cover", backgroundPosition: "center"
                                        }} />
                                        <div style={{ flex: 1 }}>
                                            <p style={{ fontWeight: "500", fontSize: "15px", marginBottom: "4px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.productName}</p>
                                            <p style={{ color: "var(--color-text-secondary)", fontSize: "14px" }}>Số lượng: {item.quantity}</p>
                                            {order.status === "COMPLETED" && (
                                                <button
                                                    onClick={() => setReviewProduct({ id: item.productId, name: item.productName })}
                                                    style={{
                                                        padding: "4px 12px", borderRadius: "6px", border: "1px solid var(--color-primary)",
                                                        background: "transparent", color: "var(--color-primary)", fontSize: "11px",
                                                        fontWeight: "600", cursor: "pointer", marginTop: "8px", transition: "all 0.2s"
                                                    }}
                                                >
                                                    Đánh giá sản phẩm
                                                </button>
                                            )}
                                        </div>
                                        <p style={{ fontWeight: "600" }}>{formatCurrency(Number(item.unitPrice) * item.quantity)}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Summary */}
                            <div style={{ borderTop: "1px dashed rgba(255,255,255,0.1)", paddingTop: "20px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", color: "var(--color-text-secondary)" }}>
                                    <span>Tạm tính</span>
                                    <span>{formatCurrency(Number(order.totalAmount) - Number(order.shippingFee || 0) + Number(order.couponDiscount || 0))}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", color: "var(--color-text-secondary)" }}>
                                    <span>Phí giao hàng</span>
                                    <span>{formatCurrency(order.shippingFee || 0)}</span>
                                </div>
                                {Number(order.couponDiscount) > 0 && (
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", color: "var(--color-primary)" }}>
                                        <span>Giảm giá voucher</span>
                                        <span>-{formatCurrency(order.couponDiscount)}</span>
                                    </div>
                                )}
                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "16px", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                                    <span style={{ fontSize: "18px", fontWeight: "600" }}>Tổng cộng</span>
                                    <span style={{ fontSize: "20px", fontWeight: "700", color: "white" }}>{formatCurrency(order.totalAmount)}</span>
                                </div>
                            </div>

                        </div>

                        {/* Footer / Actions */}
                        <div style={{
                            padding: "20px 24px", background: "rgba(0,0,0,0.2)",
                            borderTop: "1px solid rgba(255,255,255,0.05)",
                            display: "flex", justifyContent: "flex-end", gap: "12px"
                        }}>
                            {canCancel && !showCancelConfirm && (
                                <button
                                    onClick={() => setShowCancelConfirm(true)}
                                    style={{
                                        padding: "10px 20px", borderRadius: "8px", border: "1px solid rgba(255,75,75,0.5)",
                                        background: "transparent", color: "#ff4b4b", fontWeight: "600", cursor: "pointer",
                                        transition: "all 0.2s"
                                    }}
                                >
                                    Huỷ đơn hàng
                                </button>
                            )}

                            {showCancelConfirm && (
                                <div style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%", justifyContent: "space-between" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#ff4b4b", fontSize: "14px" }}>
                                        <MdWarning size={18} />
                                        <span>Bạn chắc chắn muốn huỷ đơn này?</span>
                                    </div>
                                    <div style={{ display: "flex", gap: "8px" }}>
                                        <button
                                            onClick={() => setShowCancelConfirm(false)}
                                            disabled={isCancelling}
                                            style={{
                                                padding: "8px 16px", borderRadius: "8px", border: "none",
                                                background: "rgba(255,255,255,0.1)", color: "white", cursor: "pointer"
                                            }}
                                        >
                                            Không
                                        </button>
                                        <button
                                            onClick={handleCancelOrder}
                                            disabled={isCancelling}
                                            style={{
                                                padding: "8px 16px", borderRadius: "8px", border: "none",
                                                background: "#ff4b4b", color: "white", fontWeight: "600", cursor: "pointer",
                                                opacity: isCancelling ? 0.7 : 1
                                            }}
                                        >
                                            {isCancelling ? "Đang xử lý..." : "Xác nhận huỷ"}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {order.status === "SHIPPED" && (
                                <button
                                    onClick={handleCompleteOrder}
                                    disabled={isCompleting}
                                    style={{
                                        padding: "10px 20px", borderRadius: "8px", border: "none",
                                        background: "var(--color-primary)", color: "white", fontWeight: "600", cursor: "pointer",
                                        transition: "all 0.2s", opacity: isCompleting ? 0.7 : 1
                                    }}
                                >
                                    {isCompleting ? "Đang xử lý..." : "Đã nhận hàng"}
                                </button>
                            )}

                            {!showCancelConfirm && (
                                <button
                                    onClick={onClose}
                                    style={{
                                        padding: "10px 24px", borderRadius: "8px", border: "none",
                                        background: "var(--color-primary)", color: "white", fontWeight: "600", cursor: "pointer"
                                    }}
                                >
                                    Đóng
                                </button>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}

            <ReviewModal
                key="order-review-modal"
                isOpen={!!reviewProduct}
                onClose={() => setReviewProduct(null)}
                productId={reviewProduct?.id || ""}
                productName={reviewProduct?.name || ""}
                orderId={order.id}
                onSuccess={() => {
                    toast.success("Đánh giá của bạn đã được ghi nhận!");
                }}
            />
        </AnimatePresence>
    );
}
