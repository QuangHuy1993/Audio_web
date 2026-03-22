"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  MdSmartToy,
  MdQueryStats,
  MdSpeed,
  MdFlag,
  MdRefresh,
  MdOpenInNew,
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
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { toast } from "sonner";
import styles from "./AdminAiDashboardPage.module.css";

type AiSessionSummary = {
  id: string;
  createdAt: string;
  type: string;
  userEmail: string | null;
  inputPreview: string;
  model: string | null;
  latencyMs: number | null;
  flagged: boolean;
};

type AiStats = {
  todayCount: number;
  yesterdayCount: number;
  monthCount: number;
  lastMonthCount: number;
  flaggedCount: number;
  avgLatencyMs: number;
  suggestedProductsRate: number;
  flaggedRate: number;
  chartData: { date: string; ADVICE: number; RECOMMENDATION: number; COMPARISON: number; SEARCH: number }[];
  typeBreakdown: { ADVICE: number; RECOMMENDATION: number; COMPARISON: number; SEARCH: number };
  recentSessions: AiSessionSummary[];
};

const TYPE_COLORS: Record<string, string> = {
  ADVICE: "var(--primary)",
  RECOMMENDATION: "#f59e0b",
  COMPARISON: "#8b5cf6",
  SEARCH: "#6b7280",
};

const PIE_COLORS = ["var(--primary)", "#f59e0b", "#8b5cf6", "#6b7280"];

