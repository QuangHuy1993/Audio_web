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
    PieChart,
    Pie,
    Cell,
} from "recharts";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import styles from "./AdminReportsPage.module.css";

type ReportStats = {
    revenueChartData: { month: string; amount: number }[];
    topProducts: { name: string; quantity: number; orderCount: number }[];
    categoryRevenueData: { name: string; value: number }[];
    paymentMethodData: { name: string; value: number }[];
    topCustomers: {
        name: string;
        email: string | null;
        image?: string | null;
        totalSpend: number;
        orderCount: number;
    }[];
    paymentTransactions: {
        id: string;
        orderNumber: string;
        customerName: string;
        customerEmail: string | null;
        paymentMethod: string;
        totalAmount: number;
        createdAt: string;
    }[];
};

type ReportPeriod = "day" | "month" | "quarter" | "year";
type ReportTab = "overview" | "transactions";

const PIE_COLORS = ["#1DB954", "#FFD700", "#2196F3", "#FF9800", "#8B5CF6"];

const formatPrice = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
    }).format(amount);
};

const formatCurrencyTooltip = (value: unknown): [string, string] => [
    formatPrice(Number(value)),
    "Doanh thu",
];

const AdminReportsPage: React.FC = () => {
    const [stats, setStats] = useState<ReportStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<ReportTab>("overview");
    const [period, setPeriod] = useState<ReportPeriod>("month");
    const [fromDate, setFromDate] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 11);
        d.setDate(1);
        return d.toISOString().slice(0, 10);
    });
    const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));

    const fetchStats = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                from: fromDate,
                to: toDate,
                period,
            });
            const res = await fetch(`/api/admin/reports/stats?${params.toString()}`);
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

            const transactionData = stats.paymentTransactions.map((tx) => ({
                "Mã đơn": tx.orderNumber,
                "Khách hàng": tx.customerName,
                "Email": tx.customerEmail,
                "Phương thức": tx.paymentMethod,
                "Số tiền (VND)": tx.totalAmount,
                "Thời gian": new Date(tx.createdAt).toLocaleString("vi-VN"),
            }));
            const wsTransactions = XLSX.utils.json_to_sheet(transactionData);
            XLSX.utils.book_append_sheet(wb, wsTransactions, "Giao dịch");

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
    }, [period, fromDate, toDate]);

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
                    <label className={styles["admin-reports-page__filter-field"]}>
                        <span>Từ ngày</span>
                        <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
                    </label>
                    <label className={styles["admin-reports-page__filter-field"]}>
                        <span>Đến ngày</span>
                        <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
                    </label>
                    <label className={styles["admin-reports-page__filter-field"]}>
                        <span>Nhóm theo</span>
                        <select value={period} onChange={(event) => setPeriod(event.target.value as ReportPeriod)}>
                            <option value="day">Ngày</option>
                            <option value="month">Tháng</option>
                            <option value="quarter">Quý</option>
                            <option value="year">Năm</option>
                        </select>
                    </label>
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

            <div className={styles["admin-reports-page__tabs"]}>
                <button
                    type="button"
                    className={`${styles["admin-reports-page__tab"]} ${
                        activeTab === "overview" ? styles["admin-reports-page__tab--active"] : ""
                    }`}
                    onClick={() => setActiveTab("overview")}
                >
                    Tổng quan biểu đồ
                </button>
                <button
                    type="button"
                    className={`${styles["admin-reports-page__tab"]} ${
                        activeTab === "transactions" ? styles["admin-reports-page__tab--active"] : ""
                    }`}
                    onClick={() => setActiveTab("transactions")}
                >
                    Giao dịch thanh toán
                </button>
            </div>

            <div className={styles["admin-reports-page__content"]}>
                {activeTab === "overview" ? (
                <>
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
                                    formatter={formatCurrencyTooltip}
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
                    {/* Cơ cấu doanh thu theo hình thức thanh toán */}
                    <section className={styles["admin-reports-page__section"]}>
                        <div className={styles["admin-reports-page__section-header"]}>
                            <h2 className={styles["admin-reports-page__section-title"]}>
                                <MdGroup /> Cơ cấu thanh toán
                            </h2>
                        </div>
                        <div className={styles["admin-reports-page__chart-container"]}>
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={stats.paymentMethodData}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={105}
                                        label={({ name }) => name}
                                    >
                                        {stats.paymentMethodData.map((_, index) => (
                                            <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={formatCurrencyTooltip}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-lg)' }}
                                    />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </section>

                    {/* Top sản phẩm bán chạy */}
                    <section className={styles["admin-reports-page__section"]}>
                        <div className={styles["admin-reports-page__section-header"]}>
                            <h2 className={styles["admin-reports-page__section-title"]}>
                                <MdInventory /> Top 5 sản phẩm bán chạy
                            </h2>
                        </div>
                        <div className={styles["admin-reports-page__chart-container"]}>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={stats.topProducts}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: 'var(--shadow-lg)' }} />
                                    <Bar dataKey="quantity" name="Số lượng bán" fill="var(--primary)" radius={[4, 4, 0, 0]} barSize={30} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </section>
                </div>

                <section className={styles["admin-reports-page__section"]}>
                    <div className={styles["admin-reports-page__section-header"]}>
                        <h2 className={styles["admin-reports-page__section-title"]}>
                            <MdAnalytics /> Doanh thu theo danh mục
                        </h2>
                    </div>
                    <div className={styles["admin-reports-page__chart-container"]}>
                        <ResponsiveContainer width="100%" height={320}>
                            <PieChart>
                                <Pie
                                    data={stats.categoryRevenueData}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={62}
                                    outerRadius={112}
                                    label={({ name }) => name}
                                >
                                    {stats.categoryRevenueData.map((_, index) => (
                                        <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={formatCurrencyTooltip} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </section>

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
                </>
                ) : (
                <section className={styles["admin-reports-page__section"]}>
                    <div className={styles["admin-reports-page__section-header"]}>
                        <h2 className={styles["admin-reports-page__section-title"]}>
                            <MdFileDownload /> Giao dịch thanh toán
                        </h2>
                    </div>
                    <div className={styles["admin-reports-page__table-wrapper"]}>
                        <table className={styles["admin-reports-page__table"]}>
                            <thead>
                                <tr>
                                    <th>Mã đơn</th>
                                    <th>Khách hàng</th>
                                    <th>Email</th>
                                    <th>Phương thức</th>
                                    <th>Thời gian</th>
                                    <th style={{ textAlign: "right" }}>Số tiền</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.paymentTransactions.map((tx) => (
                                    <tr key={tx.id}>
                                        <td className={styles["admin-reports-page__product-name"]}>
                                            {tx.orderNumber}
                                        </td>
                                        <td>{tx.customerName}</td>
                                        <td>{tx.customerEmail ?? "N/A"}</td>
                                        <td>{tx.paymentMethod}</td>
                                        <td>{new Date(tx.createdAt).toLocaleString("vi-VN")}</td>
                                        <td style={{ textAlign: "right", fontWeight: 700, color: "var(--primary)" }}>
                                            {formatPrice(tx.totalAmount)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
                )}
            </div>
        </div>
    );
};

export default AdminReportsPage;
