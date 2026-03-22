"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MdAdd,
  MdChevronLeft,
  MdChevronRight,
  MdDelete,
  MdEdit,
  MdFilterList,
  MdNotifications,
  MdSearch,
} from "react-icons/md";
import { toast } from "sonner";
import DataLoadingOverlay from "@/components/shared/DataLoadingOverlay";
import ConfirmActionDialog from "@/components/shared/ConfirmActionDialog";
import AdminUserCreateForm from "./AdminUserCreateForm";
import styles from "./AdminUserManagementPage.module.css";

type AdminUserListItem = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  emailVerified: string | null;
  role: "USER" | "ADMIN";
  createdAt: string;
  cartProductCount: number;
  purchasedProductCount: number;
};

type AdminUserListResponse = {
  data: AdminUserListItem[];
  total: number;
  page: number;
  pageSize: number;
};

const PAGE_SIZE = 10;

const getInitialsFromNameOrEmail = (name: string | null, email: string | null): string => {
  if (name && name.trim().length > 0) {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  if (email && email.trim().length > 0) {
    const localPart = email.split("@")[0];
    return localPart.slice(0, 2).toUpperCase();
  }

  return "US";
};

const formatJoinDate = (isoString: string): string => {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const AdminUserManagementPage: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | "ADMIN" | "USER">("");
  const [emailVerifiedFilter, setEmailVerifiedFilter] = useState<
    "" | "verified" | "unverified"
  >("");
  const [purchaseStatusFilter, setPurchaseStatusFilter] = useState<
    "" | "hasOrders" | "noOrders"
  >("");
  const [cartStatusFilter, setCartStatusFilter] = useState<
    "" | "hasCart" | "noCart"
  >("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [userToDelete, setUserToDelete] = useState<AdminUserListItem | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const currentPage = useMemo(() => {
    const pageParam = searchParams.get("page");
    const parsed = pageParam ? Number(pageParam) : 1;
    if (!Number.isFinite(parsed) || parsed < 1) return 1;
    return parsed;
  }, [searchParams]);

  const totalPages = useMemo(() => {
    if (total === 0) return 1;
    return Math.max(1, Math.ceil(total / PAGE_SIZE));
  }, [total]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchUsers = async () => {
      setIsLoading(true);
      setShowLoadingOverlay(true);
      const startedAt = performance.now();
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("page", String(currentPage));
        params.set("pageSize", String(PAGE_SIZE));
        if (search.trim()) {
          params.set("search", search.trim());
        }
        if (roleFilter) {
          params.set("role", roleFilter);
        }
        if (emailVerifiedFilter) {
          params.set("emailVerified", emailVerifiedFilter);
        }
        if (purchaseStatusFilter) {
          params.set("purchaseStatus", purchaseStatusFilter);
        }
        if (cartStatusFilter) {
          params.set("cartStatus", cartStatusFilter);
        }
        if (createdFrom) {
          params.set("createdFrom", createdFrom);
        }
        if (createdTo) {
          params.set("createdTo", createdTo);
        }

        const response = await fetch(`/api/admin/users?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Không thể tải danh sách người dùng.");
        }

        const json = (await response.json()) as AdminUserListResponse;
        setUsers(json.data);
        setTotal(json.total);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        setError("Đã xảy ra lỗi khi tải danh sách người dùng.");
      } finally {
        const elapsed = performance.now() - startedAt;
        const minimum = 1100;
        const remaining = minimum - elapsed;

        if (remaining > 0) {
          window.setTimeout(() => {
            setIsLoading(false);
            setShowLoadingOverlay(false);
          }, remaining);
        } else {
          setIsLoading(false);
          setShowLoadingOverlay(false);
        }
      }
    };

    void fetchUsers();

    return () => {
      controller.abort();
    };
  }, [
    currentPage,
    search,
    roleFilter,
    emailVerifiedFilter,
    purchaseStatusFilter,
    cartStatusFilter,
    createdFrom,
    createdTo,
    reloadKey,
  ]);

  const handleChangePage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(page));
    }
    router.push(`/admin/users?${params.toString()}`);
  };

  const from = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const to = total === 0 ? 0 : Math.min(currentPage * PAGE_SIZE, total);

  const handleSearchInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
    handleChangePage(1);
  };

  const handleRoleFilterChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    if (value === "") {
      setRoleFilter("");
    } else if (value === "ADMIN" || value === "USER") {
      setRoleFilter(value);
    }
    handleChangePage(1);
  };

  const handleUserCreated = () => {
    setReloadKey((previous) => previous + 1);
    toast.success("Danh sách người dùng đã được cập nhật.");
  };

  const handleDeleteUserConfirmed = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/users/${userToDelete.id}`, {
        method: "DELETE",
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(json.error ?? "Không thể xoá người dùng.");
        return;
      }
      toast.success("Đã xoá người dùng thành công.");
      setUserToDelete(null);
      setReloadKey((previous) => previous + 1);
    } catch {
      toast.error("Đã xảy ra lỗi khi xoá người dùng. Vui lòng thử lại.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEmailVerifiedFilterChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const value = event.target.value;
    if (value === "verified" || value === "unverified" || value === "") {
      setEmailVerifiedFilter(value);
      handleChangePage(1);
    }
  };

  const handlePurchaseStatusFilterChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const value = event.target.value;
    if (value === "hasOrders" || value === "noOrders" || value === "") {
      setPurchaseStatusFilter(value);
      handleChangePage(1);
    }
  };

  const handleCartStatusFilterChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const value = event.target.value;
    if (value === "hasCart" || value === "noCart" || value === "") {
      setCartStatusFilter(value);
      handleChangePage(1);
    }
  };

  const handleCreatedFromChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCreatedFrom(event.target.value);
    handleChangePage(1);
  };

  const handleCreatedToChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCreatedTo(event.target.value);
    handleChangePage(1);
  };

  const renderStatusPill = (user: AdminUserListItem) => {
    const isEmailVerified = Boolean(user.emailVerified);
    const hasPurchased = user.purchasedProductCount > 0;

    let label = "Hoạt động";
    let modifierClass =
      styles["admin-user-management-page__status-pill--active"];

    if (!isEmailVerified) {
      label = "Chưa xác thực email";
      modifierClass =
        styles["admin-user-management-page__status-pill--email-unverified"];
    } else if (hasPurchased) {
      label = "Đã có đơn hàng";
      modifierClass =
        styles["admin-user-management-page__status-pill--active"];
    } else {
      label = "Hoạt động";
      modifierClass =
        styles["admin-user-management-page__status-pill--neutral"];
    }

    return (
      <span
        className={`${styles["admin-user-management-page__status-pill"]} ${modifierClass}`}
      >
        {label}
      </span>
    );
  };

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

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i += 1) {
      pages.push(i);
    }

    if (!pages.includes(totalPages)) {
      pages.push(totalPages);
    }

    return pages;
  }, [currentPage, totalPages]);

  return (
    <div className={styles["admin-user-management-page"]}>
      <header className={styles["admin-user-management-page__header"]}>
        <h1 className={styles["admin-user-management-page__header-title"]}>
          Quản lý người dùng
        </h1>
        <div className={styles["admin-user-management-page__header-actions"]}>
          <button
            type="button"
            className={styles["admin-user-management-page__primary-button"]}
            onClick={() => setIsCreateUserOpen(true)}
          >
            <MdAdd className={styles["admin-user-management-page__primary-button-icon"]} />
            <span>Thêm người dùng</span>
          </button>
          <button
            type="button"
            className={styles["admin-user-management-page__notification-button"]}
            aria-label="Thông báo"
          >
            <MdNotifications />
            <span
              className={styles["admin-user-management-page__notification-dot"]}
            />
          </button>
        </div>
      </header>

      <div className={styles["admin-user-management-page__content"]}>
        <section className={styles["admin-user-management-page__filter-card"]}>
          <div className={styles["admin-user-management-page__filter-left"]}>
            <div className={styles["admin-user-management-page__search-wrapper"]}>
              <MdSearch
                className={styles["admin-user-management-page__search-icon"]}
              />
              <input
                type="text"
                className={styles["admin-user-management-page__search-input"]}
                placeholder="Tìm theo tên hoặc email..."
                value={search}
                onChange={handleSearchInputChange}
              />
            </div>
          </div>
          <div className={styles["admin-user-management-page__filter-right"]}>
            <select
              className={styles["admin-user-management-page__select"]}
              value={roleFilter}
              onChange={handleRoleFilterChange}
            >
              <option value="">Tất cả vai trò</option>
              <option value="ADMIN">Admin</option>
              <option value="USER">Khách hàng</option>
            </select>
            <button
              type="button"
              className={styles["admin-user-management-page__more-filters"]}
              onClick={() => setShowAdvancedFilters((prev) => !prev)}
            >
              <MdFilterList />
              <span>Bộ lọc nâng cao</span>
            </button>
          </div>
          {showAdvancedFilters && (
            <div className={styles["admin-user-management-page__advanced-filters"]}>
              <div className={styles["admin-user-management-page__advanced-filter-group"]}>
                <span className={styles["admin-user-management-page__advanced-filter-label"]}>
                  Trạng thái email
                </span>
                <select
                  className={
                    styles["admin-user-management-page__advanced-filter-select"]
                  }
                  value={emailVerifiedFilter}
                  onChange={handleEmailVerifiedFilterChange}
                >
                  <option value="">Tất cả</option>
                  <option value="verified">Đã xác thực</option>
                  <option value="unverified">Chưa xác thực</option>
                </select>
              </div>
              <div className={styles["admin-user-management-page__advanced-filter-group"]}>
                <span className={styles["admin-user-management-page__advanced-filter-label"]}>
                  Hoạt động mua hàng
                </span>
                <select
                  className={
                    styles["admin-user-management-page__advanced-filter-select"]
                  }
                  value={purchaseStatusFilter}
                  onChange={handlePurchaseStatusFilterChange}
                >
                  <option value="">Tất cả</option>
                  <option value="hasOrders">Đã từng mua</option>
                  <option value="noOrders">Chưa có đơn hàng</option>
                </select>
              </div>
              <div className={styles["admin-user-management-page__advanced-filter-group"]}>
                <span className={styles["admin-user-management-page__advanced-filter-label"]}>
                  Giỏ hàng
                </span>
                <select
                  className={
                    styles["admin-user-management-page__advanced-filter-select"]
                  }
                  value={cartStatusFilter}
                  onChange={handleCartStatusFilterChange}
                >
                  <option value="">Tất cả</option>
                  <option value="hasCart">Có giỏ hàng</option>
                  <option value="noCart">Chưa có giỏ hàng</option>
                </select>
              </div>
              <div className={styles["admin-user-management-page__advanced-filter-group"]}>
                <span className={styles["admin-user-management-page__advanced-filter-label"]}>
                  Ngày tham gia từ
                </span>
                <input
                  type="date"
                  className={
                    styles["admin-user-management-page__advanced-filter-input"]
                  }
                  value={createdFrom}
                  onChange={handleCreatedFromChange}
                />
              </div>
              <div className={styles["admin-user-management-page__advanced-filter-group"]}>
                <span className={styles["admin-user-management-page__advanced-filter-label"]}>
                  Ngày tham gia đến
                </span>
                <input
                  type="date"
                  className={
                    styles["admin-user-management-page__advanced-filter-input"]
                  }
                  value={createdTo}
                  onChange={handleCreatedToChange}
                />
              </div>
            </div>
          )}
        </section>

        <section className={styles["admin-user-management-page__table-card"]}>
          <div className={styles["admin-user-management-page__table-wrapper"]}>
            <DataLoadingOverlay
              isActive={showLoadingOverlay}
              subtitle="Đang tải danh sách người dùng..."
              bottomText="Đang đồng bộ dữ liệu người dùng từ hệ thống..."
            />
            <table className={styles["admin-user-management-page__table"]}>
              <thead>
                <tr className={styles["admin-user-management-page__table-head-row"]}>
                  <th
                    className={styles["admin-user-management-page__table-head-cell"]}
                  >
                    Người dùng
                  </th>
                  <th
                    className={styles["admin-user-management-page__table-head-cell"]}
                  >
                    Vai trò
                  </th>
                  <th
                    className={styles["admin-user-management-page__table-head-cell"]}
                  >
                    Ngày tham gia
                  </th>
                  <th
                    className={styles["admin-user-management-page__table-head-cell"]}
                  >
                    SP trong giỏ hàng
                  </th>
                  <th
                    className={styles["admin-user-management-page__table-head-cell"]}
                  >
                    SP đã mua
                  </th>
                  <th
                    className={styles["admin-user-management-page__table-head-cell"]}
                  >
                    Trạng thái
                  </th>
                  <th
                    className={`${styles["admin-user-management-page__table-head-cell"]} ${styles["admin-user-management-page__table-head-cell--right"]}`}
                  >
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className={styles["admin-user-management-page__table-body"]}>
                {error && !isLoading && (
                  <tr>
                    <td
                      className={styles["admin-user-management-page__error-row"]}
                      colSpan={5}
                    >
                      {error}
                    </td>
                  </tr>
                )}
                {!isLoading && !error && users.length === 0 && (
                  <tr>
                    <td
                      className={styles["admin-user-management-page__empty"]}
                      colSpan={5}
                    >
                      Không tìm thấy người dùng nào phù hợp.
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  !error &&
                  users.map((user) => {
                    const initials = getInitialsFromNameOrEmail(
                      user.name,
                      user.email
                    );
                    const joinDate = formatJoinDate(user.createdAt);

                    return (
                      <tr
                        key={user.id}
                        className={styles["admin-user-management-page__table-row"]}
                        onClick={() => router.push(`/admin/users/${user.id}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            router.push(`/admin/users/${user.id}`);
                          }
                        }}
                      >
                        <td
                          className={styles["admin-user-management-page__table-cell"]}
                        >
                          <div
                            className={
                              styles["admin-user-management-page__user-cell"]
                            }
                          >
                            <div
                              className={`${styles["admin-user-management-page__avatar"]} ${
                                !user.image
                                  ? styles[
                                      "admin-user-management-page__avatar--fallback"
                                    ]
                                  : ""
                              }`}
                            >
                              {user.image ? (
                                <img
                                  src={user.image}
                                  alt={user.name ?? user.email ?? "User avatar"}
                                  className={
                                    styles["admin-user-management-page__avatar-image"]
                                  }
                                />
                              ) : (
                                initials
                              )}
                            </div>
                            <div
                              className={
                                styles["admin-user-management-page__user-texts"]
                              }
                            >
                              <p
                                className={
                                  styles["admin-user-management-page__user-name"]
                                }
                              >
                                {user.name ?? "Người dùng chưa có tên"}
                              </p>
                              <p
                                className={
                                  styles["admin-user-management-page__user-email"]
                                }
                              >
                                {user.email ?? "Không có email"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td
                          className={styles["admin-user-management-page__table-cell"]}
                        >
                          <span
                            className={`${styles["admin-user-management-page__role-badge"]} ${
                              user.role === "ADMIN"
                                ? styles[
                                    "admin-user-management-page__role-badge--admin"
                                  ]
                                : styles[
                                    "admin-user-management-page__role-badge--user"
                                  ]
                            }`}
                          >
                            {user.role === "ADMIN" ? "Admin" : "Khách hàng"}
                          </span>
                        </td>
                        <td
                          className={styles["admin-user-management-page__table-cell"]}
                        >
                          {joinDate}
                        </td>
                        <td
                          className={styles["admin-user-management-page__table-cell"]}
                        >
                          {user.cartProductCount}
                        </td>
                        <td
                          className={styles["admin-user-management-page__table-cell"]}
                        >
                          {user.purchasedProductCount}
                        </td>
                        <td
                          className={styles["admin-user-management-page__table-cell"]}
                        >
                          {renderStatusPill(user)}
                        </td>
                        <td
                          className={styles["admin-user-management-page__table-cell"]}
                        >
                          <div
                            className={
                              styles["admin-user-management-page__action-group"]
                            }
                          >
                            <button
                              type="button"
                              className={`${styles["admin-user-management-page__icon-button"]} ${styles["admin-user-management-page__icon-button--primary"]}`}
                              aria-label="Chỉnh sửa người dùng"
                              onClick={(event) => {
                                event.stopPropagation();
                                router.push(`/admin/users/${user.id}/edit`);
                              }}
                            >
                              <MdEdit
                                className={
                                  styles[
                                    "admin-user-management-page__icon-button-icon"
                                  ]
                                }
                              />
                            </button>
                            <button
                              type="button"
                              className={`${styles["admin-user-management-page__icon-button"]} ${styles["admin-user-management-page__icon-button--danger"]}`}
                              aria-label="Xoá người dùng"
                              onClick={(event) => {
                                event.stopPropagation();
                                setUserToDelete(user);
                              }}
                            >
                              <MdDelete
                                className={
                                  styles[
                                    "admin-user-management-page__icon-button-icon"
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
          <div className={styles["admin-user-management-page__pagination"]}>
            <p className={styles["admin-user-management-page__pagination-text"]}>
              Hiển thị{" "}
              <strong>
                {from}–{to}
              </strong>{" "}
              trong tổng số <strong>{total}</strong> người dùng
            </p>
            <div
              className={
                styles["admin-user-management-page__pagination-controls"]
              }
            >
              <button
                type="button"
                className={
                  styles["admin-user-management-page__pagination-button"]
                }
                onClick={() => handleChangePage(currentPage - 1)}
                disabled={currentPage <= 1}
              >
                <MdChevronLeft />
                <span>Trước</span>
              </button>
              <div
                className={
                  styles["admin-user-management-page__pagination-pages"]
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
                            styles["admin-user-management-page__page-ellipsis"]
                          }
                        >
                          ...
                        </span>
                      )}
                      <button
                        type="button"
                        className={`${styles["admin-user-management-page__page-pill"]} ${
                          page === currentPage
                            ? styles[
                                "admin-user-management-page__page-pill--active"
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
                  styles["admin-user-management-page__pagination-button"]
                }
                onClick={() => handleChangePage(currentPage + 1)}
                disabled={currentPage >= totalPages}
              >
                <span>Sau</span>
                <MdChevronRight />
              </button>
            </div>
          </div>
        </section>
      </div>
      <AdminUserCreateForm
        isOpen={isCreateUserOpen}
        onClose={() => setIsCreateUserOpen(false)}
        onCreated={handleUserCreated}
      />
      <ConfirmActionDialog
        isOpen={Boolean(userToDelete)}
        title={
          userToDelete
            ? `Bạn có chắc chắn muốn xoá người dùng "${userToDelete.name ?? "không tên"}"?`
            : ""
        }
        description="Thao tác này không thể hoàn tác. Các đơn hàng đã tạo vẫn được giữ nguyên nhưng tài khoản người dùng sẽ bị xoá khỏi hệ thống."
        confirmLabel="Xoá người dùng"
        cancelLabel="Huỷ"
        isConfirmLoading={isDeleting}
        onConfirm={handleDeleteUserConfirmed}
        onCancel={() => {
          if (isDeleting) return;
          setUserToDelete(null);
        }}
      />
    </div>
  );
};

export default AdminUserManagementPage;

