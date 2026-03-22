"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  MdFlag,
  MdOutlineFlag,
  MdSearch,
  MdFilterList,
  MdChevronLeft,
  MdChevronRight,
  MdClose,
  MdFileDownload,
  MdRefresh,
} from "react-icons/md";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import clsx from "clsx";
import DataLoadingOverlay from "@/components/shared/DataLoadingOverlay";
import styles from "./AdminAiSessionListPage.module.css";

type AiSessionItem = {
  id: string;
  createdAt: string;
  type: string;
  userId: string | null;
  userEmail: string | null;
  inputPreview: string;
  model: string | null;
  latencyMs: number | null;
  flagged: boolean;
  flagReason: string | null;
  hasSuggestedProducts: boolean;
};

type AiSessionDetail = AiSessionItem & {
  inputFull: string;
  outputFull: string;
  metadata: Record<string, unknown> | null;
  userName: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  ADVICE: "Tư vấn",
  RECOMMENDATION: "Gợi ý",
  COMPARISON: "So sánh",
  SEARCH: "Tìm kiếm",
};

const TYPE_COLORS: Record<string, string> = {
  ADVICE: "var(--primary)",
  RECOMMENDATION: "#f59e0b",
  COMPARISON: "#8b5cf6",
  SEARCH: "#6b7280",
};

const FLAG_REASONS = [
  "Trả lời sai thông tin",
  "Không liên quan đến sản phẩm",
  "Thái độ không phù hợp",
  "Chậm / timeout",
  "Khác",
];

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const PAGE_SIZE = 20;

