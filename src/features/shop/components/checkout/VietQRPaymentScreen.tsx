"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
    HiOutlineClipboardCheck,
    HiOutlineClipboard,
    HiOutlineClock,
    HiChevronLeft,
    HiOutlineRefresh,
} from "react-icons/hi";
import { toast } from "sonner";
import styles from "./VietQRPaymentScreen.module.css";

interface BankInfo {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    transferNote: string;
}

interface OrderSummary {
    items: { id: string; name: string; quantity: number; price: number; imageUrl: string }[];
    subtotal: number;
    shippingFee: number;
    discountAmount: number;
    shippingDiscount: number;
    total: number;
}

interface VietQRPaymentScreenProps {
    sessionId: string;                        // để polling status
    orderNumber: string;
    amount: number;
    qrImageUrl: string;
    bankInfo: BankInfo;
    expiresAt: string;
    orderSummary: OrderSummary;
    onPaymentSuccess: (orderId: string) => void;  // auto-confirm khi SePay webhook vào
    onCancel: () => void;
}

export const VietQRPaymentScreen: React.FC<VietQRPaymentScreenProps> = ({
    sessionId,
    orderNumber,
    amount,
    qrImageUrl,
    bankInfo,
    expiresAt,
    orderSummary,
    onPaymentSuccess,
    onCancel,
}) => {
    const [timeLeft, setTimeLeft] = useState<string>("");
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [isExpired, setIsExpired] = useState(false);

    // ── COUNTDOWN TIMER ──
    useEffect(() => {
        const targetDate = new Date(expiresAt).getTime();

        const interval = setInterval(() => {
            const now = new Date().getTime();
            const distance = targetDate - now;

            if (distance < 0) {
                clearInterval(interval);
                setTimeLeft("Hết hạn");
                setIsExpired(true);
                return;
            }

            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);
            setTimeLeft(`${minutes}:${seconds < 10 ? "0" : ""}${seconds}`);
        }, 1000);

        return () => clearInterval(interval);
    }, [expiresAt]);

    // ── POLLING SESSION STATUS mỗi 3 giây ──
    useEffect(() => {
        if (!sessionId) return;

        let stopped = false;
        let pollCount = 0;
        const MAX_POLLS = 600; // 600 × 3s = 30 phút

        const poll = async () => {
            if (stopped || pollCount >= MAX_POLLS) return;
            pollCount++;

            try {
                const res = await fetch(`/api/shop/payments/sessions/${sessionId}/status`);
                if (!res.ok) return; // network error, thử lại lần sau

                const data = await res.json() as { status: string; orderId?: string | null };

                if (data.status === "SUCCEEDED" && data.orderId) {
                    stopped = true;
                    toast.success("🎉 Thanh toán thành công! Đang chuyển hướng...");
                    onPaymentSuccess(data.orderId);
                    return;
                }

                if (["FAILED", "EXPIRED", "CANCELLED"].includes(data.status)) {
                    stopped = true;
                    toast.error("Phiên thanh toán đã kết thúc. Vui lòng thử lại.");
                    onCancel();
                }
            } catch {
                // ignore, tiếp tục poll
            }
        };

        void poll(); // poll ngay lần đầu
        const timer = setInterval(() => void poll(), 3000);

        return () => {
            stopped = true;
            clearInterval(timer);
        };
    }, [sessionId, onPaymentSuccess, onCancel]);

    const copyToClipboard = (text: string, field: string) => {
        navigator.clipboard.writeText(text).catch(() => null);
        setCopiedField(field);
        toast.success(`Đã sao chép ${field}`);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat("vi-VN", {
            style: "currency",
            currency: "VND",
        }).format(val);
    };

    return (
        <div className={styles["vietqr-screen"]}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={styles["vietqr-card"]}
            >
                {/* Header Information */}
                {/* <div className={styles["amount-section"]}>
                    <p className={styles["amount-label"]}>Số tiền cần thanh toán</p>
                    <h2 className={styles["amount-value"]}>{formatCurrency(amount)}</h2>
                </div> */}

                <div className={styles["layout-grid"]}>
                    {/* Left Column: Order Summary */}
                    <div className={styles["order-summary-column"]}>
                        <h3 className={styles["order-summary-title"]}>Chi tiết đơn hàng</h3>

                        <div className={styles["order-items-list"]}>
                            {orderSummary.items.map((item) => (
                                <div key={item.id} className={styles["order-item"]}>
                                    <div className={styles["order-item-image"]}>
                                        {item.imageUrl ? (
                                            <Image src={item.imageUrl} alt={item.name} width={48} height={48} className={styles["order-item-img"]} />
                                        ) : (
                                            <div className={styles["order-item-placeholder"]} />
                                        )}
                                    </div>
                                    <div className={styles["order-item-details"]}>
                                        <p className={styles["order-item-name"]}>{item.name}</p>
                                        <p className={styles["order-item-price-qty"]}>
                                            {formatCurrency(item.price)} x {item.quantity}
                                        </p>
                                    </div>
                                    <div className={styles["order-item-total"]}>
                                        {formatCurrency(item.price * item.quantity)}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className={styles["order-summary-totals"]}>
                            <div className={styles["totals-row"]}>
                                <span>Tạm tính</span>
                                <span>{formatCurrency(orderSummary.subtotal)}</span>
                            </div>
                            <div className={styles["totals-row"]}>
                                <span>Phí vận chuyển</span>
                                <span>{formatCurrency(orderSummary.shippingFee)}</span>
                            </div>
                            {orderSummary.discountAmount > 0 && (
                                <div className={`${styles["totals-row"]} ${styles["totals-row--discount"]}`}>
                                    <span>Giảm giá</span>
                                    <span>-{formatCurrency(orderSummary.discountAmount)}</span>
                                </div>
                            )}
                            {orderSummary.shippingDiscount > 0 && (
                                <div className={`${styles["totals-row"]} ${styles["totals-row--discount"]}`}>
                                    <span>Giảm phí ship</span>
                                    <span>-{formatCurrency(orderSummary.shippingDiscount)}</span>
                                </div>
                            )}
                            <div className={`${styles["totals-row"]} ${styles["totals-row--final"]}`}>
                                <span>Tổng cộng</span>
                                <span className={styles["amount-value"]}>{formatCurrency(orderSummary.total)}</span>
                            </div>
                        </div>

                        {/* Order ref */}
                        {orderNumber && (
                            <div className={styles["order-ref"]}>
                                Mã tham chiếu: <code>{orderNumber}</code>
                            </div>
                        )}
                        <div className={styles["actions"]}>
                            <button onClick={onCancel} className={styles["cancel-button"]}>
                                <HiChevronLeft style={{ marginRight: "4px", verticalAlign: "middle" }} />
                                Chọn phương thức khác
                            </button>
                        </div>
                    </div>

                    {/* Right Column: QR Payment Content */}
                    <div className={styles["qr-column"]}>
                        <div className={styles["amount-section"]}>
                            <p className={styles["amount-label"]}>Quét mã để thanh toán</p>
                        </div>

                        {/* QR Section */}
                        <div className={styles["qr-container"]}>
                            <div className={styles["scanline"]} />
                            <Image
                                src={qrImageUrl}
                                alt="VietQR Payment"
                                width={300}
                                height={300}
                                className={styles["qr-image"]}
                                priority
                            />
                        </div>

                        {/* Expiration Timer */}
                        <div className={styles["timer"]} style={{ color: isExpired ? "var(--error)" : undefined }}>
                            <HiOutlineClock className={styles["timer-icon"]} />
                            <span>Mã QR hết hạn sau: <strong>{timeLeft}</strong></span>
                        </div>

                        {/* Bank & Transfer Info */}
                        <div className={styles["info-grid"]}>
                            <div className={styles["info-item"]}>
                                <span className={styles["info-item__label"]}>Ngân hàng</span>
                                <span className={styles["info-item__value"]}>{bankInfo.bankName}</span>
                            </div>

                            <div className={styles["info-item"]}>
                                <span className={styles["info-item__label"]}>Số tài khoản</span>
                                <div className={styles["info-item__value"]}>
                                    {bankInfo.accountNumber}
                                    <button
                                        onClick={() => copyToClipboard(bankInfo.accountNumber, "số tài khoản")}
                                        className={styles["copy-button"]}
                                        title="Sao chép số tài khoản"
                                    >
                                        {copiedField === "số tài khoản" ? <HiOutlineClipboardCheck /> : <HiOutlineClipboard />}
                                    </button>
                                </div>
                            </div>

                            <div className={styles["info-item"]}>
                                <span className={styles["info-item__label"]}>Chủ tài khoản</span>
                                <span className={styles["info-item__value"]}>{bankInfo.accountHolder}</span>
                            </div>

                            <div className={styles["info-item"]}>
                                <span className={styles["info-item__label"]}>Nội dung chuyển khoản</span>
                                <div className={styles["info-item__value"]}>
                                    <strong>{bankInfo.transferNote}</strong>
                                    <button
                                        onClick={() => copyToClipboard(bankInfo.transferNote, "nội dung")}
                                        className={styles["copy-button"]}
                                        title="Sao chép nội dung"
                                    >
                                        {copiedField === "nội dung" ? <HiOutlineClipboardCheck /> : <HiOutlineClipboard />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Auto-confirm notice */}
                        <div className={styles["auto-confirm-notice"]}>
                            <HiOutlineRefresh style={{ display: "inline", marginRight: "6px", animation: "spin 2s linear infinite", verticalAlign: "middle" }} />
                            <span>Đang chờ xác nhận thanh toán tự động...</span>
                        </div>
                    </div>
                </div>


            </motion.div>
        </div>
    );
};
