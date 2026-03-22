"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  MdAdd,
  MdChevronLeft,
  MdChevronRight,
  MdDelete,
  MdEdit,
  MdNotifications,
  MdSearch,
  MdSort,
  MdFolderOpen,
  MdSubdirectoryArrowRight,
} from "react-icons/md";
import AdminCategoryUpsertModal, {
  type AdminCategoryUpsertModalCategory,
  type AdminCategoryUpsertModalParentOption,
} from "./AdminCategoryUpsertModal";
import ConfirmActionDialog from "@/components/shared/ConfirmActionDialog";
import DataLoadingOverlay from "@/components/shared/DataLoadingOverlay";
import { toast } from "sonner";
import styles from "./AdminCategoryManagementPage.module.css";

type AdminCategoryListItem = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  parentName?: string | null;
  productCount: number;
  isTopLevel: boolean;
   // Các trường phục vụ SEO/AI (tự sinh hoặc chỉnh tay)
  seoTitle?: string | null;
  seoDescription?: string | null;
  aiDescription?: string | null;
  aiTags?: string[] | null;
};
const PAGE_SIZE = 5;

type AdminCategoryListResponse = {
  data: AdminCategoryListItem[];
  total: number;
  page: number;
  pageSize: number;
};

const AdminCategoryManagementPage: React.FC = () => {
  const [search, setSearch] = useState("");

  // Bảng danh mục cha
  const [parentPage, setParentPage] = useState(1);
  const [parents, setParents] = useState<AdminCategoryListItem[]>([]);
  const [parentTotal, setParentTotal] = useState(0);
  const [parentIsLoading, setParentIsLoading] = useState(false);
  const [parentError, setParentError] = useState<string | null>(null);

  // Bảng danh mục con
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [selectedParentName, setSelectedParentName] = useState<string | null>(
    null,
  );
  const [children, setChildren] = useState<AdminCategoryListItem[]>([]);
  const [childrenIsLoading, setChildrenIsLoading] = useState(false);
  const [childrenError, setChildrenError] = useState<string | null>(null);
  const [childrenReloadToken, setChildrenReloadToken] = useState(0);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(true);

  // Danh mục được chọn để hiển thị chi tiết (có thể là cha hoặc con)
  const [selectedCategoryForDetail, setSelectedCategoryForDetail] =
    useState<AdminCategoryListItem | null>(null);

  // Popup thêm / sửa danh mục
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCategory, setEditingCategory] =
    useState<AdminCategoryUpsertModalCategory | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] =
    useState<AdminCategoryListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch danh mục cha
  useEffect(() => {
    const controller = new AbortController();

    const fetchParents = async () => {
      setParentIsLoading(true);
      setParentError(null);
      setShowLoadingOverlay(true);

      const startedAt = performance.now();

      try {
        const params = new URLSearchParams();
        params.set("page", String(parentPage));
        params.set("pageSize", String(PAGE_SIZE));
        params.set("level", "top");

        if (search.trim()) {
          params.set("search", search.trim());
        }

        const response = await fetch(
          `/api/admin/categories?${params.toString()}`,
          {
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error("Không thể tải danh sách danh mục.");
        }

        const json = (await response.json()) as AdminCategoryListResponse;
        setParents(json.data);
        setParentTotal(json.total);

        // Nếu chưa chọn danh mục cha nào thì chọn luôn phần tử đầu tiên
        if (!selectedParentId && json.data.length > 0) {
          setSelectedParentId(json.data[0].id);
          setSelectedParentName(json.data[0].name);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        setParentError("Đã xảy ra lỗi khi tải danh sách danh mục.");
      } finally {
        const elapsed = performance.now() - startedAt;
        const minimum = 1100;
        const remaining = minimum - elapsed;

        if (remaining > 0) {
          window.setTimeout(() => {
            setParentIsLoading(false);
            setShowLoadingOverlay(false);
          }, remaining);
        } else {
          setParentIsLoading(false);
          setShowLoadingOverlay(false);
        }
      }
    };

    void fetchParents();

    return () => {
      controller.abort();
    };
  }, [parentPage, search, selectedParentId]);

  // Fetch danh mục con theo danh mục cha được chọn
  useEffect(() => {
    if (!selectedParentId) {
      setChildren([]);
      return;
    }

    const controller = new AbortController();

    const fetchChildren = async () => {
      setChildrenIsLoading(true);
      setChildrenError(null);

      const startedAt = performance.now();

      try {
        const params = new URLSearchParams();
        params.set("level", "sub");
        params.set("parentId", selectedParentId);
        // Lấy nhiều hơn một chút để tránh cần phân trang con
        params.set("page", "1");
        params.set("pageSize", "100");

        const response = await fetch(
          `/api/admin/categories?${params.toString()}`,
          {
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error("Không thể tải danh mục con.");
        }

        const json = (await response.json()) as AdminCategoryListResponse;
        setChildren(json.data);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        setChildrenError("Đã xảy ra lỗi khi tải danh mục con.");
      } finally {
        const elapsed = performance.now() - startedAt;
        const minimum = 1100;
        const remaining = minimum - elapsed;

        if (remaining > 0) {
          window.setTimeout(() => {
            setChildrenIsLoading(false);
          }, remaining);
        } else {
          setChildrenIsLoading(false);
        }
      }
    };

    void fetchChildren();

    return () => {
      controller.abort();
    };
  }, [selectedParentId, childrenReloadToken]);

  const totalPages = Math.max(1, Math.ceil(parentTotal / PAGE_SIZE));

  const from = parentTotal === 0 ? 0 : (parentPage - 1) * PAGE_SIZE + 1;
  const to = parentTotal === 0 ? 0 : Math.min(parentPage * PAGE_SIZE, parentTotal);

  const pagesToRender = useMemo(() => {
    const pages: number[] = [];
    const maxButtons = 4;

    if (totalPages <= maxButtons + 2) {
      for (let i = 1; i <= totalPages; i += 1) {
        pages.push(i);
      }
      return pages;
    }

    pages.push(1);

    const start = Math.max(2, parentPage - 1);
    const end = Math.min(totalPages - 1, parentPage + 1);

    for (let i = start; i <= end; i += 1) {
      pages.push(i);
    }

    if (!pages.includes(totalPages)) {
      pages.push(totalPages);
    }

    return pages;
  }, [parentPage, totalPages]);

  const handleChangePage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setParentPage(page);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
    setParentPage(1);
  };

  const parentOptions: AdminCategoryUpsertModalParentOption[] = useMemo(
    () =>
      parents.map((parent) => ({
        id: parent.id,
        name: parent.name,
      })),
    [parents],
  );

  const handleOpenCreate = () => {
    setIsCreateOpen(true);
  };

  const handleOpenEditFromParent = (category: AdminCategoryListItem) => {
    setEditingCategory({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      parentId: null,
      seoTitle: category.seoTitle ?? undefined,
      seoDescription: category.seoDescription ?? undefined,
      aiDescription: category.aiDescription ?? undefined,
      aiTags: category.aiTags ?? undefined,
    });
    setIsEditOpen(true);
  };

  const handleOpenEditFromChild = (category: AdminCategoryListItem) => {
    setEditingCategory({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      parentId: selectedParentId,
      seoTitle: category.seoTitle ?? undefined,
      seoDescription: category.seoDescription ?? undefined,
      aiDescription: category.aiDescription ?? undefined,
      aiTags: category.aiTags ?? undefined,
    });
    setIsEditOpen(true);
  };

  const handleRequestDelete = (category: AdminCategoryListItem) => {
    setCategoryToDelete(category);
  };

  const handleConfirmDelete = async () => {
    if (!categoryToDelete) return;
    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/admin/categories/${encodeURIComponent(categoryToDelete.id)}`,
        {
          method: "DELETE",
        },
      );
      const json = (await response.json()) as { error?: string; success?: boolean };

      if (!response.ok || json.success !== true) {
        toast.error(
          json.error ??
            "Không thể xoá danh mục. Vui lòng kiểm tra lại và thử lại sau.",
        );
        return;
      }

      toast.success(
        `Đã xoá danh mục "${
          categoryToDelete.name
        }" và các danh mục con liên quan. Các sản phẩm vẫn được giữ nguyên.`,
      );

      setCategoryToDelete(null);
      // Reload lại danh mục cha và con
      setParentPage(1);
      setSelectedParentId(null);
    } catch {
      toast.error(
        "Đã xảy ra lỗi khi xoá danh mục. Vui lòng kiểm tra kết nối và thử lại.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={styles["admin-category-management-page"]}>
      <header className={styles["admin-category-management-page__header"]}>
        <h1 className={styles["admin-category-management-page__header-title"]}>
          Quản lý danh mục
        </h1>
        <div className={styles["admin-category-management-page__header-actions"]}>
          <button
            type="button"
            className={styles["admin-category-management-page__primary-button"]}
            onClick={handleOpenCreate}
          >
            <MdAdd
              className={
                styles["admin-category-management-page__primary-button-icon"]
              }
            />
            <span>Thêm danh mục</span>
          </button>
          <button
            type="button"
            className={styles["admin-category-management-page__notification-button"]}
            aria-label="Thông báo"
          >
            <MdNotifications />
            <span
              className={
                styles["admin-category-management-page__notification-dot"]
              }
            />
          </button>
        </div>
      </header>

      <div className={styles["admin-category-management-page__content"]}>
        <DataLoadingOverlay
          isActive={showLoadingOverlay}
          subtitle="Đang tải danh sách danh mục..."
          bottomText="Đang đồng bộ dữ liệu danh mục âm thanh từ hệ thống..."
        />
        <section
          className={styles["admin-category-management-page__filter-card"]}
          aria-label="Bộ lọc danh mục"
        >
          <div className={styles["admin-category-management-page__filter-left"]}>
            <div
              className={styles["admin-category-management-page__search-wrapper"]}
            >
              <MdSearch
                className={
                  styles["admin-category-management-page__search-icon"]
                }
              />
              <input
                type="text"
                className={
                  styles["admin-category-management-page__search-input"]
                }
                placeholder="Tìm danh mục theo tên hoặc slug..."
                value={search}
                onChange={handleSearchChange}
              />
            </div>
          </div>
          <div className={styles["admin-category-management-page__filter-right"]}>
            <button
              type="button"
              className={styles["admin-category-management-page__sort-button"]}
            >
              <MdSort
                className={
                  styles["admin-category-management-page__sort-button-icon"]
                }
              />
              <span>Sắp xếp</span>
            </button>
          </div>
        </section>

        {/* Bảng danh mục cha */}
        <section className={styles["admin-category-management-page__table-card"]}>
          <div className={styles["admin-category-management-page__table-wrapper"]}>
            <table className={styles["admin-category-management-page__table"]}>
              <thead>
                <tr
                  className={
                    styles["admin-category-management-page__table-head-row"]
                  }
                >
                  <th
                    className={
                      styles["admin-category-management-page__table-head-cell"]
                    }
                  >
                    Tên danh mục
                  </th>
                  <th
                    className={
                      styles["admin-category-management-page__table-head-cell"]
                    }
                  >
                    Slug
                  </th>
                  <th
                    className={
                      styles["admin-category-management-page__table-head-cell"]
                    }
                  >
                    Mô tả
                  </th>
                  <th
                    className={
                      styles["admin-category-management-page__table-head-cell"]
                    }
                  >
                    Danh mục cha
                  </th>
                  <th
                    className={
                      styles["admin-category-management-page__table-head-cell"]
                    }
                  >
                    Số SP
                  </th>
                  <th
                    className={`${styles["admin-category-management-page__table-head-cell"]} ${styles["admin-category-management-page__table-head-cell--right"]}`}
                  >
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody
                className={styles["admin-category-management-page__table-body"]}
              >
                {parentError && !parentIsLoading && (
                  <tr>
                    <td
                      className={
                        styles["admin-category-management-page__empty-row"]
                      }
                      colSpan={6}
                    >
                      {parentError}
                    </td>
                  </tr>
                )}

                {!parentError && !parentIsLoading && parents.length === 0 && (
                  <tr>
                    <td
                      className={
                        styles["admin-category-management-page__empty-row"]
                      }
                      colSpan={6}
                    >
                      Không tìm thấy danh mục nào phù hợp.
                    </td>
                  </tr>
                )}

                {!parentError &&
                  parents.map((category) => {
                  const isTopLevel = category.isTopLevel;
                  const hasParent = Boolean(category.parentName);

                  return (
                    <tr
                      key={category.id}
                      className={
                        styles["admin-category-management-page__table-row"]
                      }
                      onClick={() => {
                        setSelectedParentId(category.id);
                        setSelectedParentName(category.name);
                        setSelectedCategoryForDetail(category);
                      }}
                    >
                      <td
                        className={
                          `${styles["admin-category-management-page__table-cell"]} ${
                            !isTopLevel
                              ? styles[
                                  "admin-category-management-page__table-cell--child"
                                ]
                              : ""
                          }`
                        }
                      >
                        <div
                          className={
                            styles["admin-category-management-page__name-cell"]
                          }
                        >
                          <div
                            className={
                              styles[
                                "admin-category-management-page__name-icon-wrapper"
                              ]
                            }
                          >
                            {isTopLevel ? (
                              <MdFolderOpen
                                className={
                                  styles[
                                    "admin-category-management-page__name-icon"
                                  ]
                                }
                              />
                            ) : (
                              <MdSubdirectoryArrowRight
                                className={
                                  styles[
                                    "admin-category-management-page__name-icon"
                                  ]
                                }
                              />
                            )}
                          </div>
                          <span
                            className={
                              styles[
                                "admin-category-management-page__name-text"
                              ]
                            }
                          >
                            {category.name}
                          </span>
                        </div>
                      </td>
                      <td
                        className={
                          styles["admin-category-management-page__table-cell"]
                        }
                      >
                        <code
                          className={
                            styles["admin-category-management-page__slug-pill"]
                          }
                        >
                          {category.slug}
                        </code>
                      </td>
                      <td
                        className={
                          styles["admin-category-management-page__table-cell"]
                        }
                      >
                        <span
                          className={
                            styles[
                              "admin-category-management-page__description-text"
                            ]
                          }
                          title={category.description ?? ""}
                        >
                          {category.description ?? "Chưa có mô tả"}
                        </span>
                      </td>
                      <td
                        className={
                          styles["admin-category-management-page__table-cell"]
                        }
                      >
                        {hasParent ? (
                          <span
                            className={
                              styles[
                                "admin-category-management-page__parent-text"
                              ]
                            }
                          >
                            {category.parentName}
                          </span>
                        ) : (
                          <span
                            className={
                              styles[
                                "admin-category-management-page__parent-placeholder"
                              ]
                            }
                          >
                            —
                          </span>
                        )}
                      </td>
                      <td
                        className={
                          styles["admin-category-management-page__table-cell"]
                        }
                      >
                        <span
                          className={
                            styles[
                              "admin-category-management-page__product-count-pill"
                            ]
                          }
                        >
                          {category.productCount}
                        </span>
                      </td>
                      <td
                        className={
                          styles["admin-category-management-page__table-cell"]
                        }
                      >
                        <div
                          className={
                            styles[
                              "admin-category-management-page__action-group"
                            ]
                          }
                        >
                          <button
                            type="button"
                            className={`${styles["admin-category-management-page__icon-button"]} ${styles["admin-category-management-page__icon-button--primary"]}`}
                            aria-label={`Chỉnh sửa danh mục ${category.name}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleOpenEditFromParent(category);
                            }}
                          >
                            <MdEdit
                              className={
                                styles[
                                  "admin-category-management-page__icon-button-icon"
                                ]
                              }
                            />
                          </button>
                          <button
                            type="button"
                            className={`${styles["admin-category-management-page__icon-button"]} ${styles["admin-category-management-page__icon-button--danger"]}`}
                            aria-label={`Xoá danh mục ${category.name}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleRequestDelete(category);
                            }}
                          >
                            <MdDelete
                              className={
                                styles[
                                  "admin-category-management-page__icon-button-icon"
                                ]
                              }
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className={styles["admin-category-management-page__pagination"]}>
            <p
              className={
                styles["admin-category-management-page__pagination-text"]
              }
            >
              Hiển thị{" "}
              <strong>
                {from}–{to}
              </strong>{" "}
              trong tổng số <strong>{parentTotal}</strong> danh mục cha
            </p>
            <div
              className={
                styles[
                  "admin-category-management-page__pagination-controls"
                ]
              }
            >
              <button
                type="button"
                className={
                  styles[
                    "admin-category-management-page__pagination-button"
                  ]
                }
                onClick={() => handleChangePage(parentPage - 1)}
                disabled={parentPage <= 1}
              >
                <MdChevronLeft />
                <span>Trước</span>
              </button>
              <div
                className={
                  styles[
                    "admin-category-management-page__pagination-pages"
                  ]
                }
              >
                {pagesToRender.map((page, index) => {
                  const isEllipsis =
                    index > 0 && page - pagesToRender[index - 1] > 1;
                  return (
                    <React.Fragment key={page}>
                      {isEllipsis && (
                        <span
                          className={
                            styles[
                              "admin-category-management-page__page-ellipsis"
                            ]
                          }
                        >
                          ...
                        </span>
                      )}
                      <button
                        type="button"
                        className={`${styles["admin-category-management-page__page-pill"]} ${
                          page === parentPage
                            ? styles[
                                "admin-category-management-page__page-pill--active"
                              ]
                            : ""
                        }`}
                        onClick={() => handleChangePage(page)}
                      >
                        {page}
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>
              <button
                type="button"
                className={
                  styles[
                    "admin-category-management-page__pagination-button"
                  ]
                }
                onClick={() => handleChangePage(parentPage + 1)}
                disabled={parentPage >= totalPages}
              >
                <span>Sau</span>
                <MdChevronRight />
              </button>
            </div>
          </div>
        </section>

        {/* Bảng danh mục con */}
        <section className={styles["admin-category-management-page__table-card"]}>
          <div className={styles["admin-category-management-page__table-wrapper"]}>
            <table className={styles["admin-category-management-page__table"]}>
              <thead>
                <tr
                  className={
                    styles["admin-category-management-page__table-head-row"]
                  }
                >
                  <th
                    className={
                      styles["admin-category-management-page__table-head-cell"]
                    }
                  >
                    {selectedParentName
                      ? `Danh mục con của "${selectedParentName}"`
                      : "Danh mục con"}
                  </th>
                  <th
                    className={
                      styles["admin-category-management-page__table-head-cell"]
                    }
                  >
                    Slug
                  </th>
                  <th
                    className={
                      styles["admin-category-management-page__table-head-cell"]
                    }
                  >
                    Mô tả
                  </th>
                  <th
                    className={
                      styles["admin-category-management-page__table-head-cell"]
                    }
                  >
                    Số SP
                  </th>
                  <th
                    className={`${styles["admin-category-management-page__table-head-cell"]} ${styles["admin-category-management-page__table-head-cell--right"]}`}
                  >
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody
                className={styles["admin-category-management-page__table-body"]}
              >
                {childrenError && !childrenIsLoading && (
                  <tr>
                    <td
                      className={
                        styles["admin-category-management-page__empty-row"]
                      }
                      colSpan={5}
                    >
                      {childrenError}
                    </td>
                  </tr>
                )}

                {!childrenError &&
                  !childrenIsLoading &&
                  selectedParentId &&
                  children.length === 0 && (
                    <tr>
                      <td
                        className={
                          styles["admin-category-management-page__empty-row"]
                        }
                        colSpan={5}
                      >
                        Danh mục này chưa có danh mục con.
                      </td>
                    </tr>
                  )}

                {!childrenError &&
                  children.map((category) => (
                    <tr
                      key={category.id}
                      className={
                        styles["admin-category-management-page__table-row"]
                      }
                      onClick={() => {
                        setSelectedCategoryForDetail(category);
                      }}
                    >
                      <td
                        className={
                          `${styles["admin-category-management-page__table-cell"]} ${styles["admin-category-management-page__table-cell--child"]}`
                        }
                      >
                        <div
                          className={
                            styles["admin-category-management-page__name-cell"]
                          }
                        >
                          <div
                            className={
                              styles[
                                "admin-category-management-page__name-icon-wrapper"
                              ]
                            }
                          >
                            <MdSubdirectoryArrowRight
                              className={
                                styles[
                                  "admin-category-management-page__name-icon"
                                ]
                              }
                            />
                          </div>
                          <span
                            className={
                              styles[
                                "admin-category-management-page__name-text"
                              ]
                            }
                          >
                            {category.name}
                          </span>
                        </div>
                      </td>
                      <td
                        className={
                          styles["admin-category-management-page__table-cell"]
                        }
                      >
                        <code
                          className={
                            styles["admin-category-management-page__slug-pill"]
                          }
                        >
                          {category.slug}
                        </code>
                      </td>
                      <td
                        className={
                          styles["admin-category-management-page__table-cell"]
                        }
                      >
                        <span
                          className={
                            styles[
                              "admin-category-management-page__description-text"
                            ]
                          }
                          title={category.description ?? ""}
                        >
                          {category.description ?? "Chưa có mô tả"}
                        </span>
                      </td>
                      <td
                        className={
                          styles["admin-category-management-page__table-cell"]
                        }
                      >
                        <span
                          className={
                            styles[
                              "admin-category-management-page__product-count-pill"
                            ]
                          }
                        >
                          {category.productCount}
                        </span>
                      </td>
                      <td
                        className={
                          styles["admin-category-management-page__table-cell"]
                        }
                      >
                        <div
                          className={
                            styles[
                              "admin-category-management-page__action-group"
                            ]
                          }
                        >
                          <button
                            type="button"
                            className={`${styles["admin-category-management-page__icon-button"]} ${styles["admin-category-management-page__icon-button--primary"]}`}
                            aria-label={`Chỉnh sửa danh mục ${category.name}`}
                            onClick={() => handleOpenEditFromChild(category)}
                          >
                            <MdEdit
                              className={
                                styles[
                                  "admin-category-management-page__icon-button-icon"
                                ]
                              }
                            />
                          </button>
                          <button
                            type="button"
                            className={`${styles["admin-category-management-page__icon-button"]} ${styles["admin-category-management-page__icon-button--danger"]}`}
                            aria-label={`Xoá danh mục ${category.name}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleRequestDelete(category);
                            }}
                          >
                            <MdDelete
                              className={
                                styles[
                                  "admin-category-management-page__icon-button-icon"
                                ]
                              }
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Chi tiết danh mục được chọn */}
        <section className={styles["admin-category-management-page__detail-card"]}>
          <div
            className={
              styles["admin-category-management-page__detail-header"]
            }
          >
            <div>
              <h2
                className={
                  styles["admin-category-management-page__detail-title"]
                }
              >
                {selectedCategoryForDetail
                  ? `Chi tiết danh mục: ${selectedCategoryForDetail.name}`
                  : "Chi tiết danh mục"}
              </h2>
              <p
                className={
                  styles["admin-category-management-page__detail-subtitle"]
                }
              >
                Xem nhanh thông tin danh mục cha hoặc danh mục con để hỗ trợ cấu
                hình sản phẩm và chuẩn bị dữ liệu cho AI tư vấn.
              </p>
            </div>
          </div>

          {selectedCategoryForDetail ? (
            <div
              className={
                styles["admin-category-management-page__detail-body"]
              }
            >
              <div
                className={
                  styles["admin-category-management-page__detail-row"]
                }
              >
                <span
                  className={
                    styles["admin-category-management-page__detail-label"]
                  }
                >
                  Tên danh mục
                </span>
                <span
                  className={
                    styles["admin-category-management-page__detail-value"]
                  }
                >
                  {selectedCategoryForDetail.name}
                </span>
              </div>

              <div
                className={
                  styles["admin-category-management-page__detail-row"]
                }
              >
                <span
                  className={
                    styles["admin-category-management-page__detail-label"]
                  }
                >
                  Slug
                </span>
                <code
                  className={
                    styles["admin-category-management-page__detail-slug-pill"]
                  }
                >
                  {selectedCategoryForDetail.slug}
                </code>
              </div>

              <div
                className={
                  styles["admin-category-management-page__detail-row"]
                }
              >
                <span
                  className={
                    styles["admin-category-management-page__detail-label"]
                  }
                >
                  Loại danh mục
                </span>
                <span
                  className={
                    styles["admin-category-management-page__detail-value-pill"]
                  }
                >
                  {selectedCategoryForDetail.isTopLevel
                    ? "Danh mục cha (cấp cao nhất)"
                    : "Danh mục con"}
                </span>
              </div>

              <div
                className={
                  styles["admin-category-management-page__detail-row"]
                }
              >
                <span
                  className={
                    styles["admin-category-management-page__detail-label"]
                  }
                >
                  Danh mục cha
                </span>
                <span
                  className={
                    styles["admin-category-management-page__detail-value"]
                  }
                >
                  {selectedCategoryForDetail.parentName ??
                    (selectedCategoryForDetail.isTopLevel
                      ? "Không có (danh mục gốc)"
                      : "Chưa thiết lập")}
                </span>
              </div>

              <div
                className={
                  styles["admin-category-management-page__detail-row"]
                }
              >
                <span
                  className={
                    styles["admin-category-management-page__detail-label"]
                  }
                >
                  Số sản phẩm
                </span>
                <span
                  className={
                    styles[
                      "admin-category-management-page__detail-product-count-pill"
                    ]
                  }
                >
                  {selectedCategoryForDetail.productCount}
                </span>
              </div>

              <div
                className={
                  styles["admin-category-management-page__detail-row"]
                }
              >
                <span
                  className={
                    styles["admin-category-management-page__detail-label"]
                  }
                >
                  Mô tả
                </span>
                <p
                  className={
                    styles[
                      "admin-category-management-page__detail-description-text"
                    ]
                  }
                >
                  {selectedCategoryForDetail.description ??
                    "Chưa có mô tả chi tiết cho danh mục này. Bạn có thể thêm mô tả trong popup chỉnh sửa để AI hiểu rõ hơn về nhóm sản phẩm này."}
                </p>
              </div>
            </div>
          ) : (
            <div
              className={
                styles["admin-category-management-page__detail-empty"]
              }
            >
              <p>
                Chọn một danh mục ở bảng bên trên để xem chi tiết. Thông tin này
                giúp bạn kiểm tra nhanh cấu trúc danh mục và chuẩn bị dữ liệu
                cho các tính năng AI tư vấn sau này.
              </p>
            </div>
          )}
        </section>

        <AdminCategoryUpsertModal
          mode="create"
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onCompleted={() => {
            // Reload lại danh sách cha + con
            setParentPage(1);
            setSelectedParentId(null);
          }}
          parentOptions={parentOptions}
        />

        {editingCategory && (
          <AdminCategoryUpsertModal
            mode="edit"
            isOpen={isEditOpen}
            category={editingCategory}
            onClose={() => setIsEditOpen(false)}
            onCompleted={() => {
              setParentPage(1);
              setSelectedParentId(editingCategory.parentId ?? null);
              setChildrenReloadToken((token) => token + 1);
            }}
            parentOptions={parentOptions}
          />
        )}

        <ConfirmActionDialog
          isOpen={Boolean(categoryToDelete)}
          title={
            categoryToDelete
              ? `Bạn có chắc chắn muốn xoá danh mục "${categoryToDelete.name}"?`
              : ""
          }
          description={
            categoryToDelete
              ? "Danh mục này và các danh mục con trực tiếp của nó sẽ bị xoá khỏi hệ thống. Tất cả sản phẩm đang thuộc các danh mục này sẽ được giữ nguyên nhưng không còn gắn với bất kỳ danh mục nào. Bạn nên kiểm tra lại trước khi xác nhận."
              : undefined
          }
          confirmLabel="Tôi hiểu, xoá danh mục"
          cancelLabel="Huỷ"
          isConfirmLoading={isDeleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => {
            if (isDeleting) return;
            setCategoryToDelete(null);
          }}
        />
      </div>
    </div>
  );
};

export default AdminCategoryManagementPage;

