"use client";

import React, { useEffect, useState } from "react";
import {
    MdArrowBack,
    MdPerson,
    MdLocalShipping,
    MdPayments,
    MdCheckCircle,
    MdHistory,
    MdRefresh,
} from "react-icons/md";
import { toast } from "sonner";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import styles from "./AdminOrderDetailPage.module.css";

type OrderItem = {
    id: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    product: {
        id: string;
        name: string;
        slug: string;
        images: { url: string }[];
    };
};

type Order = {
    id: string;
    orderNumber: string;
    status: string;
    totalAmount: number;
    createdAt: string;
    user: {
        name: string;
        email: string;
        image?: string;
    };
    shippingAddress: {
        fullName: string;
        phone: string;
        line1: string;
        line2?: string;
        ward?: string;
        district?: string;
        province?: string;
    };
    items: OrderItem[];
};

const formatPrice = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
    }).format(amount);
};

const ORDER_STATUSES = [
    { value: "PENDING", label: "Chờ xử lý" },
    { value: "PAID", label: "Đã thanh toán" },
    { value: "SHIPPED", label: "Đang giao hàng" },
    { value: "COMPLETED", label: "Hoàn thành" },
    { value: "CANCELLED", label: "Đã hủy" },
    { value: "FAILED", label: "Thất bại" },
];

