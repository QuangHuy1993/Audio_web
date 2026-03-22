"use client";

import React, { useState, useEffect } from "react";
import {
    MdCalendarToday,
    MdInfo,
    MdLocalShipping,
    MdPayments,
    MdFilterList,
    MdStar
} from "react-icons/md";
import clsx from "clsx";
import styles from "./OrderHistory.module.css";
import OrderDetailModal from "./OrderDetailModal";
import ReviewModal from "@/features/shop/components/reviews/ReviewModal";
import { toast } from "sonner";

export default function OrderHistory() {
    const [orders, setOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("ALL");

    const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [reviewData, setReviewData] = useState<{ productId: string, productName: string, orderId: string } | null>(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalOrders, setTotalOrders] = useState(0);

    const tabs = [
        { id: "ALL", label: "Tất cả đơn hàng" },
        { id: "PROCESSING", label: "Đang xử lý" }, // PENDING & PAID
        { id: "SHIPPED", label: "Đang giao" },
        { id: "COMPLETED", label: "Đã hoàn thành" },
        { id: "CANCELLED", label: "Đã hủy" },
    ];

    useEffect(() => {
        setCurrentPage(1); // Reset to page 1 when tab changes
    }, [activeTab]);

    useEffect(() => {
        fetchOrders();
    }, [activeTab, currentPage]);

    const fetchOrders = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/shop/orders?status=${activeTab}&page=${currentPage}&limit=4`);
            if (!res.ok) throw new Error("Load failed");
            const data = await res.json();
            setOrders(data.orders || []);
            setTotalPages(data.pagination?.totalPages || 1);
            setTotalOrders(data.pagination?.total || 0);
        } catch (error) {
            console.error(error);
            toast.error("Lỗi khi tải danh sách đơn hàng.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleOrderCancelled = (orderId: string) => {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: "CANCELLED" } : o));
    };

    const handleOrderCompleted = (orderId: string) => {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: "COMPLETED" } : o));
        // Nếu đang ở tab khác có thể cần refresh lại list hoặc tab filter
        if (activeTab !== "ALL" && activeTab !== "COMPLETED") {
            fetchOrders();
        }
    };

    const openOrderDetails = (order: any) => {
        setSelectedOrder(order);
        setIsModalOpen(true);
    };

    const formatCurrency = (amount: number | string) => {
        return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Number(amount));
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("vi-VN", {
            day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
        });
    };

    const getStatusTextAndClass = (status: string) => {
        if (status === "PENDING") return { text: "Chờ thanh toán", className: styles["order-history-content__status-tag--pending"] || "" };
        if (status === "PAID") return { text: "Đã thanh toán", className: styles["order-history-content__status-tag--shipped"] || "" };
        if (status === "SHIPPED") return { text: "Đang giao hàng", className: styles["order-history-content__status-tag--shipped"] || "" };
        if (status === "COMPLETED") return { text: "Đã hoàn thành", className: styles["order-history-content__status-tag--completed"] || "" };
        if (status === "CANCELLED") return { text: "Đã huỷ", className: "" };
        return { text: status, className: "" };
    };

    return (
        <main className={styles["order-history-content__main"]}>
            <header className={styles["order-history-content__header"]}>
                <h2 className={styles["order-history-content__title"]}>Lịch sử đơn hàng</h2>
                <p className={styles["order-history-content__subtitle"]}>Quản lý và theo dõi tất cả giao dịch âm thanh của bạn tại Đức Uy Audio.</p>
            </header>

            {/* Tabs Navigation */}
            <div className={styles["order-history-content__tabs"]}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={clsx(styles["order-history-content__tab"], activeTab === tab.id && styles["order-history-content__tab--active"])}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Order List */}
            <div className={styles["order-history-content__list"]}>
                {isLoading ? (
                    <div style={{ textAlign: "center", padding: "40px" }}>Đang tải danh sách đơn hàng...</div>
                ) : orders.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "60px", background: "rgba(255,255,255,0.02)", borderRadius: "12px" }}>
                        <MdFilterList size={48} color="rgba(255,255,255,0.2)" />
                        <p style={{ marginTop: "16px", color: "var(--color-text-secondary)" }}>Không tìm thấy đơn hàng nào.</p>
                    </div>
                ) : (
                    orders.map(order => {
                        const { text: statusText, className: statusClass } = getStatusTextAndClass(order.status);
                        const firstItem = order.items?.[0];
                        const additionalItemsCount = (order.items?.length || 1) - 1;
                        const canCancel = order.status === "PENDING" && (Date.now() - new Date(order.createdAt).getTime()) <= 24 * 60 * 60 * 1000;

                        return (
                            <div key={order.id} className={styles["order-history-content__card"]}>
                                <div className={styles["order-history-content__card-top"]}>
                                    <div className={styles["order-history-content__status-block"]}>
                                        <span className={clsx(styles["order-history-content__status-tag"], statusClass)}
                                            style={order.status === "CANCELLED" ? { background: "rgba(255,75,75,0.1)", color: "#ff4b4b" } : {}}
                                        >
                                            {statusText}
                                        </span>
                                        <h3 className={styles["order-history-content__order-id"]}>Mã đơn: {order.orderNumber}</h3>
                                        <p className={styles["order-history-content__order-date"]}>
                                            <MdCalendarToday size={14} />
                                            {formatDate(order.createdAt)}
                                        </p>
                                    </div>
                                    <div className={styles["order-history-content__price-block"]}>
                                        <p className={styles["order-history-content__price-label"]}>Tổng cộng</p>
                                        <p className={styles["order-history-content__price-value"]}>{formatCurrency(order.totalAmount)}</p>
                                    </div>
                                </div>

                                <div className={styles["order-history-content__products-preview"]}>
                                    <div className={styles["order-history-content__images-stack"]}>
                                        <div
                                            className={styles["order-history-content__product-img"]}
                                            style={{
                                                backgroundImage: `url('${firstItem?.product?.images?.[0]?.url || ""}')`,
                                                marginRight: additionalItemsCount === 0 ? 0 : "-10px"
                                            }}
                                        />
                                        {additionalItemsCount > 0 && (
                                            <div className={styles["order-history-content__more-badge"]}>+{additionalItemsCount}</div>
                                        )}
                                    </div>
                                    <div className={styles["order-history-content__products-info"]}>
                                        <p className={styles["order-history-content__products-name"]}>
                                            {firstItem?.productName} {additionalItemsCount > 0 && ` + ${additionalItemsCount} sản phẩm khác`}
                                        </p>
                                        <p className={styles["order-history-content__payment-info"]}>
                                            {order.status === "PENDING" && canCancel ? "Bạn có 24h để huỷ đơn nếu đổi ý" : ""}
                                            {order.status === "SHIPPED" && "Đơn hàng đang trên đường giao đến bạn"}
                                        </p>
                                    </div>
                                </div>

                                <div className={styles["order-history-content__card-actions"]}>
                                    {order.status === "PENDING" && canCancel && (
                                        <button className={clsx(styles["order-history-content__btn"], styles["order-history-content__btn--primary"])} style={{ paddingLeft: 24, paddingRight: 24 }}>
                                            <MdPayments size={18} />
                                            Thanh toán ngay
                                        </button>
                                    )}
                                    {order.status === "COMPLETED" && (
                                        <button
                                            className={clsx(styles["order-history-content__btn"], styles["order-history-content__btn--primary"])}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const items = order.items || [];
                                                if (items.length === 1 && items[0]) {
                                                    const item = items[0];
                                                    setReviewData({
                                                        productId: item.productId,
                                                        productName: item.productName,
                                                        orderId: order.id
                                                    });
                                                } else {
                                                    openOrderDetails(order);
                                                }
                                            }}
                                        >
                                            <MdStar size={18} />
                                            Đánh giá ngay
                                        </button>
                                    )}
                                    <button
                                        className={clsx(styles["order-history-content__btn"], styles["order-history-content__btn--secondary"])}
                                        onClick={() => openOrderDetails(order)}
                                    >
                                        <MdInfo size={18} />
                                        Xem chi tiết
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Pagination */}
            {!isLoading && totalPages > 1 && (
                <div className={styles["order-history-content__pagination"]}>
                    <button
                        className={styles["order-history-content__page-btn"]}
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        aria-label="Trang trước"
                    >
                        &laquo;
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <button
                            key={page}
                            className={clsx(
                                styles["order-history-content__page-btn"],
                                currentPage === page && styles["order-history-content__page-btn--active"]
                            )}
                            onClick={() => setCurrentPage(page)}
                        >
                            {page}
                        </button>
                    ))}

                    <button
                        className={styles["order-history-content__page-btn"]}
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        aria-label="Trang sau"
                    >
                        &raquo;
                    </button>
                </div>
            )}

            <OrderDetailModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                order={selectedOrder}
                onOrderCancelled={handleOrderCancelled}
                onOrderCompleted={handleOrderCompleted}
            />

            <ReviewModal
                isOpen={!!reviewData}
                onClose={() => setReviewData(null)}
                productId={reviewData?.productId || ""}
                productName={reviewData?.productName || ""}
                orderId={reviewData?.orderId}
                onSuccess={() => {
                    toast.success("Cảm ơn bạn đã đánh giá!");
                }}
            />
        </main>
    );
}