const AdminAiSessionListPage: React.FC = () => {
  const [items, setItems] = useState<AiSessionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(true);
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Detail modal
  const [detailSession, setDetailSession] = useState<AiSessionDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Flag popover
  const [flaggingId, setFlaggingId] = useState<string | null>(null);
  const [flagReasonInput, setFlagReasonInput] = useState("");

  const fetchSessions = useCallback(async () => {
    const start = performance.now();
    setIsLoading(true);
    setShowLoadingOverlay(true);
    if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);

    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
    });
    if (typeFilter.length > 0) params.set("type", typeFilter.join(","));
    if (flaggedOnly) params.set("flagged", "true");
    if (search) params.set("search", search);

    try {
      const res = await fetch(`/api/admin/ai/sessions?${params.toString()}`);
      if (!res.ok) throw new Error("Lỗi tải danh sách");
      const data = await res.json();
      setItems(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch {
      toast.error("Không thể tải danh sách phiên AI.");
    } finally {
      const elapsed = performance.now() - start;
      const minDisplay = 1200;
      const remaining = Math.max(0, minDisplay - elapsed);
      loadingTimerRef.current = setTimeout(() => {
        setIsLoading(false);
        setShowLoadingOverlay(false);
      }, remaining);
    }
  }, [page, typeFilter, flaggedOnly, search]);

  useEffect(() => {
    fetchSessions();
    return () => {
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    };
  }, [fetchSessions]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  const toggleType = (t: string) => {
    setTypeFilter((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
    setPage(1);
  };

  const openDetail = async (id: string) => {
    setIsLoadingDetail(true);
    setDetailSession(null);
    try {
      const res = await fetch(`/api/admin/ai/sessions/${id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDetailSession(data);
    } catch {
      toast.error("Không thể tải chi tiết phiên AI.");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleFlag = async (id: string, flagged: boolean, reason?: string) => {
    try {
      const res = await fetch(`/api/admin/ai/sessions/${id}/flag`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flagged, flagReason: reason }),
      });
      if (!res.ok) throw new Error();
      setItems((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, flagged, flagReason: reason ?? null } : s,
        ),
      );
      if (detailSession?.id === id) {
        setDetailSession((prev) =>
          prev ? { ...prev, flagged, flagReason: reason ?? null } : prev,
        );
      }
      toast.success(flagged ? "Đã đánh dấu phiên AI." : "Đã bỏ đánh dấu.");
      setFlaggingId(null);
      setFlagReasonInput("");
    } catch {
      toast.error("Cập nhật flag thất bại.");
    }
  };

  const exportXLSX = async () => {
    toast.info("Đang xuất dữ liệu...");
    try {
      const params = new URLSearchParams({ page: "1", limit: "1000" });
      if (typeFilter.length > 0) params.set("type", typeFilter.join(","));
      if (flaggedOnly) params.set("flagged", "true");
      if (search) params.set("search", search);

      const res = await fetch(`/api/admin/ai/sessions?${params.toString()}`);
      const data = await res.json();

      const rows = data.items.map((s: AiSessionItem) => ({
        ID: s.id,
        "Thời gian": formatDateTime(s.createdAt),
        User: s.userEmail ?? "Khách",
        Loại: TYPE_LABELS[s.type] ?? s.type,
        Input: s.inputPreview,
        Model: s.model ?? "",
        "Latency (ms)": s.latencyMs ?? "",
        "Có SP gợi ý": s.hasSuggestedProducts ? "Có" : "Không",
        Flag: s.flagged ? "Có" : "",
        "Lý do flag": s.flagReason ?? "",
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "AI Sessions");
      XLSX.writeFile(wb, `ai-sessions-${new Date().toISOString().split("T")[0]}.xlsx`);
      toast.success("Xuất XLSX thành công.");
    } catch {
      toast.error("Xuất dữ liệu thất bại.");
    }
  };

  return (
    <div className={styles["admin-ai-sessions-page"]}>
      <div className={styles["admin-ai-sessions-page__header"]}>
        <div>
          <h1 className={styles["admin-ai-sessions-page__title"]}>Lịch sử phiên AI</h1>
          <p className={styles["admin-ai-sessions-page__subtitle"]}>
            Toàn bộ phiên tư vấn AI – tổng {total.toLocaleString()} phiên
          </p>
        </div>
        <div className={styles["admin-ai-sessions-page__header-actions"]}>
          <button type="button" className={styles["admin-ai-sessions-page__btn-secondary"]} onClick={fetchSessions}>
            <MdRefresh /> Làm mới
          </button>
          <button type="button" className={styles["admin-ai-sessions-page__btn-secondary"]} onClick={exportXLSX}>
            <MdFileDownload /> Xuất XLSX
          </button>
        </div>
      </div>

      {/* Sub-nav */}
      <nav className={styles["admin-ai-sessions-page__subnav"]}>
        <Link href="/admin/ai" className={styles["admin-ai-sessions-page__subnav-link"]}>Tổng quan</Link>
        <Link href="/admin/ai/sessions" className={`${styles["admin-ai-sessions-page__subnav-link"]} ${styles["admin-ai-sessions-page__subnav-link--active"]}`}>Lịch sử phiên</Link>
        <Link href="/admin/ai/content" className={styles["admin-ai-sessions-page__subnav-link"]}>Nội dung AI</Link>
        <Link href="/admin/ai/settings" className={styles["admin-ai-sessions-page__subnav-link"]}>Cài đặt</Link>
        <Link href="/admin/ai/prompts" className={styles["admin-ai-sessions-page__subnav-link"]}>Prompt</Link>
        <Link href="/admin/ai/batch" className={styles["admin-ai-sessions-page__subnav-link"]}>Sinh hàng loạt</Link>
        <Link href="/admin/ai/demo-products" className={styles["admin-ai-sessions-page__subnav-link"]}>Sản phẩm mẫu</Link>
      </nav>

      {/* Search + Filter bar */}
      <div className={styles["admin-ai-sessions-page__toolbar"]}>
        <form onSubmit={handleSearch} className={styles["admin-ai-sessions-page__search-form"]}>
          <div className={styles["admin-ai-sessions-page__search-wrapper"]}>
            <MdSearch className={styles["admin-ai-sessions-page__search-icon"]} />
            <input
              type="text"
              className={styles["admin-ai-sessions-page__search-input"]}
              placeholder="Tìm theo nội dung câu hỏi..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <button type="submit" className={styles["admin-ai-sessions-page__btn-primary"]}>
            Tìm kiếm
          </button>
        </form>

        <div className={styles["admin-ai-sessions-page__filter-actions"]}>
          <button
            type="button"
            className={clsx(styles["admin-ai-sessions-page__btn-secondary"], flaggedOnly && styles["admin-ai-sessions-page__btn-active"])}
            onClick={() => { setFlaggedOnly((v) => !v); setPage(1); }}
          >
            <MdFlag /> {flaggedOnly ? "Tất cả" : "Chỉ đã flag"}
          </button>
          <button
            type="button"
            className={clsx(styles["admin-ai-sessions-page__btn-secondary"], showFilters && styles["admin-ai-sessions-page__btn-active"])}
            onClick={() => setShowFilters((v) => !v)}
          >
            <MdFilterList /> Lọc loại
          </button>
        </div>
      </div>

      {showFilters && (
        <div className={styles["admin-ai-sessions-page__filter-panel"]}>
          <span className={styles["admin-ai-sessions-page__filter-label"]}>Loại phiên:</span>
          {Object.keys(TYPE_LABELS).map((t) => (
            <button
              key={t}
              type="button"
              className={clsx(
                styles["admin-ai-sessions-page__filter-chip"],
                typeFilter.includes(t) && styles["admin-ai-sessions-page__filter-chip--active"],
              )}
              style={typeFilter.includes(t) ? { borderColor: TYPE_COLORS[t], color: TYPE_COLORS[t] } : {}}
              onClick={() => toggleType(t)}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
          {typeFilter.length > 0 && (
            <button
              type="button"
              className={styles["admin-ai-sessions-page__filter-clear"]}
              onClick={() => { setTypeFilter([]); setPage(1); }}
            >
              Xóa lọc
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div className={styles["admin-ai-sessions-page__table-wrapper"]}>
        <DataLoadingOverlay
          isActive={showLoadingOverlay}
          title="Đức Uy Audio"
          subtitle="Đang tải lịch sử phiên AI..."
          bottomText="Đang đồng bộ dữ liệu từ hệ thống..."
        />

        {!isLoading && (
          <table className={styles["admin-ai-sessions-page__table"]}>
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>User</th>
                <th>Loại</th>
                <th>Nội dung câu hỏi</th>
                <th>Model</th>
                <th>Latency</th>
                <th>SP gợi ý</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} className={s.flagged ? styles["admin-ai-sessions-page__row--flagged"] : ""}>
                  <td className={styles["admin-ai-sessions-page__td-time"]}>
                    {formatDateTime(s.createdAt)}
                  </td>
                  <td className={styles["admin-ai-sessions-page__td-user"]}>
                    {s.userEmail ?? <span className={styles["admin-ai-sessions-page__anonymous"]}>Khách ẩn danh</span>}
                  </td>
                  <td>
                    <span
                      className={styles["admin-ai-sessions-page__type-badge"]}
                      style={{ background: `${TYPE_COLORS[s.type]}22`, color: TYPE_COLORS[s.type] }}
                    >
                      {TYPE_LABELS[s.type] ?? s.type}
                    </span>
                  </td>
                  <td className={styles["admin-ai-sessions-page__td-input"]} title={s.inputPreview}>
                    {s.inputPreview.slice(0, 100)}{s.inputPreview.length > 100 ? "..." : ""}
                  </td>
                  <td className={styles["admin-ai-sessions-page__td-model"]}>
                    {s.model ? s.model.split("-").slice(0, 2).join("-") : "—"}
                  </td>
                  <td className={styles["admin-ai-sessions-page__td-latency"]}>
                    {s.latencyMs != null ? `${s.latencyMs}ms` : "—"}
                  </td>
                  <td>
                    {s.hasSuggestedProducts ? (
                      <span className={styles["admin-ai-sessions-page__badge-yes"]}>Có</span>
                    ) : (
                      <span className={styles["admin-ai-sessions-page__badge-no"]}>Không</span>
                    )}
                  </td>
                  <td>
                    <div className={styles["admin-ai-sessions-page__actions"]}>
                      <button
                        type="button"
                        className={styles["admin-ai-sessions-page__btn-view"]}
                        onClick={() => openDetail(s.id)}
                      >
                        Xem
                      </button>
                      <button
                        type="button"
                        className={clsx(
                          styles["admin-ai-sessions-page__btn-flag"],
                          s.flagged && styles["admin-ai-sessions-page__btn-flag--active"],
                        )}
                        title={s.flagged ? "Bỏ đánh dấu" : "Đánh dấu kém"}
                        onClick={() => {
                          if (s.flagged) {
                            handleFlag(s.id, false);
                          } else {
                            setFlaggingId(s.id);
                            setFlagReasonInput("");
                          }
                        }}
                      >
                        {s.flagged ? <MdFlag /> : <MdOutlineFlag />}
                      </button>
                    </div>

                    {/* Flag reason popover */}
                    {flaggingId === s.id && (
                      <div className={styles["admin-ai-sessions-page__flag-popover"]}>
                        <p className={styles["admin-ai-sessions-page__flag-popover-title"]}>Lý do đánh dấu</p>
                        <div className={styles["admin-ai-sessions-page__flag-reasons"]}>
                          {FLAG_REASONS.map((r) => (
                            <button
                              key={r}
                              type="button"
                              className={clsx(
                                styles["admin-ai-sessions-page__flag-reason-btn"],
                                flagReasonInput === r && styles["admin-ai-sessions-page__flag-reason-btn--active"],
                              )}
                              onClick={() => setFlagReasonInput(r)}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                        <div className={styles["admin-ai-sessions-page__flag-popover-actions"]}>
                          <button
                            type="button"
                            className={styles["admin-ai-sessions-page__btn-primary"]}
                            onClick={() => handleFlag(s.id, true, flagReasonInput || undefined)}
                          >
                            Xác nhận
                          </button>
                          <button
                            type="button"
                            className={styles["admin-ai-sessions-page__btn-secondary"]}
                            onClick={() => setFlaggingId(null)}
                          >
                            Hủy
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}

              {!isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={8} className={styles["admin-ai-sessions-page__empty"]}>
                    Không có phiên AI nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles["admin-ai-sessions-page__pagination"]}>
          <button
            type="button"
            className={styles["admin-ai-sessions-page__btn-page"]}
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <MdChevronLeft />
          </button>
          <span className={styles["admin-ai-sessions-page__page-info"]}>
            Trang {page} / {totalPages}
          </span>
          <button
            type="button"
            className={styles["admin-ai-sessions-page__btn-page"]}
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <MdChevronRight />
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {(detailSession || isLoadingDetail) && (
        <div
          className={styles["admin-ai-sessions-page__modal-overlay"]}
          onClick={(e) => { if (e.target === e.currentTarget) setDetailSession(null); }}
        >
          <div className={styles["admin-ai-sessions-page__modal"]}>
            <div className={styles["admin-ai-sessions-page__modal-header"]}>
              <div>
                <h2 className={styles["admin-ai-sessions-page__modal-title"]}>
                  Chi tiết phiên AI
                </h2>
                {detailSession && (
                  <p className={styles["admin-ai-sessions-page__modal-meta"]}>
                    {TYPE_LABELS[detailSession.type] ?? detailSession.type}
                    {" · "}
                    {formatDateTime(detailSession.createdAt)}
                    {detailSession.model && ` · ${detailSession.model}`}
                  </p>
                )}
              </div>
              <button
                type="button"
                className={styles["admin-ai-sessions-page__modal-close"]}
                onClick={() => setDetailSession(null)}
              >
                <MdClose />
              </button>
            </div>

            {isLoadingDetail && (
              <div className={styles["admin-ai-sessions-page__modal-loading"]}>Đang tải...</div>
            )}

            {detailSession && (
              <div className={styles["admin-ai-sessions-page__modal-body"]}>
                <div className={styles["admin-ai-sessions-page__modal-info-row"]}>
                  <span>User:</span>
                  <span>{detailSession.userEmail ?? "Khách ẩn danh"}</span>
                </div>
                {detailSession.latencyMs != null && (
                  <div className={styles["admin-ai-sessions-page__modal-info-row"]}>
                    <span>Latency:</span>
                    <span>{detailSession.latencyMs}ms</span>
                  </div>
                )}

                <div className={styles["admin-ai-sessions-page__modal-section"]}>
                  <p className={styles["admin-ai-sessions-page__modal-section-label"]}>Input (câu hỏi)</p>
                  <pre className={styles["admin-ai-sessions-page__modal-pre"]}>{detailSession.inputFull}</pre>
                </div>

                <div className={styles["admin-ai-sessions-page__modal-section"]}>
                  <p className={styles["admin-ai-sessions-page__modal-section-label"]}>Output (trả lời AI)</p>
                  <pre className={styles["admin-ai-sessions-page__modal-pre"]}>{detailSession.outputFull}</pre>
                </div>

                {detailSession.metadata && (
                  <div className={styles["admin-ai-sessions-page__modal-section"]}>
                    <p className={styles["admin-ai-sessions-page__modal-section-label"]}>Metadata</p>
                    <pre className={styles["admin-ai-sessions-page__modal-pre"]} style={{ fontSize: 11 }}>
                      {JSON.stringify(detailSession.metadata, null, 2)}
                    </pre>
                  </div>
                )}

                <div className={styles["admin-ai-sessions-page__modal-footer"]}>
                  <button
                    type="button"
                    className={clsx(
                      styles["admin-ai-sessions-page__btn-secondary"],
                      detailSession.flagged && styles["admin-ai-sessions-page__btn-active"],
                    )}
                    onClick={() => {
                      if (detailSession.flagged) {
                        handleFlag(detailSession.id, false);
                      } else {
                        setFlaggingId(detailSession.id);
                      }
                    }}
                  >
                    <MdFlag />
                    {detailSession.flagged ? "Bỏ đánh dấu" : "Đánh dấu kém chất lượng"}
                  </button>
                  <button
                    type="button"
                    className={styles["admin-ai-sessions-page__btn-secondary"]}
                    onClick={() => setDetailSession(null)}
                  >
                    Đóng
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAiSessionListPage;