const TYPE_LABELS: Record<string, string> = {
  ADVICE: "Tư vấn",
  RECOMMENDATION: "Gợi ý setup",
  COMPARISON: "So sánh",
  SEARCH: "Tìm kiếm",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function diffPercent(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? "+100%" : "0%";
  const pct = Math.round(((current - previous) / previous) * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

const AdminAiDashboardPage: React.FC = () => {
  const [stats, setStats] = useState<AiStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/ai/stats");
      if (!res.ok) throw new Error("Lỗi tải dữ liệu");
      const data = await res.json();
      setStats(data);
    } catch {
      toast.error("Không thể tải thống kê AI.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const pieData = stats
    ? Object.entries(stats.typeBreakdown).map(([name, value]) => ({ name, value }))
    : [];

  const chartDataFormatted = (stats?.chartData ?? []).map((d) => ({
    ...d,
    date: formatDate(d.date),
  }));

  return (
    <div className={styles["admin-ai-dashboard-page"]}>
      <div className={styles["admin-ai-dashboard-page__header"]}>
        <div className={styles["admin-ai-dashboard-page__header-left"]}>
          <MdSmartToy className={styles["admin-ai-dashboard-page__header-icon"]} />
          <div>
            <h1 className={styles["admin-ai-dashboard-page__title"]}>Quản lý AI</h1>
            <p className={styles["admin-ai-dashboard-page__subtitle"]}>
              Tổng quan hoạt động AI – chatbot tư vấn, gợi ý, so sánh
            </p>
          </div>
        </div>
        <div className={styles["admin-ai-dashboard-page__header-actions"]}>
          <button
            type="button"
            className={styles["admin-ai-dashboard-page__btn-refresh"]}
            onClick={fetchStats}
            disabled={isLoading}
          >
            <MdRefresh />
            Làm mới
          </button>
        </div>
      </div>

      {/* Sub-nav */}
      <nav className={styles["admin-ai-dashboard-page__subnav"]}>
        <Link href="/admin/ai" className={`${styles["admin-ai-dashboard-page__subnav-link"]} ${styles["admin-ai-dashboard-page__subnav-link--active"]}`}>
          Tổng quan
        </Link>
        <Link href="/admin/ai/sessions" className={styles["admin-ai-dashboard-page__subnav-link"]}>
          Lịch sử phiên
        </Link>
        <Link href="/admin/ai/content" className={styles["admin-ai-dashboard-page__subnav-link"]}>
          Nội dung AI
        </Link>
        <Link href="/admin/ai/settings" className={styles["admin-ai-dashboard-page__subnav-link"]}>
          Cài đặt
        </Link>
        <Link href="/admin/ai/prompts" className={styles["admin-ai-dashboard-page__subnav-link"]}>
          Prompt
        </Link>
        <Link href="/admin/ai/batch" className={styles["admin-ai-dashboard-page__subnav-link"]}>
          Sinh hàng loạt
        </Link>
        <Link href="/admin/ai/demo-products" className={styles["admin-ai-dashboard-page__subnav-link"]}>
          Sản phẩm mẫu
        </Link>
      </nav>

      {isLoading && (
        <div className={styles["admin-ai-dashboard-page__loading"]}>
          Đang tải thống kê...
        </div>
      )}

      {!isLoading && stats && (
        <>
          {/* Stat Cards */}
          <div className={styles["admin-ai-dashboard-page__stat-grid"]}>
            <div className={styles["admin-ai-dashboard-page__stat-card"]}>
              <div className={styles["admin-ai-dashboard-page__stat-card-icon"]} style={{ background: "rgba(var(--primary-rgb,79,70,229),0.12)" }}>
                <MdSmartToy style={{ color: "var(--primary)" }} />
              </div>
              <div>
                <p className={styles["admin-ai-dashboard-page__stat-label"]}>Phiên AI hôm nay</p>
                <p className={styles["admin-ai-dashboard-page__stat-value"]}>{stats.todayCount.toLocaleString()}</p>
                <p className={styles["admin-ai-dashboard-page__stat-diff"]}>
                  {diffPercent(stats.todayCount, stats.yesterdayCount)} so với hôm qua
                </p>
              </div>
            </div>

            <div className={styles["admin-ai-dashboard-page__stat-card"]}>
              <div className={styles["admin-ai-dashboard-page__stat-card-icon"]} style={{ background: "rgba(245,158,11,0.12)" }}>
                <MdQueryStats style={{ color: "#f59e0b" }} />
              </div>
              <div>
                <p className={styles["admin-ai-dashboard-page__stat-label"]}>Phiên AI tháng này</p>
                <p className={styles["admin-ai-dashboard-page__stat-value"]}>{stats.monthCount.toLocaleString()}</p>
                <p className={styles["admin-ai-dashboard-page__stat-diff"]}>
                  {diffPercent(stats.monthCount, stats.lastMonthCount)} so với tháng trước
                </p>
              </div>
            </div>

            <div className={styles["admin-ai-dashboard-page__stat-card"]}>
              <div className={styles["admin-ai-dashboard-page__stat-card-icon"]} style={{ background: "rgba(139,92,246,0.12)" }}>
                <MdSpeed style={{ color: "#8b5cf6" }} />
              </div>
              <div>
                <p className={styles["admin-ai-dashboard-page__stat-label"]}>Latency trung bình</p>
                <p className={styles["admin-ai-dashboard-page__stat-value"]}>
                  {stats.avgLatencyMs > 0 ? `${stats.avgLatencyMs}ms` : "—"}
                </p>
                <p className={styles["admin-ai-dashboard-page__stat-diff"]}>
                  Tỉ lệ có SP gợi ý: {Math.round(stats.suggestedProductsRate * 100)}%
                </p>
              </div>
            </div>

            <div className={styles["admin-ai-dashboard-page__stat-card"]}>
              <div className={styles["admin-ai-dashboard-page__stat-card-icon"]} style={{ background: "rgba(239,68,68,0.12)" }}>
                <MdFlag style={{ color: "#ef4444" }} />
              </div>
              <div>
                <p className={styles["admin-ai-dashboard-page__stat-label"]}>Phiên bị đánh dấu</p>
                <p className={styles["admin-ai-dashboard-page__stat-value"]}>{stats.flaggedCount}</p>
                <p className={styles["admin-ai-dashboard-page__stat-diff"]}>
                  Tỉ lệ: {Math.round(stats.flaggedRate * 10000) / 100}%
                </p>
              </div>
            </div>
          </div>

          {/* Charts row */}
          <div className={styles["admin-ai-dashboard-page__charts-row"]}>
            <div className={styles["admin-ai-dashboard-page__chart-card"]}>
              <h3 className={styles["admin-ai-dashboard-page__chart-title"]}>
                Số phiên AI theo ngày (7 ngày gần nhất)
              </h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartDataFormatted} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="ADVICE" name="Tư vấn" fill={TYPE_COLORS.ADVICE} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="RECOMMENDATION" name="Gợi ý" fill={TYPE_COLORS.RECOMMENDATION} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="COMPARISON" name="So sánh" fill={TYPE_COLORS.COMPARISON} radius={[2, 2, 0, 0]} />
                  <Bar dataKey="SEARCH" name="Tìm kiếm" fill={TYPE_COLORS.SEARCH} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className={styles["admin-ai-dashboard-page__chart-card"]}>
              <h3 className={styles["admin-ai-dashboard-page__chart-title"]}>Phân bổ loại phiên AI</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      (percent ?? 0) > 0 ? `${TYPE_LABELS[name ?? ""] ?? name} ${Math.round((percent ?? 0) * 100)}%` : ""
                    }
                    labelLine={false}
                  >
                    {pieData.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [value, TYPE_LABELS[name as string] ?? name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className={styles["admin-ai-dashboard-page__pie-legend"]}>
                {Object.entries(stats.typeBreakdown).map(([type, count], idx) => (
                  <div key={type} className={styles["admin-ai-dashboard-page__pie-legend-item"]}>
                    <span
                      className={styles["admin-ai-dashboard-page__pie-legend-dot"]}
                      style={{ background: PIE_COLORS[idx % PIE_COLORS.length] }}
                    />
                    <span>{TYPE_LABELS[type]}: {count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Sessions */}
          <div className={styles["admin-ai-dashboard-page__recent-card"]}>
            <div className={styles["admin-ai-dashboard-page__recent-header"]}>
              <h3 className={styles["admin-ai-dashboard-page__chart-title"]}>
                Phiên AI gần nhất
              </h3>
              <Link href="/admin/ai/sessions" className={styles["admin-ai-dashboard-page__view-all"]}>
                Xem tất cả <MdOpenInNew />
              </Link>
            </div>
            <div className={styles["admin-ai-dashboard-page__table-wrapper"]}>
              <table className={styles["admin-ai-dashboard-page__table"]}>
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>User</th>
                    <th>Loại</th>
                    <th>Input</th>
                    <th>Model</th>
                    <th>Latency</th>
                    <th>Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentSessions.map((s) => (
                    <tr key={s.id}>
                      <td className={styles["admin-ai-dashboard-page__td-time"]}>
                        {formatDateTime(s.createdAt)}
                      </td>
                      <td className={styles["admin-ai-dashboard-page__td-user"]}>
                        {s.userEmail ?? <span className={styles["admin-ai-dashboard-page__anonymous"]}>Khách</span>}
                      </td>
                      <td>
                        <span
                          className={styles["admin-ai-dashboard-page__type-badge"]}
                          style={{ background: `${TYPE_COLORS[s.type]}22`, color: TYPE_COLORS[s.type] }}
                        >
                          {TYPE_LABELS[s.type] ?? s.type}
                        </span>
                      </td>
                      <td className={styles["admin-ai-dashboard-page__td-input"]} title={s.inputPreview}>
                        {s.inputPreview.slice(0, 70)}{s.inputPreview.length > 70 ? "..." : ""}
                      </td>
                      <td className={styles["admin-ai-dashboard-page__td-model"]}>
                        {s.model ? s.model.split("-").slice(0, 2).join("-") : "—"}
                      </td>
                      <td className={styles["admin-ai-dashboard-page__td-latency"]}>
                        {s.latencyMs != null ? `${s.latencyMs}ms` : "—"}
                      </td>
                      <td>
                        {s.flagged && (
                          <MdFlag className={styles["admin-ai-dashboard-page__flag-icon"]} />
                        )}
                      </td>
                    </tr>
                  ))}
                  {stats.recentSessions.length === 0 && (
                    <tr>
                      <td colSpan={7} className={styles["admin-ai-dashboard-page__empty"]}>
                        Chưa có phiên AI nào được ghi nhận.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminAiDashboardPage;
