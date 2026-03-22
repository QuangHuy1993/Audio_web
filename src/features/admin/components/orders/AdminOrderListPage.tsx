"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
    MdSearch,
    MdFilterList,
    MdChevronLeft,
    MdChevronRight,
    MdMoreHoriz,
    MdRefresh,
} from "react-icons/md";
import { toast } from "sonner";
import Link from "next/link";
import styles from "./AdminOrderListPage.module.css";

type Order = {
    id: string;
    orderNumber: string;
    customerName: string;
    customerImage?: string;
    totalAmount: number;
    status: string;
    itemCount: number;
    createdAt: string;
};

type Pagination = {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
};

const formatPrice = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
    }).format(amount);
};

const formatStatus = (status: string) => {
    const statusMap: Record<string, { label: string; class: string }> = {
        PENDING: { label: "Chờ xử lý", class: "pending" },
        PAID: { label: "Đã thanh toán", class: "paid" },
        SHIPPED: { label: "Đang giao", class: "shipped" },
        COMPLETED: { label: "Hoàn thành", class: "completed" },
        CANCELLED: { label: "Đã hủy", class: "cancelled" },
        FAILED: { label: "Thất bại", class: "cancelled" },
    };
    return statusMap[status] || { label: status, class: "pending" };
};

const AdminOrderListPage: React.FC = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [page, setPage] = useState(1);

    const fetchOrders = useCallback(async () => {
        setIsLoading(true);
        try {
            const queryParams = new URLSearchParams({
                page: page.toString(),
                limit: "10",
                search,
                status,
            });
            const res = await fetch(`/api/admin/orders?${queryParams.toString()}`);
            if (!res.ok) throw new Error("Không thể tải danh sách đơn hàng");
            const data = await res.json();
            setOrders(data.orders);
            setPagination(data.pagination);
        } catch (error) {
            toast.error("Lỗi khi tải danh sách đơn hàng");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }, [page, search, status]);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
        setPage(1); // Reset to first page on search
    };

    const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setStatus(e.target.value);
        setPage(1); // Reset to first page on filter
    };

    return (
        <div className={styles["admin-orders-page"]}>
            <header className={styles["admin-orders-page__header"]}>
                <h1 className={styles["admin-orders-page__header-title"]}>
                    Quản lý đơn hàng
                </h1>
                <button onClick={fetchOrders} className={styles["admin-orders-page__refresh-button"]} title="Làm mới">
                    <MdRefresh />
                </button>
            </header>

            <div className={styles["admin-orders-page__filters"]}>
                <div className={styles["admin-orders-page__search"]}>
                    <MdSearch className={styles["admin-orders-page__search-icon"]} />
                    <input
                        className={styles["admin-orders-page__search-input"]}
                        placeholder="Tìm theo mã đơn, khách hàng..."
                        value={search}
                        onChange={handleSearchChange}
                    />
                </div>
                <div className={styles["admin-orders-page__filter-group"]}>
                    <MdFilterList className={styles["admin-orders-page__filter-icon"]} />
                    <select
                        className={styles["admin-orders-page__select"]}
                        value={status}
                        onChange={handleStatusChange}
                    >
                        <option value="">Tất cả trạng thái</option>
                        <option value="PENDING">Chờ xử lý</option>
                        <option value="PAID">Đã thanh toán</option>
                        <option value="SHIPPED">Đang giao hàng</option>
                        <option value="COMPLETED">Đã hoàn thành</option>
                        <option value="CANCELLED">Đã hủy</option>
                    </select>
                </div>
            </div>

            <div className={styles["admin-orders-page__content"]}>
                <div className={styles["admin-orders-page__table-wrapper"]}>
                    <table className={styles["admin-orders-page__table"]}>
                        <thead>
                            <tr>
                                <th>Mã đơn hàng</th>
                                <th>Ngày tạo</th>
                                <th>Khách hàng</th>
                                <th>Sản phẩm</th>
                                <th>Tổng tiền</th>
                                <th>Trạng thái</th>
                                <th>Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className={styles["admin-orders-page__table-empty"]}>
                                        Đang tải dữ liệu...
                                    </td>
                                </tr>
                            ) : orders.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className={styles["admin-orders-page__table-empty"]}>
                                        Không tìm thấy đơn hàng nào.
                                    </td>
                                </tr>
                            ) : (
                                orders.map((order) => {
                                    const statusInfo = formatStatus(order.status);
                                    return (
                                        <tr key={order.id}>
                                            <td>
                                                <span className={styles["admin-orders-page__order-number"]}>
                                                    #{order.orderNumber}
                                                </span>
                                            </td>
                                            <td>
                                                {new Date(order.createdAt).toLocaleDateString("vi-VN", {
                                                    day: "2-digit",
                                                    month: "2-digit",
                                                    year: "numeric",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </td>
                                            <td>
                                                <div className={styles["admin-orders-page__customer"]}>
                                                    <div className={styles["admin-orders-page__avatar"]}>
                                                        {order.customerImage ? (
                                                            <img src={order.customerImage} alt="" />
                                                        ) : (
                                                            order.customerName.charAt(0).toUpperCase()
                                                        )}
                                                    </div>
                                                    <span>{order.customerName}</span>
                                                </div>
                                            </td>
                                            <td>{order.itemCount} sản phẩm</td>
                                            <td className={styles["admin-orders-page__amount"]}>
                                                {formatPrice(order.totalAmount)}
                                            </td>
                                            <td>
                                                <span className={`${styles["admin-orders-page__status"]} ${styles[`admin-orders-page__status--${statusInfo.class}`]}`}>
                                                    {statusInfo.label}
                                                </span>
                                            </td>
                                            <td>
                                                <Link href={`/admin/orders/${order.id}`}>
                                                    <button className={styles["admin-orders-page__action-button"]} title="Xem chi tiết">
                                                        <MdMoreHoriz />
                                                    </button>
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {pagination && pagination.totalPages > 1 && (
                    <div className={styles["admin-orders-page__pagination"]}>
                        <button
                            disabled={page === 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            className={styles["admin-orders-page__page-button"]}
                        >
                            <MdChevronLeft />
                        </button>
                        <span className={styles["admin-orders-page__page-info"]}>
                            Trang {page} / {pagination.totalPages}
                        </span>
                        <button
                            disabled={page === pagination.totalPages}
                            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                            className={styles["admin-orders-page__page-button"]}
                        >
                            <MdChevronRight />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminOrderListPage;
