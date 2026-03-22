"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  MdAdd,
  MdChevronLeft,
  MdChevronRight,
  MdNotifications,
  MdSearch,
  MdEdit,
  MdImage,
  MdCheckCircle,
  MdInfo,
  MdFilterList,
  MdRestartAlt,
  MdAutoAwesome,
  MdQueryStats,
  MdInventory,
  MdDelete,
} from "react-icons/md";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import AdminBrandUpsertModal, {
  type AdminBrandUpsertModalBrand,
} from "@/features/admin/components/brands/AdminBrandUpsertModal";
import ConfirmActionDialog from "@/components/shared/ConfirmActionDialog";
import DataLoadingOverlay from "@/components/shared/DataLoadingOverlay";
import { toast } from "sonner";
import styles from "./AdminBrandManagementPage.module.css";

type BrandListItem = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  logoUrl?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  aiDescription?: string | null;
  aiTags: string[];
  productCount: number;
};

type BrandListResponse = {
  data: BrandListItem[];
  total: number;
  page: number;
  pageSize: number;
  aiOptimizedTotal: number;
  seoConfiguredTotal: number;
  totalProducts: number;
};

const PAGE_SIZE = 10;

const AdminBrandManagementPage: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPageParam = searchParams?.get("page");
  const initialPage = initialPageParam ? Number(initialPageParam) || 1 : 1;
  const initialSearch = searchParams?.get("search") ?? "";
  const initialSegment = searchParams?.get("segment") ?? "all";

  const [searchInput, setSearchInput] = useState(initialSearch);
  const [segmentInput, setSegmentInput] = useState(initialSegment || "all");

  const [search, setSearch] = useState(initialSearch);
  const [segment, setSegment] = useState(initialSegment || "all");
  const [page, setPage] = useState(initialPage);
  const [brands, setBrands] = useState<BrandListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [aiOptimizedTotal, setAiOptimizedTotal] = useState(0);
  const [seoConfiguredTotal, setSeoConfiguredTotal] = useState(0);
  const [totalProductsAll, setTotalProductsAll] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingBrand, setEditingBrand] =
    useState<AdminBrandUpsertModalBrand | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [brandToDelete, setBrandToDelete] = useState<BrandListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchBrands = async (controller?: AbortController) => {
    setIsLoading(true);
    setError(null);
    setShowLoadingOverlay(true);
    const startedAt = performance.now();

    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      if (search.trim()) params.set("search", search.trim());
      if (segment && segment !== "all") params.set("segment", segment);

      const response = await fetch(`/api/admin/brands?${params.toString()}`, {
        signal: controller?.signal,
      });

      if (!response.ok) throw new Error("Không thể tải danh sách thương hiệu.");

      const json = (await response.json()) as BrandListResponse;
      setBrands(json.data);
      setTotal(json.total);
      setAiOptimizedTotal(json.aiOptimizedTotal ?? 0);
      setSeoConfiguredTotal(json.seoConfiguredTotal ?? 0);
      setTotalProductsAll(json.totalProducts ?? 0);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError("Đã xảy ra lỗi khi tải danh sách thương hiệu.");
    } finally {
      const elapsed = performance.now() - startedAt;
      const minimum = 1100;
      const remaining = minimum - elapsed;
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
    void fetchBrands(ctrl);
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only refetch when page or search change
  }, [page, search, segment]);

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

  const aiOptimizedCountPage = useMemo(
    () =>
      brands.filter(
        (b) =>
          (b.seoTitle || b.seoDescription || b.aiDescription) &&
          b.aiTags?.length > 0,
      ).length,
    [brands],
  );
  const seoConfiguredCountPage = useMemo(
    () => brands.filter((b) => b.seoTitle && b.seoDescription).length,
    [brands],
  );
  const totalProductsPage = useMemo(
    () => brands.reduce((sum, b) => sum + (b.productCount ?? 0), 0),
    [brands],
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  };

  const handleSegmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSegmentInput(e.target.value);
  };

  const handleApplyFilters = () => {
    const nextSearch = searchInput.trim();
    const nextSegment = segmentInput || "all";
    setSearch(nextSearch);
    setSegment(nextSegment);
    const nextPage = 1;
    setPage(nextPage);

    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    params.set("pageSize", String(PAGE_SIZE));
    if (nextSearch) params.set("search", nextSearch);
    if (nextSegment !== "all") params.set("segment", nextSegment);
    router.push(`/admin/brands?${params.toString()}`);
  };

  const handleResetFilters = () => {
    setSearchInput("");
    setSegmentInput("all");
    setSearch("");
    setSegment("all");
    const nextPage = 1;
    setPage(nextPage);
    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    params.set("pageSize", String(PAGE_SIZE));
    router.push(`/admin/brands?${params.toString()}`);
  };

  const handlePageChange = (p: number) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
    const params = new URLSearchParams();
    params.set("page", String(p));
    params.set("pageSize", String(PAGE_SIZE));
    if (search.trim()) params.set("search", search.trim());
    if (segment && segment !== "all") params.set("segment", segment);
    router.push(`/admin/brands?${params.toString()}`);
  };

  const handleOpenEdit = (brand: BrandListItem) => {
    setEditingBrand({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      description: brand.description ?? undefined,
      logoUrl: brand.logoUrl ?? undefined,
      seoTitle: brand.seoTitle ?? undefined,
      seoDescription: brand.seoDescription ?? undefined,
      aiDescription: brand.aiDescription ?? undefined,
      aiTags: brand.aiTags ?? undefined,
    });
    setIsEditOpen(true);
  };

  const handleViewDetail = (brandId: string) => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    if (search.trim()) params.set("search", search.trim());
    if (segment && segment !== "all") params.set("segment", segment);
    const query = params.toString();
    router.push(`/admin/brands/${brandId}${query ? `?${query}` : ""}`);
  };

  const handleConfirmDelete = async () => {
    if (!brandToDelete) return;
    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/admin/brands/${encodeURIComponent(brandToDelete.id)}`,
        { method: "DELETE" }
      );
      const json = (await response.json()) as { error?: string; success?: boolean };
      if (!response.ok || json.success !== true) {
        toast.error(json.error ?? "Không thể xoá thương hiệu.");
        return;
      }
      toast.success(`Đã xoá thương hiệu "${brandToDelete.name}".`);
      setBrandToDelete(null);
      void fetchBrands();
    } catch {
      toast.error("Đã xảy ra lỗi khi xoá thương hiệu.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleModalCompleted = () => void fetchBrands();

  const segmentLabel = (tags: string[]) => {
    const first = tags?.[0];
    if (!first) return "—";
    const upper = first.charAt(0).toUpperCase() + first.slice(1).replace(/-/g, " ");
    return upper;
  };

  const hasSeo = (b: BrandListItem) => !!(b.seoTitle && b.seoDescription);
  const hasAi = (b: BrandListItem) =>
    !!(b.aiDescription && b.aiTags?.length > 0);

  return (
    <div className={styles["admin-brand-management-page"]}>
      <header className={styles["admin-brand-management-page__header"]}>
        <div className={styles["admin-brand-management-page__header-inner"]}>
          <h1 className={styles["admin-brand-management-page__header-title"]}>
            Quản lý thương hiệu
          </h1>
          <p className={styles["admin-brand-management-page__header-subtitle"]}>
            Quản lý thương hiệu âm thanh và nội dung SEO do AI sinh
          </p>
        </div>
        <div className={styles["admin-brand-management-page__header-actions"]}>
          <Link
            href="/admin/brands/new"
            className={styles["admin-brand-management-page__primary-button"]}
          >
            <MdAdd
              className={
                styles["admin-brand-management-page__primary-button-icon"]
              }
            />
            <span>Thêm thương hiệu</span>
          </Link>
          <button
            type="button"
            className={
              styles["admin-brand-management-page__notification-button"]
            }
            aria-label="Thông báo"
          >
            <MdNotifications />
            <span
              className={
                styles["admin-brand-management-page__notification-dot"]
              }
            />
          </button>
        </div>
      </header>

      <div className={styles["admin-brand-management-page__content"]}>
        <DataLoadingOverlay
          isActive={showLoadingOverlay}
          subtitle="Đang tải danh sách thương hiệu..."
          bottomText="Đang đồng bộ dữ liệu thương hiệu từ hệ thống..."
        />

        <section
          className={styles["admin-brand-management-page__filter-card"]}
          aria-label="Bộ lọc thương hiệu"
        >
          <div
            className={styles["admin-brand-management-page__filter-left"]}
          >
            <div
              className={
                styles["admin-brand-management-page__search-wrapper"]
              }
              style={{ maxWidth: 420 }}
            >
              <MdSearch
                className={
                  styles["admin-brand-management-page__search-icon"]
                }
              />
              <input
                type="text"
                className={styles["admin-brand-management-page__search-input"]}
                placeholder="Tìm thương hiệu theo tên hoặc slug..."
                value={searchInput}
                onChange={handleSearchChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleApplyFilters();
                  }
                }}
              />
            </div>
            <select
              className={styles["admin-brand-management-page__select"]}
              aria-label="Phân khúc thị trường"
              value={segmentInput}
              onChange={handleSegmentChange}
            >
              <option value="all">Tất cả phân khúc</option>
              <option value="hi-end">Hi-End</option>
              <option value="professional">Chuyên nghiệp</option>
              <option value="consumer">Tiêu dùng</option>
            </select>
          </div>
          <div
            className={styles["admin-brand-management-page__filter-right"]}
          >
            <button
              type="button"
              className={styles["admin-brand-management-page__filter-button"]}
              onClick={handleApplyFilters}
            >
              <MdFilterList />
              <span>Lọc</span>
            </button>
            <button
              type="button"
              className={styles["admin-brand-management-page__filter-button"]}
              onClick={handleResetFilters}
            >
              <MdRestartAlt />
              <span>Reset</span>
            </button>
          </div>
        </section>

        <section
          className={styles["admin-brand-management-page__table-card"]}
          aria-label="Bảng thương hiệu"
        >
          <div
            className={styles["admin-brand-management-page__table-wrapper"]}
          >
            <table className={styles["admin-brand-management-page__table"]}>
              <thead>
                <tr
                  className={
                    styles["admin-brand-management-page__table-head-row"]
                  }
                >
                  <th
                    className={
                      styles["admin-brand-management-page__table-head-cell"]
                    }
                  >
                    Logo
                  </th>
                  <th
                    className={
                      styles["admin-brand-management-page__table-head-cell"]
                    }
                  >
                    Tên thương hiệu
                  </th>
                  <th
                    className={
                      styles["admin-brand-management-page__table-head-cell"]
                    }
                  >
                    Slug
                  </th>
                  <th
                    className={
                      styles["admin-brand-management-page__table-head-cell"]
                    }
                  >
                    Phân khúc
                  </th>
                  <th
                    className={`${styles["admin-brand-management-page__table-head-cell"]} ${styles["admin-brand-management-page__table-head-cell--center"]}`}
                  >
                    Trạng thái AI
                  </th>
                  <th
                    className={`${styles["admin-brand-management-page__table-head-cell"]} ${styles["admin-brand-management-page__table-head-cell--center"]}`}
                  >
                    Sản phẩm
                  </th>
                  <th
                    className={`${styles["admin-brand-management-page__table-head-cell"]} ${styles["admin-brand-management-page__table-head-cell--right"]}`}
                  >
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody
                className={
                  styles["admin-brand-management-page__table-body"]
                }
              >
                {error && !isLoading && (
                  <tr>
                    <td
                      className={
                        styles["admin-brand-management-page__empty-row"]
                      }
                      colSpan={8}
                    >
                      {error}
                    </td>
                  </tr>
                )}
                {!error && !isLoading && brands.length === 0 && (
                  <tr>
                    <td
                      className={
                        styles["admin-brand-management-page__empty-row"]
                      }
                      colSpan={8}
                    >
                      Không tìm thấy thương hiệu nào.
                    </td>
                  </tr>
                )}
                {!error &&
                  brands.map((brand) => (
                    <tr
                      key={brand.id}
                      role="button"
                      tabIndex={0}
                      className={
                        styles["admin-brand-management-page__table-row"]
                      }
                      onClick={() => handleViewDetail(brand.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleViewDetail(brand.id);
                        }
                      }}
                    >
                      <td
                        className={
                          styles["admin-brand-management-page__table-cell"]
                        }
                      >
                        <div
                          className={
                            styles["admin-brand-management-page__logo-cell"]
                          }
                        >
                          {brand.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- external logo URL, size fixed
                            <img
                              src={brand.logoUrl}
                              alt=""
                            />
                          ) : (
                            <MdImage
                              className={
                                styles[
                                  "admin-brand-management-page__logo-placeholder"
                                ]
                              }
                            />
                          )}
                        </div>
                      </td>
                      <td
                        className={
                          styles["admin-brand-management-page__table-cell"]
                        }
                      >
                        <div
                          className={
                            styles[
                              "admin-brand-management-page__name-cell-inner"
                            ]
                          }
                        >
                          <span
                            className={
                              styles["admin-brand-management-page__name-text"]
                            }
                          >
                            {brand.name}
                          </span>
                          <span
                            className={`${styles["admin-brand-management-page__seo-status"]} ${
                              hasSeo(brand)
                                ? styles["admin-brand-management-page__seo-status--success"]
                                : styles["admin-brand-management-page__seo-status--warning"]
                            }`}
                          >
                            {hasSeo(brand) ? (
                              <>
                                <MdCheckCircle />
                                Đã cấu hình SEO
                              </>
                            ) : (
                              <>
                                <MdInfo />
                                {!brand.seoTitle
                                  ? "Thiếu tiêu đề SEO"
                                  : "Thiếu mô tả SEO"}
                              </>
                            )}
                          </span>
                        </div>
                      </td>
                      <td
                        className={
                          styles["admin-brand-management-page__table-cell"]
                        }
                      >
                        <code
                          className={
                            styles["admin-brand-management-page__slug-code"]
                          }
                        >
                          {brand.slug}
                        </code>
                      </td>
                      <td
                        className={
                          styles["admin-brand-management-page__table-cell"]
                        }
                      >
                        <span
                          className={
                            styles[
                              "admin-brand-management-page__segment-badge"
                            ]
                          }
                        >
                          {segmentLabel(brand.aiTags ?? [])}
                        </span>
                      </td>
                      <td
                        className={
                          styles["admin-brand-management-page__table-cell"]
                        }
                        style={{ textAlign: "center" }}
                      >
                        {hasAi(brand) ? (
                          <div
                            className={
                              styles["admin-brand-management-page__name-cell-inner"]
                            }
                            style={{ alignItems: "center" }}
                          >
                            <span
                              className={
                                styles["admin-brand-management-page__ai-badge"]
                              }
                            >
                              <MdAutoAwesome
                                className={
                                  styles[
                                    "admin-brand-management-page__ai-badge-icon"
                                  ]
                                }
                              />
                              Tối ưu AI
                            </span>
                            <span
                              className={
                                styles["admin-brand-management-page__ai-sub"]
                              }
                            >
                              Mô tả & thẻ
                            </span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className={
                              styles[
                                "admin-brand-management-page__ai-enable-button"
                              ]
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewDetail(brand.id);
                            }}
                          >
                            Bật AI
                          </button>
                        )}
                      </td>
                      <td
                        className={
                          styles["admin-brand-management-page__table-cell"]
                        }
                        style={{ textAlign: "center" }}
                      >
                        <span
                          className={
                            styles[
                              "admin-brand-management-page__product-count-pill"
                            ]
                          }
                        >
                          {brand.productCount ?? 0}
                        </span>
                      </td>
                      <td
                        className={
                          styles["admin-brand-management-page__table-cell"]
                        }
                        style={{ textAlign: "right" }}
                      >
                        <div
                          className={
                            styles["admin-brand-management-page__action-group"]
                          }
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className={
                              styles["admin-brand-management-page__icon-button"]
                            }
                            onClick={() => handleViewDetail(brand.id)}
                            aria-label="Sửa"
                          >
                            <MdEdit />
                          </button>
                          <button
                            type="button"
                            className={
                              styles["admin-brand-management-page__icon-button"]
                            }
                            onClick={() => setBrandToDelete(brand)}
                            aria-label="Xoá"
                          >
                            <MdDelete />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div
            className={styles["admin-brand-management-page__pagination"]}
          >
            <p
              className={
                styles["admin-brand-management-page__pagination-text"]
              }
            >
              Hiển thị{" "}
              <strong>{from}</strong> đến <strong>{to}</strong> trong tổng số{" "}
              <strong>{total}</strong> thương hiệu
            </p>
            <div
              className={
                styles["admin-brand-management-page__pagination-controls"]
              }
            >
              <button
                type="button"
                className={
                  styles["admin-brand-management-page__pagination-button"]
                }
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
              >
                <MdChevronLeft />
                Trước
              </button>
              <div
                className={
                  styles["admin-brand-management-page__pagination-pages"]
                }
              >
                {pagesToRender.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`${styles["admin-brand-management-page__page-pill"]} ${
                      p === page
                        ? styles["admin-brand-management-page__page-pill--active"]
                        : ""
                    }`}
                    onClick={() => handlePageChange(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={
                  styles["admin-brand-management-page__pagination-button"]
                }
                disabled={page >= totalPages}
                onClick={() => handlePageChange(page + 1)}
              >
                Sau
                <MdChevronRight />
              </button>
            </div>
          </div>
        </section>

        <div className={styles["admin-brand-management-page__stats"]}>
          <div
            className={`${styles["admin-brand-management-page__stat-card"]} ${styles["admin-brand-management-page__stat-card--purple"]}`}
          >
            <div
              className={
                styles["admin-brand-management-page__stat-header"]
              }
            >
              <div>
                <p
                  className={`${styles["admin-brand-management-page__stat-label"]} ${styles["admin-brand-management-page__stat-label--purple"]}`}
                >
                  Tỷ lệ tối ưu AI
                </p>
                <p
                  className={
                    styles["admin-brand-management-page__stat-value"]
                  }
                >
                  {total === 0
                    ? "0%"
                    : `${Math.round((aiOptimizedTotal / total) * 100)}%`}
                </p>
              </div>
              <div
                className={`${styles["admin-brand-management-page__stat-icon"]} ${styles["admin-brand-management-page__stat-icon--purple"]}`}
              >
                <MdAutoAwesome />
              </div>
            </div>
            <div
              className={
                styles["admin-brand-management-page__stat-progress"]
              }
            >
              <div
                className={
                  styles["admin-brand-management-page__stat-progress-bar"]
                }
                style={{
                  width:
                      total === 0
                        ? "0%"
                        : `${(aiOptimizedTotal / total) * 100}%`,
                }}
              />
            </div>
            <p
              className={`${styles["admin-brand-management-page__stat-note"]} ${styles["admin-brand-management-page__stat-note--purple"]}`}
            >
                {aiOptimizedTotal} / {total} thương hiệu có đủ mô tả và thẻ AI
            </p>
          </div>

          <div
            className={`${styles["admin-brand-management-page__stat-card"]} ${styles["admin-brand-management-page__stat-card--green"]}`}
          >
            <div
              className={
                styles["admin-brand-management-page__stat-header"]
              }
            >
              <div>
                <p
                  className={`${styles["admin-brand-management-page__stat-label"]} ${styles["admin-brand-management-page__stat-label--green"]}`}
                >
                  SEO đã cấu hình
                </p>
                <p
                  className={
                    styles["admin-brand-management-page__stat-value"]
                  }
                >
                  {total === 0
                    ? "0"
                    : `${
                        Math.round((seoConfiguredTotal / total) * 1000) / 10
                      }`}
                </p>
              </div>
              <div
                className={`${styles["admin-brand-management-page__stat-icon"]} ${styles["admin-brand-management-page__stat-icon--green"]}`}
              >
                <MdQueryStats />
              </div>
            </div>
            <p
              className={
                styles["admin-brand-management-page__stat-note"]
              }
            >
                {seoConfiguredTotal} thương hiệu có tiêu đề và mô tả SEO
            </p>
          </div>

          <div
            className={`${styles["admin-brand-management-page__stat-card"]} ${styles["admin-brand-management-page__stat-card--amber"]}`}
          >
            <div
              className={
                styles["admin-brand-management-page__stat-header"]
              }
            >
              <div>
                <p
                  className={`${styles["admin-brand-management-page__stat-label"]} ${styles["admin-brand-management-page__stat-label--amber"]}`}
                >
                  Phân bố sản phẩm
                </p>
                <p
                  className={
                    styles["admin-brand-management-page__stat-value"]
                  }
                >
                  {totalProductsPage}+
                </p>
              </div>
              <div
                className={`${styles["admin-brand-management-page__stat-icon"]} ${styles["admin-brand-management-page__stat-icon--amber"]}`}
              >
                <MdInventory />
              </div>
            </div>
            <p
              className={
                styles["admin-brand-management-page__stat-note"]
              }
            >
              Tổng sản phẩm thuộc các thương hiệu trên trang này
            </p>
          </div>
        </div>
      </div>

      {editingBrand && (
        <AdminBrandUpsertModal
          mode="edit"
          isOpen={isEditOpen}
          brand={editingBrand}
          onClose={() => {
            setIsEditOpen(false);
            setEditingBrand(null);
          }}
          onCompleted={handleModalCompleted}
        />
      )}

      <ConfirmActionDialog
        isOpen={Boolean(brandToDelete)}
        title="Xác nhận xoá thương hiệu"
        description={
          brandToDelete
            ? `Bạn có chắc muốn xoá thương hiệu "${brandToDelete.name}"? Sản phẩm thuộc thương hiệu này sẽ không bị xoá nhưng sẽ không còn gắn với thương hiệu.`
            : undefined
        }
        confirmLabel="Xoá"
        cancelLabel="Huỷ"
        onConfirm={handleConfirmDelete}
        onCancel={() => setBrandToDelete(null)}
        isConfirmLoading={isDeleting}
      />
    </div>
  );
};

export default AdminBrandManagementPage;
