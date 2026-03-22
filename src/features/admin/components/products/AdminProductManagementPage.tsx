/* AdminProductManagementPage
 */

"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MdAdd,
  MdChevronLeft,
  MdChevronRight,
  MdFilterList,
  MdImage,
  MdInventory2,
  MdPaid,
  MdRestartAlt,
  MdSearch,
  MdVisibility,
  MdVisibilityOff,
  MdWarningAmber,
  MdAutoAwesome,
  MdEdit,
  MdDelete,
} from "react-icons/md";
import { toast } from "sonner";
import ConfirmActionDialog from "@/components/shared/ConfirmActionDialog";
import DataLoadingOverlay from "@/components/shared/DataLoadingOverlay";
import styles from "./AdminProductManagementPage.module.css";

type ProductStatus = "ACTIVE" | "DRAFT" | "HIDDEN";

type ProductListItem = {
  id: string;
  name: string;
  slug: string;
  brandName?: string | null;
  categoryName?: string | null;
  price: number;
  currency: string;
  stock: number;
  status: ProductStatus;
  primaryImageUrl?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  aiDescription?: string | null;
  aiTags: string[];
};

type ProductListResponse = {
  data: ProductListItem[];
  total: number;
  page: number;
  pageSize: number;
};

const PAGE_SIZE = 10;

