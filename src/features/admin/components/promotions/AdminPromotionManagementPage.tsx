"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MdAdd,
  MdChevronLeft,
  MdChevronRight,
  MdCheckCircle,
  MdLocalShipping,
  MdPayments,
  MdPercent,
  MdSearch,
  MdEdit,
  MdDelete,
  MdAutoAwesome,
} from "react-icons/md";
import { toast } from "sonner";
import ConfirmActionDialog from "@/components/shared/ConfirmActionDialog";
import DataLoadingOverlay from "@/components/shared/DataLoadingOverlay";
import styles from "./AdminPromotionManagementPage.module.css";

type CouponType = "PERCENTAGE" | "FIXED" | "FREE_SHIPPING";
type StatusFilter = "all" | "active" | "scheduled" | "expired";
type TypeFilter = "all" | CouponType;

type CouponListItem = {
  id: string;
  code: string;
  description: string | null;
  type: CouponType;
  value: number | null;
  maxDiscount: number | null;
  minOrderAmount: number | null;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ListResponse = {
  data: CouponListItem[];
  total: number;
  page: number;
  pageSize: number;
};

const PAGE_SIZE = 10;
const MIN_LOADING_MS = 1200;

function getRowStatus(
  isActive: boolean,
  startsAt: string | null,
  endsAt: string | null,
  now: Date,
): "active" | "scheduled" | "expired" {
  if (!isActive) return "expired";
  const start = startsAt ? new Date(startsAt) : null;
  const end = endsAt ? new Date(endsAt) : null;
  if (start && start > now) return "scheduled";
  if (end && end < now) return "expired";
  return "active";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatVnd(n: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(n);
}

const AdminPromotionManagementPage: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialPage = Math.max(Number(searchParams?.get("page")) || 1, 1);
  const initialSearch = searchParams?.get("search") ?? "";
  const initialStatus = (searchParams?.get("status") as StatusFilter) ?? "all";
  const initialType = (searchParams?.get("type") as TypeFilter) ?? "all";

  const [searchInput, setSearchInput] = useState(initialSearch);
  const [statusInput, setStatusInput] = useState<StatusFilter>(initialStatus);
  const [typeInput, setTypeInput] = useState<TypeFilter>(initialType);
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState<StatusFilter>(initialStatus);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(initialType);
  const [page, setPage] = useState(initialPage);

  const [coupons, setCoupons] = useState<CouponListItem[]>([]);
  const [total, setTotal] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [couponToDelete, setCouponToDelete] = useState<CouponListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchCoupons = async (controller?: AbortController) => {
    setIsLoading(true);
    setError(null);
    setShowLoadingOverlay(true);
    const startedAt = performance.now();

    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      if (search.trim()) params.set("search", search.trim());
      if (status !== "all") params.set("status", status);
      if (typeFilter !== "all") params.set("type", typeFilter);

      const response = await fetch(`/api/admin/coupons?${params.toString()}`, {
        signal: controller?.signal,
      });

      if (!response.ok) {
        if (response.status === 403) {
          setError("Bạn không có quyền xem trang này.");
          setCoupons([]);
          setTotal(0);
          return;
        }
        throw new Error("Không thể tải danh sách mã giảm giá.");
      }

      const json = (await response.json()) as ListResponse;
      setCoupons(json.data);
      setTotal(json.total);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError("Đã xảy ra lỗi khi tải danh sách mã giảm giá.");
      setCoupons([]);
      setTotal(0);
    } finally {
      const elapsed = performance.now() - startedAt;
      const remaining = MIN_LOADING_MS - elapsed;
      const done = () => {
        setIsLoading(false);
        setShowLoadingOverlay(false);
      };
      if (remaining > 0) setTimeout(done, remaining);
      else done();
    }
  };

  useEffect(() => {
    const ctrl = new AbortController();
    void fetchCoupons(ctrl);
    return () => ctrl.abort();
  }, [page, search, status, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = total === 0 ? 0 : Math.min(page * PAGE_SIZE, total);

  const pagesToRender = useMemo(() => {
    const pages: number[] = [];
    const maxVisible = 4;
    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }
    pages.push(1);
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (!pages.includes(totalPages)) pages.push(totalPages);
    return pages;
  }, [page, totalPages]);

  const totalRedemptionsPage = useMemo(
    () => coupons.reduce((sum, c) => sum + c.usedCount, 0),
    [coupons],
  );

  const activeCountPage = useMemo(
    () => {
      const now = new Date();
      return coupons.filter(
        (c) =>
          getRowStatus(c.isActive, c.startsAt, c.endsAt, now) === "active",
      ).length;
    },
    [coupons],
  );

  const handleApplyFilters = () => {
    setSearch(searchInput.trim());
    setStatus(statusInput);
    setTypeFilter(typeInput);
    setPage(1);
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("pageSize", String(PAGE_SIZE));
    if (searchInput.trim()) params.set("search", searchInput.trim());
    if (statusInput !== "all") params.set("status", statusInput);
    if (typeInput !== "all") params.set("type", typeInput);
    router.push(`/admin/promotions?${params.toString()}`);
  };

  const handlePageChange = (p: number) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
    const params = new URLSearchParams();
    params.set("page", String(p));
    params.set("pageSize", String(PAGE_SIZE));
    if (search.trim()) params.set("search", search.trim());
    if (status !== "all") params.set("status", status);
    if (typeFilter !== "all") params.set("type", typeFilter);
    router.push(`/admin/promotions?${params.toString()}`);
  };

  const handleToggleActive = async (c: CouponListItem) => {
    const nextActive = !c.isActive;
    setTogglingId(c.id);
    try {
      const res = await fetch(`/api/admin/coupons/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextActive }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Không thể cập nhật trạng thái.");
        return;
      }
      toast.success(nextActive ? "Đã bật mã giảm giá." : "Đã tắt mã giảm giá.");
      void fetchCoupons();
    } catch {
      toast.error("Đã xảy ra lỗi khi cập nhật.");
    } finally {
      setTogglingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!couponToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/coupons/${couponToDelete.id}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string; success?: boolean };
      if (!res.ok || data.success !== true) {
        toast.error(data.error ?? "Không thể vô hiệu hoá mã.");
        return;
      }
      toast.success(`Đã vô hiệu hoá mã "${couponToDelete.code}".`);
      setCouponToDelete(null);
      void fetchCoupons();
    } catch {
      toast.error("Đã xảy ra lỗi khi xoá.");
    } finally {
      setIsDeleting(false);
    }
  };

  const typeLabel = (t: CouponType): string => {
    if (t === "PERCENTAGE") return "Phần trăm";
    if (t === "FIXED") return "Số tiền cố định";
    return "Miễn phí ship";
  };

  const valueDisplay = (c: CouponListItem): string => {
    if (c.type === "PERCENTAGE" && c.value != null) {
      return `${c.value}%`;
    }
    if (c.type === "FIXED" && c.value != null) {
      return formatVnd(c.value);
    }
    if (c.type === "FREE_SHIPPING") {
      return c.value != null ? formatVnd(c.value) : "Miễn toàn bộ";
    }
    return "—";
  };

  const now = new Date();

  return (
    <div className={styles["admin-promotion-management-page"]}>
      <header className={styles["admin-promotion-management-page__header"]}>
        <div className={styles["admin-promotion-management-page__header-inner"]}>
          <h1 className={styles["admin-promotion-management-page__header-title"]}>
            Quản lý khuyến mãi
          </h1>
          <p className={styles["admin-promotion-management-page__header-subtitle"]}>
            Quản lý và tối ưu mã giảm giá cho cửa hàng
          </p>
        </div>
        <div className={styles["admin-promotion-management-page__header-actions"]}>
          <Link
            href="/admin/promotions/new"
            className={styles["admin-promotion-management-page__primary-button"]}
          >
            <MdAdd
              className={
                styles["admin-promotion-management-page__primary-button-icon"]
              }
            />
            Tạo mã giảm giá
          </Link>
        </div>
      </header>

      <div className={styles["admin-promotion-management-page__content"]}>
        <DataLoadingOverlay
          isActive={showLoadingOverlay}
          subtitle="Đang tải danh sách mã giảm giá..."
          bottomText="Đang đồng bộ dữ liệu khuyến mãi từ hệ thống..."
        />

        <section className={styles["admin-promotion-management-page__stats"]}>
          <div className={styles["admin-promotion-management-page__stat-card"]}>
            <MdPercent
              className={styles["admin-promotion-management-page__stat-card-icon"]}
              aria-hidden
            />
            <p className={styles["admin-promotion-management-page__stat-label"]}>
              Tổng số mã
            </p>
            <div
              className={
                styles["admin-promotion-management-page__stat-value-row"]
              }
            >
              <span
                className={
                  styles["admin-promotion-management-page__stat-value"]
                }
              >
                {total}
              </span>
            </div>
            <p className={styles["admin-promotion-management-page__stat-note"]}>
              Số mã theo bộ lọc hiện tại
            </p>
          </div>
          <div className={styles["admin-promotion-management-page__stat-card"]}>
            <MdPayments
              className={styles["admin-promotion-management-page__stat-card-icon"]}
              aria-hidden
            />
            <p className={styles["admin-promotion-management-page__stat-label"]}>
              Lượt dùng (trang này)
            </p>
            <div
              className={
                styles["admin-promotion-management-page__stat-value-row"]
              }
            >
              <span
                className={
                  styles["admin-promotion-management-page__stat-value"]
                }
              >
                {totalRedemptionsPage.toLocaleString("vi-VN")}
              </span>
            </div>
            <p className={styles["admin-promotion-management-page__stat-note"]}>
              Tổng lượt đã dùng của các mã trong trang
            </p>
          </div>
          <div className={styles["admin-promotion-management-page__stat-card"]}>
            <MdCheckCircle
              className={styles["admin-promotion-management-page__stat-card-icon"]}
              aria-hidden
            />
            <p className={styles["admin-promotion-management-page__stat-label"]}>
              Mã đang hoạt động (trang này)
            </p>
            <div
              className={
                styles["admin-promotion-management-page__stat-value-row"]
              }
            >
              <span
                className={
                  styles["admin-promotion-management-page__stat-value"]
                }
              >
                {activeCountPage}
              </span>
            </div>
            <p className={styles["admin-promotion-management-page__stat-note"]}>
              Trong khoảng thời gian hiệu lực
            </p>
          </div>
        </section>

        <section
          className={styles["admin-promotion-management-page__filter-card"]}
          aria-label="Bộ lọc mã giảm giá"
        >
          <div
            className={
              styles["admin-promotion-management-page__filter-left"]
            }
          >
            <div
              className={
                styles["admin-promotion-management-page__search-wrapper"]
              }
            >
              <MdSearch
                className={
                  styles["admin-promotion-management-page__search-icon"]
                }
              />
              <input
                type="text"
                className={
                  styles["admin-promotion-management-page__search-input"]
                }
                placeholder="Tìm theo mã hoặc mô tả..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleApplyFilters();
                }}
              />
            </div>
            <div
              className={styles["admin-promotion-management-page__type-tabs"]}
            >
              {(["all", "PERCENTAGE", "FIXED", "FREE_SHIPPING"] as const).map(
                (t) => (
                  <button
                    key={t}
                    type="button"
                    className={`${styles["admin-promotion-management-page__type-tab"]} ${typeInput === t ? styles["admin-promotion-management-page__type-tab--active"] : ""}`}
                    onClick={() => setTypeInput(t)}
                  >
                    {t === "all"
                      ? "Tất cả loại"
                      : t === "PERCENTAGE"
                        ? "Phần trăm"
                        : t === "FIXED"
                          ? "Số tiền"
                          : "Ship"}
                  </button>
                ),
              )}
            </div>
            <select
              className={styles["admin-promotion-management-page__select"]}
              aria-label="Trạng thái"
              value={statusInput}
              onChange={(e) =>
                setStatusInput(e.target.value as StatusFilter)
              }
            >
              <option value="all">Trạng thái: Tất cả</option>
              <option value="active">Đang hoạt động</option>
              <option value="scheduled">Sắp diễn ra</option>
              <option value="expired">Hết hạn</option>
            </select>
          </div>
          <button
            type="button"
            className={styles["admin-promotion-management-page__primary-button"]}
            onClick={handleApplyFilters}
          >
            Áp dụng
          </button>
        </section>

        <section
          className={styles["admin-promotion-management-page__table-card"]}
          aria-label="Bảng mã giảm giá"
        >
          <div
            className={
              styles["admin-promotion-management-page__table-wrapper"]
            }
          >
            <table className={styles["admin-promotion-management-page__table"]}>
              <thead>
                <tr
                  className={
                    styles["admin-promotion-management-page__table-head-row"]
                  }
                >
                  <th
                    className={
                      styles["admin-promotion-management-page__table-head-cell"]
                    }
                  >
                    Mã
                  </th>
                  <th
                    className={
                      styles["admin-promotion-management-page__table-head-cell"]
                    }
                  >
                    Loại
                  </th>
                  <th
                    className={
                      styles["admin-promotion-management-page__table-head-cell"]
                    }
                  >
                    Giá trị
                  </th>
                  <th
                    className={
                      styles["admin-promotion-management-page__table-head-cell"]
                    }
                  >
                    Lượt dùng
                  </th>
                  <th
                    className={
                      styles["admin-promotion-management-page__table-head-cell"]
                    }
                  >
                    Thời hạn
                  </th>
                  <th
                    className={`${styles["admin-promotion-management-page__table-head-cell"]} ${styles["admin-promotion-management-page__table-head-cell--status"]}`}
                  >
                    Trạng thái
                  </th>
                  <th
                    className={
                      styles["admin-promotion-management-page__table-head-cell"]
                    }
                  >
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {error && (
                  <tr
                    className={
                      styles["admin-promotion-management-page__table-body-row"]
                    }
                  >
                    <td
                      colSpan={7}
                      className={
                        styles["admin-promotion-management-page__empty-row"]
                      }
                    >
                      {error}
                    </td>
                  </tr>
                )}
                {!error && coupons.length === 0 && !isLoading && (
                  <tr
                    className={
                      styles["admin-promotion-management-page__table-body-row"]
                    }
                  >
                    <td
                      colSpan={7}
                      className={
                        styles["admin-promotion-management-page__empty-row"]
                      }
                    >
                      Chưa có mã giảm giá nào.
                    </td>
                  </tr>
                )}
                {!error &&
                  coupons.map((c) => {
                    const rowStatus = getRowStatus(
                      c.isActive,
                      c.startsAt,
                      c.endsAt,
                      now,
                    );
                    const limitReached =
                      c.usageLimit != null && c.usedCount >= c.usageLimit;
                    const usagePct =
                      c.usageLimit != null && c.usageLimit > 0
                        ? Math.min(100, (c.usedCount / c.usageLimit) * 100)
                        : (c.usedCount > 0 ? Math.min(100, c.usedCount / 10) : 0);

                    return (
                      <tr
                        key={c.id}
                        className={
                          styles["admin-promotion-management-page__table-body-row"]
                        }
                      >
                        <td
                          className={
                            styles["admin-promotion-management-page__table-cell"]
                          }
                        >
                          <div
                            className={
                              styles["admin-promotion-management-page__code-cell-inner"]
                            }
                          >
                            <span
                              className={
                                styles["admin-promotion-management-page__code-text"]
                              }
                            >
                              {c.code}
                            </span>
                            {c.description && (
                              <span
                                className={
                                  styles["admin-promotion-management-page__code-meta"]
                                }
                              >
                                {c.description.slice(0, 30)}
                                {c.description.length > 30 ? "..." : ""}
                              </span>
                            )}
                          </div>
                        </td>
                        <td
                          className={
                            styles["admin-promotion-management-page__table-cell"]
                          }
                        >
                          <div
                            className={
                              styles["admin-promotion-management-page__type-cell-inner"]
                            }
                          >
                            {c.type === "PERCENTAGE" && (
                              <MdPercent
                                className={
                                  styles["admin-promotion-management-page__type-icon"]
                                }
                              />
                            )}
                            {c.type === "FIXED" && (
                              <MdPayments
                                className={
                                  styles["admin-promotion-management-page__type-icon"]
                                }
                              />
                            )}
                            {c.type === "FREE_SHIPPING" && (
                              <MdLocalShipping
                                className={
                                  styles["admin-promotion-management-page__type-icon"]
                                }
                              />
                            )}
                            <span
                              className={
                                styles["admin-promotion-management-page__type-label"]
                              }
                            >
                              {typeLabel(c.type)}
                            </span>
                          </div>
                        </td>
                        <td
                          className={
                            styles["admin-promotion-management-page__table-cell"]
                          }
                        >
                          <span
                            className={
                              styles["admin-promotion-management-page__value-text"]
                            }
                          >
                            {valueDisplay(c)}
                          </span>
                        </td>
                        <td
                          className={
                            styles["admin-promotion-management-page__table-cell"]
                          }
                        >
                          <div
                            className={
                              styles["admin-promotion-management-page__usage-bar-wrap"]
                            }
                          >
                            <div
                              className={`${styles["admin-promotion-management-page__usage-bar-labels"]} ${limitReached ? styles["admin-promotion-management-page__usage-bar-labels--limit-reached"] : ""}`}
                            >
                              <span>{c.usedCount} đã dùng</span>
                              <span>
                                {c.usageLimit != null
                                  ? `Tối đa: ${c.usageLimit}`
                                  : "Không giới hạn"}
                              </span>
                            </div>
                            <div
                              className={
                                styles["admin-promotion-management-page__usage-bar-track"]
                              }
                            >
                              <div
                                className={`${styles["admin-promotion-management-page__usage-bar-fill"]} ${limitReached ? styles["admin-promotion-management-page__usage-bar-fill--full"] : ""}`}
                                style={{ width: `${usagePct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td
                          className={
                            styles["admin-promotion-management-page__table-cell"]
                          }
                        >
                          <div
                            className={
                              styles["admin-promotion-management-page__validity"]
                            }
                          >
                            <p>
                              <span>Bắt đầu:</span>{" "}
                              {formatDate(c.startsAt)}
                            </p>
                            <p>
                              <span>Kết thúc:</span>{" "}
                              {formatDate(c.endsAt)}
                            </p>
                          </div>
                        </td>
                        <td
                          className={`${styles["admin-promotion-management-page__table-cell"]} ${styles["admin-promotion-management-page__table-cell--status"]}`}
                        >
                          <div
                            className={
                              styles["admin-promotion-management-page__toggle-wrap"]
                            }
                          >
                            <button
                              type="button"
                              className={`${styles["admin-promotion-management-page__toggle"]} ${c.isActive ? styles["admin-promotion-management-page__toggle--checked"] : ""} ${rowStatus === "expired" ? styles["admin-promotion-management-page__toggle--disabled"] : ""}`}
                              onClick={() =>
                                rowStatus !== "expired" &&
                                togglingId !== c.id &&
                                handleToggleActive(c)
                              }
                              disabled={
                                rowStatus === "expired" || togglingId === c.id
                              }
                              aria-label={c.isActive ? "Tắt mã" : "Bật mã"}
                            >
                              <span
                                className={
                                  styles["admin-promotion-management-page__toggle-thumb"]
                                }
                              />
                            </button>
                            <span
                              className={`${styles["admin-promotion-management-page__status-badge"]} ${rowStatus === "active" ? styles["admin-promotion-management-page__status-badge--active"] : rowStatus === "scheduled" ? styles["admin-promotion-management-page__status-badge--scheduled"] : styles["admin-promotion-management-page__status-badge--expired"]}`}
                            >
                              {rowStatus === "active"
                                ? "Hoạt động"
                                : rowStatus === "scheduled"
                                  ? "Sắp diễn ra"
                                  : "Hết hạn"}
                            </span>
                          </div>
                        </td>
                        <td
                          className={
                            styles["admin-promotion-management-page__table-cell"]
                          }
                        >
                          <div
                            className={
                              styles["admin-promotion-management-page__action-group"]
                            }
                          >
                            <Link
                              href={`/admin/promotions/${c.id}/edit`}
                              className={
                                styles["admin-promotion-management-page__icon-button"]
                              }
                              aria-label="Chỉnh sửa"
                            >
                              <MdEdit />
                            </Link>
                            <button
                              type="button"
                              className={
                                styles["admin-promotion-management-page__icon-button"]
                              }
                              onClick={() => setCouponToDelete(c)}
                              aria-label="Vô hiệu hoá mã"
                            >
                              <MdDelete />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <div
            className={
              styles["admin-promotion-management-page__pagination"]
            }
          >
            <p
              className={
                styles["admin-promotion-management-page__pagination-text"]
              }
            >
              Hiển thị {from}–{to} trong tổng {total} mã
            </p>
            <div
              className={
                styles["admin-promotion-management-page__pagination-controls"]
              }
            >
              <button
                type="button"
                className={
                  styles["admin-promotion-management-page__pagination-button"]
                }
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
              >
                <MdChevronLeft /> Trước
              </button>
              {pagesToRender.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`${styles["admin-promotion-management-page__page-pill"]} ${p === page ? styles["admin-promotion-management-page__page-pill--active"] : ""}`}
                  onClick={() => handlePageChange(p)}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                className={
                  styles["admin-promotion-management-page__pagination-button"]
                }
                disabled={page >= totalPages}
                onClick={() => handlePageChange(page + 1)}
              >
                Sau <MdChevronRight />
              </button>
            </div>
          </div>
        </section>

        <div className={styles["admin-promotion-management-page__ai-banner"]}>
          <div
            className={
              styles["admin-promotion-management-page__ai-banner-icon"]
            }
          >
            <MdAutoAwesome />
          </div>
          <div
            className={
              styles["admin-promotion-management-page__ai-banner-body"]
            }
          >
            <h4
              className={
                styles["admin-promotion-management-page__ai-banner-title"]
              }
            >
              Gợi ý AI: Tạo mã nhanh
            </h4>
            <p
              className={
                styles["admin-promotion-management-page__ai-banner-text"]
              }
            >
              Khi tạo hoặc sửa mã, bấm <strong>AI gợi ý cấu hình</strong> để
              nhập ít thông tin (ví dụ % giảm, freeship) và để AI đề xuất mã,
              mô tả, điều kiện và thời gian áp dụng.
            </p>
          </div>
        </div>
      </div>

      <ConfirmActionDialog
        isOpen={!!couponToDelete}
        title="Vô hiệu hoá mã giảm giá"
        description={
          couponToDelete
            ? `Mã "${couponToDelete.code}" sẽ bị tắt (không xoá). Khách hàng sẽ không thể sử dụng mã này. Bạn có chắc?`
            : ""
        }
        confirmLabel="Vô hiệu hoá"
        cancelLabel="Huỷ"
        isConfirmLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setCouponToDelete(null)}
      />
    </div>
  );
};

export default AdminPromotionManagementPage;