const AdminOrderDetailPage: React.FC = () => {
    const { id } = useParams();
    const router = useRouter();
    const [order, setOrder] = useState<Order | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);

    const fetchOrderDetail = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/admin/orders/${id}`);
            if (!res.ok) throw new Error("Không thể tải chi tiết đơn hàng");
            const data = await res.json();
            setOrder(data);
        } catch (error) {
            toast.error("Lỗi khi tải dữ liệu");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (id) fetchOrderDetail();
    }, [id]);

    const handleStatusChange = async (newStatus: string) => {
        if (!order) return;

        setIsUpdating(true);
        try {
            const res = await fetch(`/api/admin/orders/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });

            if (!res.ok) throw new Error("Cập nhật thất bại");

            toast.success("Cập nhật trạng thái thành công");
            setOrder({ ...order, status: newStatus });
        } catch (error) {
            toast.error("Lỗi khi cập nhật trạng thái");
            console.error(error);
        } finally {
            setIsUpdating(false);
        }
    };

    if (isLoading) {
        return (
            <div className={styles["admin-order-detail"]}>
                <div className={styles["admin-order-detail__loading"]}>
                    <MdRefresh className={styles["admin-order-detail__loading-icon"]} />
                    <p>Đang tải chi tiết đơn hàng...</p>
                </div>
            </div>
        );
    }

    if (!order) {
        return (
            <div className={styles["admin-order-detail"]}>
                <div className={styles["admin-order-detail__error"]}>
                    <h2>Không tìm thấy đơn hàng</h2>
                    <Link href="/admin/orders">Quay lại danh sách</Link>
                </div>
            </div>
        );
    }

    return (
        <div className={styles["admin-order-detail"]}>
            <header className={styles["admin-order-detail__header"]}>
                <div className={styles["admin-order-detail__header-left"]}>
                    <Link href="/admin/orders" className={styles["admin-order-detail__back-link"]}>
                        <MdArrowBack /> Quay lại
                    </Link>
                    <h1 className={styles["admin-order-detail__title"]}>
                        Chi tiết đơn hàng #{order.orderNumber}
                    </h1>
                    <span className={styles["admin-order-detail__date"]}>
                        Đặt lúc: {new Date(order.createdAt).toLocaleString("vi-VN")}
                    </span>
                </div>
                <div className={styles["admin-order-detail__header-actions"]}>
                    <select
                        className={styles["admin-order-detail__status-select"]}
                        value={order.status}
                        disabled={isUpdating}
                        onChange={(e) => handleStatusChange(e.target.value)}
                    >
                        {ORDER_STATUSES.map((s) => (
                            <option key={s.value} value={s.value}>
                                {s.label}
                            </option>
                        ))}
                    </select>
                </div>
            </header>

            <div className={styles["admin-order-detail__content"]}>
                <div className={styles["admin-order-detail__main"]}>
                    {/* Danh sách sản phẩm */}
                    <section className={styles["admin-order-detail__card"]}>
                        <h2 className={styles["admin-order-detail__card-title"]}>
                            Sản phẩm ({order.items.length})
                        </h2>
                        <div className={styles["admin-order-detail__items-list"]}>
                            {order.items.map((item) => (
                                <div key={item.id} className={styles["admin-order-detail__item"]}>
                                    <div className={styles["admin-order-detail__item-image"]}>
                                        {item.product.images?.[0] ? (
                                            <img src={item.product.images[0].url} alt={item.productName} />
                                        ) : (
                                            <div className={styles["admin-order-detail__no-image"]} />
                                        )}
                                    </div>
                                    <div className={styles["admin-order-detail__item-info"]}>
                                        <h3>{item.productName}</h3>
                                        <p>Số lượng: {item.quantity}</p>
                                    </div>
                                    <div className={styles["admin-order-detail__item-price"]}>
                                        {formatPrice(item.unitPrice)}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className={styles["admin-order-detail__total"]}>
                            <div className={styles["admin-order-detail__total-row"]}>
                                <span>Tổng tiền hàng:</span>
                                <span>{formatPrice(order.totalAmount)}</span>
                            </div>
                            <div className={`${styles["admin-order-detail__total-row"]} ${styles["admin-order-detail__total-row--final"]}`}>
                                <span>Tổng thanh toán:</span>
                                <span>{formatPrice(order.totalAmount)}</span>
                            </div>
                        </div>
                    </section>
                </div>

                <div className={styles["admin-order-detail__sidebar"]}>
                    {/* Thông tin khách hàng */}
                    <section className={styles["admin-order-detail__card"]}>
                        <h2 className={styles["admin-order-detail__card-title"]}>
                            <MdPerson /> Khách hàng
                        </h2>
                        <div className={styles["admin-order-detail__customer-info"]}>
                            <div className={styles["admin-order-detail__customer-avatar"]}>
                                {order.user.image ? (
                                    <img src={order.user.image} alt="" />
                                ) : (
                                    order.user.name.charAt(0).toUpperCase()
                                )}
                            </div>
                            <div className={styles["admin-order-detail__customer-details"]}>
                                <p><strong>{order.user.name}</strong></p>
                                <p>{order.user.email}</p>
                            </div>
                        </div>
                    </section>

                    {/* Thông tin giao hàng */}
                    <section className={styles["admin-order-detail__card"]}>
                        <h2 className={styles["admin-order-detail__card-title"]}>
                            <MdLocalShipping /> Vận chuyển
                        </h2>
                        <div className={styles["admin-order-detail__address"]}>
                            <p><strong>{order.shippingAddress.fullName}</strong></p>
                            <p>{order.shippingAddress.phone}</p>
                            <p>{order.shippingAddress.line1}</p>
                            {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                            <p>
                                {[order.shippingAddress.ward, order.shippingAddress.district, order.shippingAddress.province]
                                    .filter(Boolean)
                                    .join(", ")}
                            </p>
                        </div>
                    </section>

                    {/* Thông tin thanh toán */}
                    <section className={styles["admin-order-detail__card"]}>
                        <h2 className={styles["admin-order-detail__card-title"]}>
                            <MdPayments /> Thanh toán
                        </h2>
                        <div className={styles["admin-order-detail__payment"]}>
                            <p>Trạng thái: <strong>{order.status === "PAID" || order.status === "COMPLETED" ? "Đã thanh toán" : "Chưa thanh toán"}</strong></p>
                            <p>Phương thức: QR VietQR / Chuyển khoản</p>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default AdminOrderDetailPage;
