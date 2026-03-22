"use client";

import React, { useEffect, useState } from "react";
import { MdConfirmationNumber, MdAccessTime, MdLocalOffer } from "react-icons/md";
import { toast } from "sonner";
import styles from "./UserProfile.module.css";
import type { WalletCouponDto } from "@/services/coupon-service"; // Assuming exported type

export default function VoucherWallet() {
    const [vouchers, setVouchers] = useState<WalletCouponDto[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchVouchers();
    }, []);

    const fetchVouchers = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/shop/profile/vouchers");
            if (!res.ok) {
                const data = await res.json();
                toast.error(data.error || "Lỗi tải ví voucher.");
                return;
            }
            const data = await res.json();
            setVouchers(data.coupons || []);
        } catch (error) {
            toast.error("Không thể kết nối để tải ví voucher.");
            console.error("Fetch vouchers error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const formatDate = (dateString: Date | null) => {
        if (!dateString) return "Không thời hạn";
        return new Date(dateString).toLocaleDateString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        });
    };

    const formatCurrency = (amount: number | null) => {
        if (amount == null) return "0đ";
        return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
    };

    const getVoucherDescription = (voucher: WalletCouponDto) => {
        if (voucher.description) return voucher.description;
        switch (voucher.type) {
            case "PERCENTAGE":
                return "Giảm giá theo phần trăm";
            case "FIXED":
                return "Giảm giá cố định";
            case "FREE_SHIPPING":
                return "Miễn phí vận chuyển";
            default:
                return "Phiếu giảm giá";
        }
    };

    return (
        <section className={styles["user-profile-content__section"]}>
            <div className={styles["user-profile-content__section-header"]}>
                <div className={styles["user-profile-content__icon-box"]}>
                    <MdConfirmationNumber size={24} />
                </div>
                <div>
                    <h2 className={styles["user-profile-content__section-title"]}>Ví voucher</h2>
                    <p className={styles["user-profile-content__subtitle"]} style={{ fontSize: "14px", marginTop: "4px" }}>
                        Danh sách mã giảm giá bạn có thể sử dụng
                    </p>
                </div>
            </div>

            {isLoading ? (
                <div style={{ textAlign: "center", padding: "40px", color: "var(--color-primary)" }}>
                    <p>Đang tải danh sách voucher...</p>
                </div>
            ) : vouchers.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 20px", background: "rgba(255, 255, 255, 0.02)", borderRadius: "12px", border: "1px dashed rgba(255, 255, 255, 0.1)" }}>
                    <MdLocalOffer size={48} color="rgba(255, 255, 255, 0.2)" style={{ marginBottom: "16px" }} />
                    <p style={{ color: "var(--color-text-secondary)", fontSize: "16px" }}>Bạn chưa có mã giảm giá nào có thể sử dụng lúc này.</p>
                </div>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
                    {vouchers.map((voucher) => (
                        <div key={voucher.id} style={{
                            background: "linear-gradient(145deg, rgba(29, 185, 84, 0.08) 0%, rgba(29, 185, 84, 0.02) 100%)",
                            borderRadius: "16px",
                            padding: "24px",
                            border: "1px solid rgba(29, 185, 84, 0.3)",
                            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2), inset 0 0 0 1px rgba(255, 255, 255, 0.05)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "16px",
                            position: "relative",
                            overflow: "hidden",
                            transition: "transform 0.2s ease, box-shadow 0.2s ease",
                            cursor: "pointer"
                        }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = "translateY(-4px)";
                                e.currentTarget.style.boxShadow = "0 12px 40px rgba(29, 185, 84, 0.15), inset 0 0 0 1px rgba(255, 255, 255, 0.1)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = "none";
                                e.currentTarget.style.boxShadow = "0 8px 32px rgba(0, 0, 0, 0.2), inset 0 0 0 1px rgba(255, 255, 255, 0.05)";
                            }}>
                            {/* Decorative Edge Cuts */}
                            <div style={{
                                position: "absolute",
                                left: "-14px",
                                top: "50%",
                                width: "28px",
                                height: "28px",
                                background: "var(--color-background-dark, #121212)", // Assuming standard dark background
                                borderRadius: "50%",
                                transform: "translateY(-50%)",
                                borderRight: "1px solid rgba(29, 185, 84, 0.3)",
                                boxShadow: "inset 4px 0 8px rgba(0,0,0,0.4)"
                            }} />

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                    <div style={{
                                        width: "40px",
                                        height: "40px",
                                        borderRadius: "10px",
                                        background: "rgba(29, 185, 84, 0.15)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "var(--color-primary)"
                                    }}>
                                        <MdLocalOffer size={20} />
                                    </div>
                                    <span style={{
                                        fontWeight: "800",
                                        fontSize: "20px",
                                        letterSpacing: "1px",
                                        color: "white",
                                        textShadow: "0 2px 4px rgba(0,0,0,0.3)"
                                    }}>
                                        {voucher.code}
                                    </span>
                                </div>
                                <span style={{
                                    background: "rgba(29, 185, 84, 0.15)",
                                    color: "var(--color-primary)",
                                    padding: "6px 12px",
                                    borderRadius: "40px",
                                    fontSize: "12px",
                                    fontWeight: "600",
                                    border: "1px solid rgba(29, 185, 84, 0.3)"
                                }}>
                                    Sẵn sàng
                                </span>
                            </div>

                            <div style={{ marginTop: "4px", paddingLeft: "50px" }}>
                                <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "6px", color: "rgba(255,255,255,0.9)", lineHeight: "1.4" }}>
                                    {getVoucherDescription(voucher)}
                                </h3>
                                {voucher.minOrderAmount != null && voucher.minOrderAmount > 0 && (
                                    <p style={{ fontSize: "14px", color: "var(--color-text-secondary)" }}>
                                        Đơn tối thiểu <strong style={{ color: "white" }}>{formatCurrency(voucher.minOrderAmount)}</strong>
                                    </p>
                                )}
                            </div>

                            <div style={{
                                marginTop: "auto",
                                paddingTop: "16px",
                                borderTop: "1px dashed rgba(255, 255, 255, 0.1)",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                color: "var(--color-text-muted)",
                                fontSize: "13px"
                            }}>
                                <MdAccessTime size={16} />
                                <span>HSD: {formatDate(voucher.endsAt)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
