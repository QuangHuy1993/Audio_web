"use client";

import React, { useEffect, useState } from "react";
import {
  MdMoreHoriz,
  MdNotifications,
  MdPayments,
  MdPersonAdd,
  MdSearch,
  MdShoppingBag,
  MdSpeaker,
  MdRefresh,
} from "react-icons/md";
import { toast } from "sonner";
import Link from "next/link";
import styles from "./AdminDashboardPage.module.css";

type DashboardStats = {
  revenue: number;
  totalOrders: number;
  newUsers: number;
  totalProductsSold: number;
  revenueByDay: { date: string; amount: number }[];
  categoryDistribution: { name: string; value: number }[];
  recentOrders: {
    id: string;
    orderNumber: string;
    customerName: string;
    customerImage?: string;
    productName: string;
    totalAmount: number;
    status: string;
    createdAt: string;
  }[];
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
    PAID: { label: "Đã thanh toán", class: "delivered" },
    SHIPPED: { label: "Đang giao", class: "shipped" },
    COMPLETED: { label: "Hoàn thành", class: "delivered" },
    CANCELLED: { label: "Đã hủy", class: "cancelled" },
    FAILED: { label: "Thất bại", class: "cancelled" },
  };
  return statusMap[status] || { label: status, class: "processing" };
};

const AdminDashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/dashboard/stats");
      if (!res.ok) throw new Error("Không thể tải dữ liệu");
      const data = await res.json();
      setStats(data);
    } catch (error) {
      toast.error("Lỗi khi tải dữ liệu thống kê");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (isLoading || !stats) {
    return (
      <div className={styles["admin-dashboard-page"]}>
        <div className={styles["admin-dashboard-page__loading"]}>
          <MdRefresh className={styles["admin-dashboard-page__loading-icon"]} />
          <p>Đang tải dữ liệu thực tế...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles["admin-dashboard-page"]}>
      <header className={styles["admin-dashboard-page__header"]}>
        <h1 className={styles["admin-dashboard-page__header-title"]}>
          Tổng quan hệ thống
        </h1>
        <div className={styles["admin-dashboard-page__header-actions"]}>
          <div className={styles["admin-dashboard-page__search"]}>
            <MdSearch className={styles["admin-dashboard-page__search-icon"]} />
            <input
              className={styles["admin-dashboard-page__search-input"]}
              placeholder="Tìm kiếm dữ liệu..."
              aria-label="Tìm kiếm dữ liệu"
            />
          </div>
          <button
            type="button"
            className={styles["admin-dashboard-page__notification-button"]}
            aria-label="Thông báo"
          >
            <MdNotifications />
            <span className={styles["admin-dashboard-page__notification-dot"]} />
          </button>
          <button
            onClick={fetchStats}
            className={styles["admin-dashboard-page__notification-button"]}
            style={{ marginLeft: '10px' }}
            title="Làm mới dữ liệu"
          >
            <MdRefresh />
          </button>
        </div>
      </header>

      <div className={styles["admin-dashboard-page__content"]}>
        <section className={styles["admin-dashboard-page__stats-grid"]}>
          <article
            className={styles["admin-dashboard-page__stat-card"]}
            style={{ borderLeft: "4px solid var(--primary)" }}
          >
            <div className={styles["admin-dashboard-page__stat-header"]}>
              <div
                className={styles["admin-dashboard-page__stat-icon"]}
                style={{ background: "var(--overlay-primary)", color: "var(--primary)" }}
              >
                <MdPayments />
              </div>
            </div>
            <div>
              <p className={styles["admin-dashboard-page__stat-label"]}>
                Doanh thu tổng
              </p>
              <p className={styles["admin-dashboard-page__stat-value"]}>
                {formatPrice(stats.revenue)}
              </p>
            </div>
          </article>

          <article
            className={styles["admin-dashboard-page__stat-card"]}
            style={{ borderLeft: "4px solid var(--accent)" }}
          >
            <div className={styles["admin-dashboard-page__stat-header"]}>
              <div
                className={styles["admin-dashboard-page__stat-icon"]}
                style={{ background: "var(--overlay-accent)", color: "var(--accent-dark)" }}
              >
                <MdShoppingBag />
              </div>
            </div>
            <div>
              <p className={styles["admin-dashboard-page__stat-label"]}>
                Tổng số đơn hàng
              </p>
              <p className={styles["admin-dashboard-page__stat-value"]}>{stats.totalOrders}</p>
            </div>
          </article>

          <article
            className={styles["admin-dashboard-page__stat-card"]}
            style={{ borderLeft: "4px solid var(--primary)" }}
          >
            <div className={styles["admin-dashboard-page__stat-header"]}>
              <div
                className={styles["admin-dashboard-page__stat-icon"]}
                style={{ background: "var(--overlay-primary)", color: "var(--primary)" }}
              >
                <MdPersonAdd />
              </div>
            </div>
            <div>
              <p className={styles["admin-dashboard-page__stat-label"]}>
                Khách hàng mới (30 ngày)
              </p>
              <p className={styles["admin-dashboard-page__stat-value"]}>{stats.newUsers}</p>
            </div>
          </article>

          <article
            className={styles["admin-dashboard-page__stat-card"]}
            style={{ borderLeft: "4px solid var(--secondary)" }}
          >
            <div className={styles["admin-dashboard-page__stat-header"]}>
              <div
                className={styles["admin-dashboard-page__stat-icon"]}
                style={{ background: "rgba(25, 20, 20, 0.08)", color: "var(--secondary)" }}
              >
                <MdSpeaker />
              </div>
            </div>
            <div>
              <p className={styles["admin-dashboard-page__stat-label"]}>
                Sản phẩm đã bán
              </p>
              <p className={styles["admin-dashboard-page__stat-value"]}>{stats.totalProductsSold}</p>
            </div>
          </article>
        </section>

        <section className={styles["admin-dashboard-page__layout-grid"]}>
          <article className={styles["admin-dashboard-page__card"]}>
            <div className={styles["admin-dashboard-page__card-header"]}>
              <div className={styles["admin-dashboard-page__card-title-group"]}>
                <h2 className={styles["admin-dashboard-page__card-title"]}>
                  Biểu đồ doanh thu
                </h2>
                <p className={styles["admin-dashboard-page__card-subtitle"]}>
                  7 ngày gần nhất
                </p>
              </div>
            </div>

            <div className={styles["admin-dashboard-page__chart"]}>
              <div className={styles["admin-dashboard-page__chart-bars"]}>
                {stats.revenueByDay.map((day, idx) => {
                  const maxAmt = Math.max(...stats.revenueByDay.map(d => d.amount), 1);
                  const height = (day.amount / maxAmt) * 100;
                  const dateLabel = new Date(day.date).toLocaleDateString('vi-VN', { weekday: 'short' });

                  return (
                    <div key={day.date} className={styles["admin-dashboard-page__chart-bar-group"]}>
                      <div
                        className={styles["admin-dashboard-page__chart-bar"]}
                        style={{ height: `${height}%` }}
                        title={formatPrice(day.amount)}
                      />
                      <span className={styles["admin-dashboard-page__chart-label"]}>{dateLabel}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </article>

          <article className={styles["admin-dashboard-page__card"]}>
            <div className={styles["admin-dashboard-page__card-header"]}>
              <div className={styles["admin-dashboard-page__card-title-group"]}>
                <h2 className={styles["admin-dashboard-page__card-title"]}>
                  Phân bổ sản phẩm
                </h2>
                <p className={styles["admin-dashboard-page__card-subtitle"]}>
                  Theo danh mục chính
                </p>
              </div>
            </div>

            <div className={styles["admin-dashboard-page__categories-list"]}>
              {stats.categoryDistribution.map((cat, idx) => (
                <div key={cat.name} className={styles["admin-dashboard-page__category-item"]}>
                  <div className={styles["admin-dashboard-page__category-left"]}>
                    <span
                      className={styles["admin-dashboard-page__category-dot"]}
                      style={{ background: idx === 0 ? "var(--primary)" : idx === 1 ? "var(--accent)" : "var(--secondary)" }}
                    />
                    <span className={styles["admin-dashboard-page__category-label"]}>
                      {cat.name}
                    </span>
                  </div>
                  <span className={styles["admin-dashboard-page__category-value"]}>{cat.value} SP</span>
                </div>
              ))}
            </div>

            <div className={styles["admin-dashboard-page__card-footer"]}>
              <Link href="/admin/reports" className={styles["admin-dashboard-page__link-button"]}>
                Xem báo cáo chi tiết
              </Link>
            </div>
          </article>
        </section>

        <section
          className={`${styles["admin-dashboard-page__card"]} ${styles["admin-dashboard-page__orders-card"]}`}
        >
          <div className={styles["admin-dashboard-page__card-header"]}>
            <div className={styles["admin-dashboard-page__card-title-group"]}>
              <h2 className={styles["admin-dashboard-page__card-title"]}>
                Đơn hàng gần đây
              </h2>
            </div>
            <Link
              href="/admin/orders"
              className={styles["admin-dashboard-page__link-button"]}
              style={{ width: "auto" }}
            >
              Xem tất cả đơn hàng
            </Link>
          </div>

          <div className={styles["admin-dashboard-page__table-wrapper"]}>
            <table className={styles["admin-dashboard-page__table"]}>
              <thead>
                <tr>
                  <th className={styles["admin-dashboard-page__table-head-cell"]}>Mã đơn</th>
                  <th className={styles["admin-dashboard-page__table-head-cell"]}>Khách hàng</th>
                  <th className={styles["admin-dashboard-page__table-head-cell"]}>Sản phẩm</th>
                  <th className={styles["admin-dashboard-page__table-head-cell"]}>Giá trị</th>
                  <th className={styles["admin-dashboard-page__table-head-cell"]}>Trạng thái</th>
                  <th className={styles["admin-dashboard-page__table-head-cell"]}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentOrders.map((order) => {
                  const statusInfo = formatStatus(order.status);
                  return (
                    <tr key={order.id} className={styles["admin-dashboard-page__table-row"]}>
                      <td className={styles["admin-dashboard-page__table-cell"]}>#{order.orderNumber}</td>
                      <td className={styles["admin-dashboard-page__table-cell"]}>
                        <div className={styles["admin-dashboard-page__customer-cell"]}>
                          <div className={styles["admin-dashboard-page__customer-avatar"]}>
                            {order.customerImage ? (
                              <img src={order.customerImage} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                            ) : (
                              order.customerName.slice(0, 1).toUpperCase()
                            )}
                          </div>
                          <span className={styles["admin-dashboard-page__customer-name"]}>
                            {order.customerName}
                          </span>
                        </div>
                      </td>
                      <td className={styles["admin-dashboard-page__table-cell"]}>{order.productName}</td>
                      <td className={styles["admin-dashboard-page__table-cell"]}>{formatPrice(order.totalAmount)}</td>
                      <td className={styles["admin-dashboard-page__table-cell"]}>
                        <span className={`${styles["admin-dashboard-page__status-pill"]} ${styles[`admin-dashboard-page__status-pill--${statusInfo.class}`]}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className={styles["admin-dashboard-page__table-cell"]}>
                        <Link href={`/admin/orders/${order.id}`}>
                          <button
                            type="button"
                            className={styles["admin-dashboard-page__table-action-button"]}
                            aria-label="Xem chi tiết"
                          >
                            <MdMoreHoriz className={styles["admin-dashboard-page__table-action-icon"]} />
                          </button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminDashboardPage;

