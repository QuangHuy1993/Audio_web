"use client";

import React, { useEffect, useState } from "react";
import {
    MdAnalytics,
    MdFileDownload,
    MdRefresh,
    MdTrendingUp,
    MdGroup,
    MdInventory,
    MdStars,
} from "react-icons/md";
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    AreaChart,
    Area,
} from "recharts";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import styles from "./AdminReportsPage.module.css";

type ReportStats = {
    revenueChartData: { month: string; amount: number }[];
    topProducts: { name: string; quantity: number; orderCount: number }[];
    customersChartData: { month: string; count: number }[];
    topCustomers: {
        name: string;
        email: string;
        image?: string;
        totalSpend: number;
        orderCount: number;
    }[];
};

const formatPrice = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
    }).format(amount);
};

const AdminReportsPage: React.FC = () => {
    const [stats, setStats] = useState<ReportStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchStats = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/admin/reports/stats");
            if (!res.ok) throw new Error("Không thể tải dữ liệu báo cáo");
            const data = await res.json();
            setStats(data);
        } catch (error) {
            toast.error("Lỗi khi tải dữ liệu thống kê");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleExportExcel = () => {
        if (!stats) return;

        try {
            const wb = XLSX.utils.book_new();

            // 1. Sheet Doanh thu theo tháng
            const revenueData = stats.revenueChartData.map((d) => ({
                "Tháng": d.month,
                "Doanh thu (VND)": d.amount,
            }));
            const wsRevenue = XLSX.utils.json_to_sheet(revenueData);
            XLSX.utils.book_append_sheet(wb, wsRevenue, "Doanh thu tháng");

            // 2. Sheet Sản phẩm bán chạy
            const productData = stats.topProducts.map((p) => ({
                "Tên sản phẩm": p.name,
                "Số lượng đã bán": p.quantity,
                "Số đơn hàng": p.orderCount,
            }));
            const wsProducts = XLSX.utils.json_to_sheet(productData);
            XLSX.utils.book_append_sheet(wb, wsProducts, "Sản phẩm bán chạy");

            // 3. Sheet Khách hàng VIP
            const customerData = stats.topCustomers.map((c) => ({
                "Họ tên": c.name,
                "Email": c.email,
                "Số đơn đặt": c.orderCount,
                "Tổng chi tiêu (VND)": c.totalSpend,
            }));
            const wsCustomers = XLSX.utils.json_to_sheet(customerData);
            XLSX.utils.book_append_sheet(wb, wsCustomers, "Khách hàng VIP");

            // Xuất file với tên có ngày tháng
            const dateStr = new Date().toISOString().split('T')[0];
            XLSX.writeFile(wb, `Bao_cao_AudioAI_Shop_${dateStr}.xlsx`);
            toast.success("Đã xuất file báo cáo Excel thành công!");
        } catch (error) {
            console.error("Export Excel Error:", error);
            toast.error("Lỗi khi tạo file Excel");
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    if (isLoading || !stats) {
        return (
            <div className={styles["admin-reports-page"]}>
                <div className={styles["admin-reports-page__loading"]}>
                    <MdRefresh className={styles["admin-reports-page__loading-icon"]} />
                    <p>Đang tổng hợp báo cáo chuyên sâu...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles["admin-reports-page"]}>
            <header className={styles["admin-reports-page__header"]}>
                <div className={styles["admin-reports-page__header-title-group"]}>
                    <h1 className={styles["admin-reports-page__header-title"]}>
                        Báo cáo & Phân tích
                    </h1>
                    <p className={styles["admin-reports-page__header-subtitle"]}>
                        Phân tích chi tiết doanh thu, khách hàng và sản phẩm
                    </p>
                </div>
                <div className={styles["admin-reports-page__header-actions"]}>
                    <button onClick={fetchStats} className={styles["admin-reports-page__action-button"]}>
                        <MdRefresh /> Làm mới
                    </button>
                    <button
                        onClick={handleExportExcel}
                        className={styles["admin-reports-page__action-button-primary"]}
                    >
                        <MdFileDownload /> Xuất báo cáo
                    </button>
                </div>
            </header>

            <div className={styles["admin-reports-page__content"]}>
                {/* Doanh thu theo tháng */}
                <section className={styles["admin-reports-page__section"]}>
                    <div className={styles["admin-reports-page__section-header"]}>
                        <h2 className={styles["admin-reports-page__section-title"]}>
                            <MdTrendingUp /> Biểu đồ doanh thu (VNPay, VietQR, ...)
                        </h2>
                    </div>
                    <div className={styles["admin-reports-page__chart-container"]}>
                        <ResponsiveContainer width="100%" height={350}>
                            <AreaChart data={stats.revenueChartData}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                                <XAxis
                                    dataKey="month"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 12 }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 12 }}
                                    tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`}
                                />
                                <Tooltip
                                    formatter={(value: any) => [formatPrice(Number(value)), "Doanh thu"]}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-lg)' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="amount"
                                    stroke="var(--primary)"
                                    fillOpacity={1}
                                    fill="url(#colorRevenue)"
                                    strokeWidth={3}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </section>

                <div className={styles["admin-reports-page__grid"]}>
                    {/* Khách hàng mới */}
                    <section className={styles["admin-reports-page__section"]}>
                        <div className={styles["admin-reports-page__section-header"]}>
                            <h2 className={styles["admin-reports-page__section-title"]}>
                                <MdGroup /> Khách hàng mới
                            </h2>
                        </div>
                        <div className={styles["admin-reports-page__chart-container"]}>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={stats.customersChartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                                    <Tooltip
                                        cursor={{ fill: 'var(--overlay-primary)' }}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-lg)' }}
                                    />
                                    <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} barSize={30} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </section>

                    {/* Top sản phẩm bán chạy */}
                    <section className={styles["admin-reports-page__section"]}>
                        <div className={styles["admin-reports-page__section-header"]}>
                            <h2 className={styles["admin-reports-page__section-title"]}>
                                <MdInventory /> Top 10 sản phẩm bán chạy
                            </h2>
                        </div>
                        <div className={styles["admin-reports-page__table-wrapper"]}>
                            <table className={styles["admin-reports-page__table"]}>
                                <thead>
                                    <tr>
                                        <th>Sản phẩm</th>
                                        <th style={{ textAlign: 'center' }}>Số lượng</th>
                                        <th style={{ textAlign: 'right' }}>Lượt mua</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.topProducts.map((p, idx) => (
                                        <tr key={idx}>
                                            <td className={styles["admin-reports-page__product-name"]}>{p.name}</td>
                                            <td style={{ textAlign: 'center' }}>{p.quantity}</td>
                                            <td style={{ textAlign: 'right' }}>{p.orderCount}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>

                {/* Top khách hàng thân thiết */}
                <section className={styles["admin-reports-page__section"]}>
                    <div className={styles["admin-reports-page__section-header"]}>
                        <h2 className={styles["admin-reports-page__section-title"]}>
                            <MdStars /> Khách hàng thân thiết (VIP)
                        </h2>
                    </div>
                    <div className={styles["admin-reports-page__table-wrapper"]}>
                        <table className={styles["admin-reports-page__table"]}>
                            <thead>
                                <tr>
                                    <th>Khách hàng</th>
                                    <th>Email</th>
                                    <th style={{ textAlign: 'center' }}>Số đơn</th>
                                    <th style={{ textAlign: 'right' }}>Tổng chi tiêu</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.topCustomers.map((user, idx) => (
                                    <tr key={idx}>
                                        <td>
                                            <div className={styles["admin-reports-page__customer-cell"]}>
                                                <div className={styles["admin-reports-page__customer-avatar"]}>
                                                    {user.image ? <img src={user.image} alt="" /> : user.name.charAt(0).toUpperCase()}
                                                </div>
                                                {user.name}
                                            </div>
                                        </td>
                                        <td>{user.email}</td>
                                        <td style={{ textAlign: 'center' }}>{user.orderCount}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>
                                            {formatPrice(user.totalSpend)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default AdminReportsPage;