const AdminProductManagementPage: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialPageParam = searchParams?.get("page");
  const initialPage = initialPageParam ? Number(initialPageParam) || 1 : 1;
  const initialSearch = searchParams?.get("search") ?? "";
  const initialStatus = (searchParams?.get("status") as ProductStatus | null) ?? "all";

  const [searchInput, setSearchInput] = useState(initialSearch);
  const [statusInput, setStatusInput] = useState<ProductStatus | "all">(
    initialStatus || "all",
  );

  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState<ProductStatus | "all">(
    initialStatus || "all",
  );
  const [page, setPage] = useState(initialPage);

  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [total, setTotal] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = async (controller?: AbortController) => {
    setIsLoading(true);
    setError(null);
    setShowLoadingOverlay(true);
    const startedAt = performance.now();

    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      if (search.trim()) params.set("search", search.trim());
      if (status && status !== "all") params.set("status", status);

      const response = await fetch(`/api/admin/products?${params.toString()}`, {
        signal: controller?.signal,
      });

      if (!response.ok) {
        // Khi API sản phẩm chưa được triển khai (404), coi như danh sách rỗng để tránh hiện lỗi khó hiểu.
        if (response.status === 404) {
          setProducts([]);
          setTotal(0);
          return;
        }
        throw new Error("Không thể tải danh sách sản phẩm.");
      }

      const json = (await response.json()) as ProductListResponse;
      setProducts(json.data);
      setTotal(json.total);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError("Đã xảy ra lỗi khi tải danh sách sản phẩm.");
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
    void fetchProducts(ctrl);
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ refetch khi page/search/status đổi
  }, [page, search, status]);

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
      products.filter(
        (p) =>
          (p.seoTitle || p.seoDescription || p.aiDescription) &&
          (p.aiTags?.length ?? 0) > 0,
      ).length,
    [products],
  );

  const activeCountPage = useMemo(
    () => products.filter((p) => p.status === "ACTIVE").length,
    [products],
  );

  const lowStockCountPage = useMemo(
    () => products.filter((p) => p.stock <= 3).length,
    [products],
  );

  const [productToDelete, setProductToDelete] = useState<ProductListItem | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as ProductStatus | "all";
    setStatusInput(value);
  };

  const handleApplyFilters = () => {
    const nextSearch = searchInput.trim();
    const nextStatus = statusInput || "all";
    setSearch(nextSearch);
    setStatus(nextStatus);

    const nextPage = 1;
    setPage(nextPage);

    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    params.set("pageSize", String(PAGE_SIZE));
    if (nextSearch) params.set("search", nextSearch);
    if (nextStatus !== "all") params.set("status", nextStatus);
    router.push(`/admin/products?${params.toString()}`);
  };

  const handleResetFilters = () => {
    setSearchInput("");
    setStatusInput("all");
    setSearch("");
    setStatus("all");

    const nextPage = 1;
    setPage(nextPage);
    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    params.set("pageSize", String(PAGE_SIZE));
    router.push(`/admin/products?${params.toString()}`);
  };

  const handlePageChange = (p: number) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
    const params = new URLSearchParams();
    params.set("page", String(p));
    params.set("pageSize", String(PAGE_SIZE));
    if (search.trim()) params.set("search", search.trim());
    if (status && status !== "all") params.set("status", status);
    router.push(`/admin/products?${params.toString()}`);
  };

  const handleViewDetail = (productId: string) => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    if (search.trim()) params.set("search", search.trim());
    if (status && status !== "all") params.set("status", status);
    const query = params.toString();
    router.push(`/admin/products/${productId}${query ? `?${query}` : ""}`);
  };

  const formatPrice = (price: number, currency: string) => {
    try {
      return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: currency || "VND",
        maximumFractionDigits: 0,
      }).format(price);
    } catch {
      return `${price.toLocaleString("vi-VN")} ${currency || "VND"}`;
    }
  };

  const statusLabel = (s: ProductStatus): string => {
    if (s === "ACTIVE") return "Đang hiển thị";
    if (s === "DRAFT") return "Bản nháp";
    return "Đã ẩn";
  };

  const hasSeo = (p: ProductListItem) => !!(p.seoTitle && p.seoDescription);
  const hasAi = (p: ProductListItem) =>
    !!(p.aiDescription && (p.aiTags?.length ?? 0) > 0);

  const handleNotImplemented = () => {
    toast.info("Chức năng này sẽ được bổ sung trong bước tiếp theo.");
  };

  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/admin/products/${encodeURIComponent(productToDelete.id)}`,
        { method: "DELETE" },
      );
      const json = (await response.json()) as { error?: string; success?: boolean };
      if (!response.ok || json.success !== true) {
        toast.error(json.error ?? "Không thể xoá sản phẩm.");
        return;
      }
      toast.success(`Đã xoá sản phẩm "${productToDelete.name}".`);
      setProductToDelete(null);
      void fetchProducts();
    } catch {
      toast.error("Đã xảy ra lỗi khi xoá sản phẩm.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={styles["admin-product-management-page"]}>
      <header className={styles["admin-product-management-page__header"]}>
        <div className={styles["admin-product-management-page__header-inner"]}>
          <h1 className={styles["admin-product-management-page__header-title"]}>
            Quản lý sản phẩm
          </h1>
          <p className={styles["admin-product-management-page__header-subtitle"]}>
            Kiểm soát danh sách sản phẩm, tồn kho và tối ưu nội dung bằng AI
          </p>
        </div>
        <div className={styles["admin-product-management-page__header-actions"]}>
          <Link
            href="/admin/products/new"
            className={styles["admin-product-management-page__primary-button"]}
          >
            <MdAdd
              className={
                styles["admin-product-management-page__primary-button-icon"]
              }
            />
            <span>Thêm sản phẩm</span>
          </Link>
        </div>
      </header>

      <div className={styles["admin-product-management-page__content"]}>
        <DataLoadingOverlay
          isActive={showLoadingOverlay}
          subtitle="Đang tải danh sách sản phẩm..."
          bottomText="Đang tổng hợp dữ liệu sản phẩm và tồn kho từ hệ thống..."
        />

        <section
          className={styles["admin-product-management-page__filter-card"]}
          aria-label="Bộ lọc sản phẩm"
        >
          <div
            className={styles["admin-product-management-page__filter-left"]}
          >
            <div
              className={
                styles["admin-product-management-page__search-wrapper"]
              }
              style={{ maxWidth: 420 }}
            >
              <MdSearch
                className={
                  styles["admin-product-management-page__search-icon"]
                }
              />
              <input
                type="text"
                className={styles["admin-product-management-page__search-input"]}
                placeholder="Tìm sản phẩm theo tên hoặc slug..."
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
              className={styles["admin-product-management-page__select"]}
              aria-label="Trạng thái hiển thị"
              value={statusInput}
              onChange={handleStatusChange}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang hiển thị</option>
              <option value="DRAFT">Bản nháp</option>
              <option value="HIDDEN">Đã ẩn</option>
            </select>
          </div>
          <div
            className={styles["admin-product-management-page__filter-right"]}
          >
            <button
              type="button"
              className={styles["admin-product-management-page__filter-button"]}
              onClick={handleApplyFilters}
            >
              <MdFilterList />
              <span>Lọc</span>
            </button>
            <button
              type="button"
              className={styles["admin-product-management-page__filter-button"]}
              onClick={handleResetFilters}
            >
              <MdRestartAlt />
              <span>Reset</span>
            </button>
          </div>
        </section>

        <section
          className={styles["admin-product-management-page__table-card"]}
          aria-label="Bảng sản phẩm"
        >
          <div
            className={styles["admin-product-management-page__table-wrapper"]}
          >
            <table className={styles["admin-product-management-page__table"]}>
              <thead>
                <tr
                  className={
                    styles["admin-product-management-page__table-head-row"]
                  }
                >
                  <th
                    className={
                      styles["admin-product-management-page__table-head-cell"]
                    }
                  >
                    Ảnh
                  </th>
                  <th
                    className={
                      styles["admin-product-management-page__table-head-cell"]
                    }
                  >
                    Sản phẩm
                  </th>
                  <th
                    className={
                      styles["admin-product-management-page__table-head-cell"]
                    }
                  >
                    Thương hiệu
                  </th>
                  <th
                    className={
                      styles["admin-product-management-page__table-head-cell"]
                    }
                  >
                    Danh mục
                  </th>
                  <th
                    className={`${styles["admin-product-management-page__table-head-cell"]} ${styles["admin-product-management-page__table-head-cell--right"]}`}
                  >
                    Giá
                  </th>
                  <th
                    className={`${styles["admin-product-management-page__table-head-cell"]} ${styles["admin-product-management-page__table-head-cell--center"]}`}
                  >
                    Tồn kho
                  </th>
                  <th
                    className={`${styles["admin-product-management-page__table-head-cell"]} ${styles["admin-product-management-page__table-head-cell--center"]}`}
                  >
                    Trạng thái AI
                  </th>
                  <th
                    className={`${styles["admin-product-management-page__table-head-cell"]} ${styles["admin-product-management-page__table-head-cell--right"]}`}
                  >
                    Hiển thị
                  </th>
                  <th
                    className={`${styles["admin-product-management-page__table-head-cell"]} ${styles["admin-product-management-page__table-head-cell--right"]}`}
                  >
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody
                className={
                  styles["admin-product-management-page__table-body"]
                }
              >
                {error && !isLoading && (
                  <tr>
                    <td
                      className={
                        styles["admin-product-management-page__empty-row"]
                      }
                      colSpan={8}
                    >
                      {error}
                    </td>
                  </tr>
                )}
                {!error && !isLoading && products.length === 0 && (
                  <tr>
                    <td
                      className={
                        styles["admin-product-management-page__empty-row"]
                      }
                      colSpan={8}
                    >
                      Không tìm thấy sản phẩm nào.
                    </td>
                  </tr>
                )}
                {!error &&
                  products.map((product) => (
                    <tr
                      key={product.id}
                      role="button"
                      tabIndex={0}
                      className={
                        styles["admin-product-management-page__table-row"]
                      }
                      onClick={() => handleViewDetail(product.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleViewDetail(product.id);
                        }
                      }}
                    >
                      <td
                        className={
                          styles["admin-product-management-page__table-cell"]
                        }
                      >
                        <div
                          className={
                            styles["admin-product-management-page__image-cell"]
                          }
                        >
                          {product.primaryImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- external image URL, size cố định
                            <img
                              src={product.primaryImageUrl}
                              alt=""
                            />
                          ) : (
                            <MdImage
                              className={
                                styles[
                                  "admin-product-management-page__image-placeholder"
                                ]
                              }
                            />
                          )}
                        </div>
                      </td>
                      <td
                        className={
                          styles["admin-product-management-page__table-cell"]
                        }
                      >
                        <div
                          className={
                            styles[
                              "admin-product-management-page__name-cell-inner"
                            ]
                          }
                        >
                          <span
                            className={
                              styles["admin-product-management-page__name-text"]
                            }
                          >
                            {product.name}
                          </span>
                          <code
                            className={
                              styles["admin-product-management-page__slug-code"]
                            }
                          >
                            {product.slug}
                          </code>
                        </div>
                      </td>
                      <td
                        className={
                          styles["admin-product-management-page__table-cell"]
                        }
                      >
                        <span
                          className={
                            styles[
                              "admin-product-management-page__meta-text-muted"
                            ]
                          }
                        >
                          {product.brandName ?? "—"}
                        </span>
                      </td>
                      <td
                        className={
                          styles["admin-product-management-page__table-cell"]
                        }
                      >
                        <span
                          className={
                            styles[
                              "admin-product-management-page__meta-text-muted"
                            ]
                          }
                        >
                          {product.categoryName ?? "—"}
                        </span>
                      </td>
                      <td
                        className={
                          styles["admin-product-management-page__table-cell"]
                        }
                        style={{ textAlign: "right" }}
                      >
                        <span
                          className={
                            styles[
                              "admin-product-management-page__price-pill"
                            ]
                          }
                        >
                          <MdPaid />
                          {formatPrice(product.price, product.currency)}
                        </span>
                      </td>
                      <td
                        className={
                          styles["admin-product-management-page__table-cell"]
                        }
                        style={{ textAlign: "center" }}
                      >
                        <span
                          className={`${styles["admin-product-management-page__stock-pill"]} ${
                            product.stock <= 0
                              ? styles[
                                  "admin-product-management-page__stock-pill--danger"
                                ]
                              : product.stock <= 3
                                ? styles[
                                    "admin-product-management-page__stock-pill--warning"
                                  ]
                                : ""
                          }`}
                        >
                          {product.stock}
                        </span>
                      </td>
                      <td
                        className={
                          styles["admin-product-management-page__table-cell"]
                        }
                        style={{ textAlign: "center" }}
                      >
                        {hasAi(product) ? (
                          <div
                            className={
                              styles[
                                "admin-product-management-page__ai-badge-wrapper"
                              ]
                            }
                          >
                            <span
                              className={
                                styles[
                                  "admin-product-management-page__ai-badge"
                                ]
                              }
                            >
                              <MdAutoAwesome
                                className={
                                  styles[
                                    "admin-product-management-page__ai-badge-icon"
                                  ]
                                }
                              />
                              Tối ưu AI
                            </span>
                            <span
                              className={
                                styles[
                                  "admin-product-management-page__ai-sub-text"
                                ]
                              }
                            >
                              Mô tả & thẻ
                            </span>
                          </div>
                        ) : hasSeo(product) ? (
                          <span
                            className={
                              styles[
                                "admin-product-management-page__ai-seo-only-pill"
                              ]
                            }
                          >
                            Đã có SEO
                          </span>
                        ) : (
                          <button
                            type="button"
                            className={
                              styles[
                                "admin-product-management-page__ai-enable-button"
                              ]
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNotImplemented();
                            }}
                          >
                            Bật AI
                          </button>
                        )}
                      </td>
                      <td
                        className={
                          styles["admin-product-management-page__table-cell"]
                        }
                        style={{ textAlign: "right" }}
                      >
                        <span
                          className={`${styles["admin-product-management-page__status-pill"]} ${
                            product.status === "ACTIVE"
                              ? styles[
                                  "admin-product-management-page__status-pill--active"
                                ]
                              : product.status === "DRAFT"
                                ? styles[
                                    "admin-product-management-page__status-pill--draft"
                                  ]
                                : styles[
                                    "admin-product-management-page__status-pill--hidden"
                                  ]
                          }`}
                        >
                          {product.status === "ACTIVE" && <MdVisibility />}
                          {product.status === "DRAFT" && <MdWarningAmber />}
                          {product.status === "HIDDEN" && <MdVisibilityOff />}
                          {statusLabel(product.status)}
                        </span>
                      </td>
                      <td
                        className={
                          styles["admin-product-management-page__table-cell"]
                        }
                        style={{ textAlign: "right" }}
                      >
                        <div
                          className={
                            styles["admin-product-management-page__action-group"]
                          }
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className={
                              styles["admin-product-management-page__icon-button"]
                            }
                            onClick={() => handleViewDetail(product.id)}
                            aria-label="Sửa"
                          >
                            <MdEdit />
                          </button>
                          <button
                            type="button"
                            className={
                              styles["admin-product-management-page__icon-button"]
                            }
                            onClick={() => setProductToDelete(product)}
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
            className={styles["admin-product-management-page__pagination"]}
          >
            <p
              className={
                styles["admin-product-management-page__pagination-text"]
              }
            >
              Hiển thị{" "}
              <strong>{from}</strong> đến <strong>{to}</strong> trong tổng số{" "}
              <strong>{total}</strong> sản phẩm
            </p>
            <div
              className={
                styles[
                  "admin-product-management-page__pagination-controls"
                ]
              }
            >
              <button
                type="button"
                className={
                  styles["admin-product-management-page__pagination-button"]
                }
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
              >
                <MdChevronLeft />
                Trước
              </button>
              <div
                className={
                  styles["admin-product-management-page__pagination-pages"]
                }
              >
                {pagesToRender.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`${styles["admin-product-management-page__page-pill"]} ${
                      p === page
                        ? styles[
                            "admin-product-management-page__page-pill--active"
                          ]
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
                  styles["admin-product-management-page__pagination-button"]
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

        <div className={styles["admin-product-management-page__stats"]}>
          <div
            className={`${styles["admin-product-management-page__stat-card"]} ${styles["admin-product-management-page__stat-card--purple"]}`}
          >
            <div
              className={
                styles["admin-product-management-page__stat-header"]
              }
            >
              <div>
                <p
                  className={`${styles["admin-product-management-page__stat-label"]} ${styles["admin-product-management-page__stat-label--purple"]}`}
                >
                  Tối ưu AI trên trang này
                </p>
                <p
                  className={
                    styles["admin-product-management-page__stat-value"]
                  }
                >
                  {products.length === 0
                    ? "0%"
                    : `${Math.round(
                        (aiOptimizedCountPage / products.length) * 100,
                      )}%`}
                </p>
              </div>
              <div
                className={`${styles["admin-product-management-page__stat-icon"]} ${styles["admin-product-management-page__stat-icon--purple"]}`}
              >
                <MdAutoAwesome />
              </div>
            </div>
            <div
              className={
                styles["admin-product-management-page__stat-progress"]
              }
            >
              <div
                className={
                  styles[
                    "admin-product-management-page__stat-progress-bar"
                  ]
                }
                style={{
                  width:
                    products.length === 0
                      ? "0%"
                      : `${(aiOptimizedCountPage / products.length) * 100}%`,
                }}
              />
            </div>
            <p
              className={`${styles["admin-product-management-page__stat-note"]} ${styles["admin-product-management-page__stat-note--purple"]}`}
            >
              {aiOptimizedCountPage} / {products.length} sản phẩm trên trang này
              đã có dữ liệu AI đầy đủ
            </p>
          </div>

          <div
            className={`${styles["admin-product-management-page__stat-card"]} ${styles["admin-product-management-page__stat-card--green"]}`}
          >
            <div
              className={
                styles["admin-product-management-page__stat-header"]
              }
            >
              <div>
                <p
                  className={`${styles["admin-product-management-page__stat-label"]} ${styles["admin-product-management-page__stat-label--green"]}`}
                >
                  Đang hiển thị
                </p>
                <p
                  className={
                    styles["admin-product-management-page__stat-value"]
                  }
                >
                  {activeCountPage}
                </p>
              </div>
              <div
                className={`${styles["admin-product-management-page__stat-icon"]} ${styles["admin-product-management-page__stat-icon--green"]}`}
              >
                <MdInventory2 />
              </div>
            </div>
            <p
              className={
                styles["admin-product-management-page__stat-note"]
              }
            >
              Số sản phẩm ở trạng thái đang hiển thị trên trang hiện tại
            </p>
          </div>

          <div
            className={`${styles["admin-product-management-page__stat-card"]} ${styles["admin-product-management-page__stat-card--amber"]}`}
          >
            <div
              className={
                styles["admin-product-management-page__stat-header"]
              }
            >
              <div>
                <p
                  className={`${styles["admin-product-management-page__stat-label"]} ${styles["admin-product-management-page__stat-label--amber"]}`}
                >
                  Cần chú ý tồn kho
                </p>
                <p
                  className={
                    styles["admin-product-management-page__stat-value"]
                  }
                >
                  {lowStockCountPage}
                </p>
              </div>
              <div
                className={`${styles["admin-product-management-page__stat-icon"]} ${styles["admin-product-management-page__stat-icon--amber"]}`}
              >
                <MdWarningAmber />
              </div>
            </div>
            <p
              className={
                styles["admin-product-management-page__stat-note"]
              }
            >
              Số sản phẩm trên trang có tồn kho thấp (≤ 3) để dễ ưu tiên nhập
              thêm
            </p>
          </div>
        </div>
      </div>

      <ConfirmActionDialog
        isOpen={Boolean(productToDelete)}
        title="Xác nhận xoá sản phẩm"
        description={
          productToDelete
            ? `Bạn có chắc muốn xoá sản phẩm "${productToDelete.name}"? Các bản ghi giỏ hàng, yêu thích hoặc đơn hàng tham chiếu tới sản phẩm này sẽ cần được xử lý riêng.`
            : undefined
        }
        confirmLabel="Xoá sản phẩm"
        cancelLabel="Huỷ"
        onConfirm={handleConfirmDelete}
        onCancel={() => setProductToDelete(null)}
        isConfirmLoading={isDeleting}
      />
    </div>
  );
};

export default AdminProductManagementPage;

