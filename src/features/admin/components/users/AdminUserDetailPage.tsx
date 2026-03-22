"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  MdArrowBack,
  MdCalendarMonth,
  MdEdit,
  MdLocalShipping,
  MdLocationOn,
  MdLockReset,
  MdNotifications,
  MdPerson,
  MdPhotoCamera,
  MdReceiptLong,
  MdSettings,
  MdShoppingBag,
  MdShoppingCart,
} from "react-icons/md";
import { toast } from "sonner";
import styles from "./AdminUserDetailPage.module.css";

type AdminUserDetailPageProps = {
  userId: string;
};

type AdminUserDetailResponse = {
  data: {
    user: {
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
      role: "USER" | "ADMIN";
      createdAt: string;
      emailVerified: string | null;
    };
    stats: {
      totalOrders: number;
      completedOrders: number;
      cartItemCount: number;
      cartDistinctProducts: number;
    };
    cart: {
      id: string;
      status: string;
      items: Array<{
        id: string;
        quantity: number;
        unitPrice: string;
        product: {
          id: string;
          name: string;
        };
      }>;
    } | null;
    orders: Array<{
      id: string;
      status: string;
      totalAmount: string;
      currency: string;
      createdAt: string;
    }>;
    addresses: Array<{
      id: string;
      fullName: string;
      phone: string;
      line1: string;
      line2: string | null;
      ward: string | null;
      district: string | null;
      province: string | null;
      country: string;
      postalCode: string | null;
      isDefault: boolean;
      createdAt: string;
    }>;
  };
};

type ActiveTab = "info" | "cart" | "orders" | "addresses";

const formatVietnameseDate = (isoString: string | null): string => {
  if (!isoString) return "Chưa cập nhật";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "Chưa cập nhật";
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const getInitials = (name: string | null, email: string | null): string => {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  if (email?.trim()) {
    return email.trim().slice(0, 2).toUpperCase();
  }
  return "US";
};

const formatCurrencyVnd = (value: number): string =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);

const AdminUserDetailPage: React.FC<AdminUserDetailPageProps> = ({ userId }) => {
  const router = useRouter();

  const [data, setData] = useState<AdminUserDetailResponse["data"] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("info");

  useEffect(() => {
    let aborted = false;
    const fetchDetail = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/admin/users/${userId}`);
        const json = (await response.json()) as
          | AdminUserDetailResponse
          | { error?: string };

        if (!response.ok) {
          if ("error" in json && json.error) {
            throw new Error(json.error);
          }
          throw new Error("Không thể tải chi tiết người dùng.");
        }

        if (!aborted && "data" in json) {
          setData(json.data);
        }
      } catch (err) {
        if (!aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "Đã xảy ra lỗi khi tải chi tiết người dùng.",
          );
        }
      } finally {
        if (!aborted) {
          setIsLoading(false);
        }
      }
    };

    void fetchDetail();

    return () => {
      aborted = true;
    };
  }, [userId]);

  const joinDate = useMemo(
    () => (data ? formatVietnameseDate(data.user.createdAt) : ""),
    [data],
  );

  const handleBack = () => {
    router.push("/admin/users");
  };

  const handleNotImplemented = () => {
    toast.info("Tính năng này sẽ được bổ sung sau.");
  };

  const cartTotals = useMemo(() => {
    if (!data?.cart || data.cart.items.length === 0) {
      return {
        itemCount: 0,
        subtotal: 0,
        vat: 0,
        total: 0,
      };
    }

    const subtotal = data.cart.items.reduce((sum, item) => {
      const unit = Number.parseFloat(item.unitPrice ?? "0");
      if (!Number.isFinite(unit)) return sum;
      return sum + unit * item.quantity;
    }, 0);

    const vat = subtotal * 0.1;
    const total = subtotal + vat;
    const itemCount = data.cart.items.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );

    return {
      itemCount,
      subtotal,
      vat,
      total,
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className={styles["admin-user-detail-page"]}>
        <header className={styles["admin-user-detail-page__header"]}>
          <div className={styles["admin-user-detail-page__header-left"]}>
            <button
              type="button"
              className={styles["admin-user-detail-page__back-button"]}
              onClick={handleBack}
            >
              <MdArrowBack />
              <span>Quay lại danh sách</span>
            </button>
            <h1 className={styles["admin-user-detail-page__header-title"]}>
              Chi tiết người dùng
            </h1>
          </div>
        </header>
        <main className={styles["admin-user-detail-page__content"]}>
          <p className={styles["admin-user-detail-page__empty-text"]}>
            Đang tải thông tin người dùng...
          </p>
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles["admin-user-detail-page"]}>
        <header className={styles["admin-user-detail-page__header"]}>
          <div className={styles["admin-user-detail-page__header-left"]}>
            <button
              type="button"
              className={styles["admin-user-detail-page__back-button"]}
              onClick={handleBack}
            >
              <MdArrowBack />
              <span>Quay lại danh sách</span>
            </button>
            <h1 className={styles["admin-user-detail-page__header-title"]}>
              Chi tiết người dùng
            </h1>
          </div>
        </header>
        <main className={styles["admin-user-detail-page__content"]}>
          <p className={styles["admin-user-detail-page__error-text"]}>
            {error ?? "Không tìm thấy thông tin người dùng."}
          </p>
        </main>
      </div>
    );
  }

  const initials = getInitials(data.user.name, data.user.email);

  const defaultAddress = data.addresses.find((address) => address.isDefault);

  return (
    <div className={styles["admin-user-detail-page"]}>
      <header className={styles["admin-user-detail-page__header"]}>
        <div className={styles["admin-user-detail-page__header-left"]}>
          <button
            type="button"
            className={styles["admin-user-detail-page__back-button"]}
            onClick={handleBack}
          >
            <MdArrowBack />
            <span>Quay lại danh sách</span>
          </button>
          <h1 className={styles["admin-user-detail-page__header-title"]}>
            Chi tiết người dùng
          </h1>
        </div>
        <button
          type="button"
          className={styles["admin-user-detail-page__header-notification-button"]}
          aria-label="Thông báo"
        >
          <MdNotifications />
          <span
            className={
              styles["admin-user-detail-page__header-notification-dot"]
            }
          />
        </button>
      </header>

      <main className={styles["admin-user-detail-page__content"]}>
        <section
          className={`${styles["admin-user-detail-page__card"]} ${styles["admin-user-detail-page__summary"]}`}
        >
          <div className={styles["admin-user-detail-page__summary-main"]}>
            <div className={styles["admin-user-detail-page__summary-header"]}>
              <div className={styles["admin-user-detail-page__avatar-wrapper"]}>
                <div className={styles["admin-user-detail-page__avatar-shell"]}>
                  {data.user.image ? (
                    <img
                      src={data.user.image}
                      alt={data.user.name ?? data.user.email ?? "Avatar"}
                      className={styles["admin-user-detail-page__avatar-image"]}
                    />
                  ) : (
                    initials
                  )}
                </div>
                <button
                  type="button"
                  className={
                    styles["admin-user-detail-page__avatar-change-button"]
                  }
                  onClick={handleNotImplemented}
                  aria-label="Thay đổi ảnh đại diện"
                >
                  <MdPhotoCamera />
                </button>
              </div>
              <div
                className={styles["admin-user-detail-page__summary-name-row"]}
              >
                <h2 className={styles["admin-user-detail-page__summary-name"]}>
                  {data.user.name ?? "Người dùng chưa có tên"}
                </h2>
                <span
                  className={`${styles["admin-user-detail-page__status-pill"]} ${styles["admin-user-detail-page__status-pill--active"]}`}
                >
                  Đang hoạt động
                </span>
                <p className={styles["admin-user-detail-page__summary-meta"]}>
                  Mã khách hàng: {data.user.id}
                </p>
              </div>
            </div>
            <div className={styles["admin-user-detail-page__summary-stats"]}>
              <div className={styles["admin-user-detail-page__summary-stat"]}>
                <MdCalendarMonth />
                <span>Tham gia từ {joinDate}</span>
              </div>
              <div className={styles["admin-user-detail-page__summary-stat"]}>
                <MdShoppingBag />
                <span>
                  {data.stats.completedOrders} đơn hàng hoàn tất
                  {data.stats.totalOrders > data.stats.completedOrders
                    ? ` / ${data.stats.totalOrders} đơn`
                    : ""}
                </span>
              </div>
            </div>
          </div>
        </section>

        <nav className={styles["admin-user-detail-page__tabs"]}>
          <button
            type="button"
            className={`${styles["admin-user-detail-page__tab-button"]} ${
              activeTab === "info"
                ? styles["admin-user-detail-page__tab-button--active"]
                : ""
            }`}
            onClick={() => setActiveTab("info")}
          >
            <MdPerson className={styles["admin-user-detail-page__tab-button-icon"]} />
            Thông tin
          </button>
          <button
            type="button"
            className={`${styles["admin-user-detail-page__tab-button"]} ${
              activeTab === "cart"
                ? styles["admin-user-detail-page__tab-button--active"]
                : ""
            }`}
            onClick={() => setActiveTab("cart")}
          >
            <MdShoppingCart className={styles["admin-user-detail-page__tab-button-icon"]} />
            Giỏ hàng
          </button>
          <button
            type="button"
            className={`${styles["admin-user-detail-page__tab-button"]} ${
              activeTab === "orders"
                ? styles["admin-user-detail-page__tab-button--active"]
                : ""
            }`}
            onClick={() => setActiveTab("orders")}
          >
            <MdReceiptLong className={styles["admin-user-detail-page__tab-button-icon"]} />
            Đã mua
          </button>
          <button
            type="button"
            className={`${styles["admin-user-detail-page__tab-button"]} ${
              activeTab === "addresses"
                ? styles["admin-user-detail-page__tab-button--active"]
                : ""
            }`}
            onClick={() => setActiveTab("addresses")}
          >
            <MdLocationOn className={styles["admin-user-detail-page__tab-button-icon"]} />
            Địa chỉ
          </button>
        </nav>

        <section className={styles["admin-user-detail-page__section"]}>
          {activeTab === "info" && (
            <>
              <div className={styles["admin-user-detail-page__section-card"]}>
                <div
                  className={styles["admin-user-detail-page__section-header"]}
                >
                  <MdPerson />
                  <h3
                    className={styles["admin-user-detail-page__section-title"]}
                  >
                    Thông tin chung
                  </h3>
                </div>
                <div className={styles["admin-user-detail-page__field-grid"]}>
                  <div>
                    <div
                      className={styles["admin-user-detail-page__field-label"]}
                    >
                      Họ và tên
                    </div>
                    <input
                      className={styles["admin-user-detail-page__input"]}
                      type="text"
                      value={data.user.name ?? ""}
                      readOnly
                    />
                  </div>
                  <div>
                    <div
                      className={styles["admin-user-detail-page__field-label"]}
                    >
                      Địa chỉ email
                    </div>
                    <input
                      className={styles["admin-user-detail-page__input"]}
                      type="email"
                      value={data.user.email ?? ""}
                      readOnly
                    />
                  </div>
                  <div>
                    <div
                      className={styles["admin-user-detail-page__field-label"]}
                    >
                      Số điện thoại (từ địa chỉ mặc định)
                    </div>
                    <input
                      className={styles["admin-user-detail-page__input"]}
                      type="tel"
                      value={defaultAddress?.phone ?? ""}
                      readOnly
                    />
                  </div>
                  <div>
                    <div
                      className={styles["admin-user-detail-page__field-label"]}
                    >
                      Trạng thái email
                    </div>
                    <input
                      className={styles["admin-user-detail-page__input"]}
                      type="text"
                      value={
                        data.user.emailVerified
                          ? `Đã xác thực (${formatVietnameseDate(
                              data.user.emailVerified,
                            )})`
                          : "Chưa xác thực"
                      }
                      readOnly
                    />
                  </div>
                </div>
              </div>

              <div className={styles["admin-user-detail-page__section-card"]}>
                <div
                  className={styles["admin-user-detail-page__section-header"]}
                >
                  <MdSettings />
                  <h3
                    className={styles["admin-user-detail-page__section-title"]}
                  >
                    Cài đặt tài khoản
                  </h3>
                </div>
                <div className={styles["admin-user-detail-page__field-grid"]}>
                  <div>
                    <div
                      className={styles["admin-user-detail-page__field-label"]}
                    >
                      Vai trò người dùng
                    </div>
                    <select
                      className={styles["admin-user-detail-page__select"]}
                      value={data.user.role}
                      disabled
                    >
                      <option value="USER">Khách hàng</option>
                      <option value="ADMIN">Quản trị viên</option>
                    </select>
                    <p
                      className={
                        styles["admin-user-detail-page__field-description"]
                      }
                    >
                      Vai trò được cấu hình từ hệ thống quản trị. Đổi vai trò sẽ
                      được triển khai ở bước tiếp theo.
                    </p>
                  </div>
                  <div>
                    <div
                      className={styles["admin-user-detail-page__field-label"]}
                    >
                      Bảo mật
                    </div>
                    <p
                      className={
                        styles["admin-user-detail-page__field-description"]
                      }
                    >
                      Bạn có thể đặt lại mật khẩu cho người dùng hoặc bật xác
                      thực hai lớp trong tương lai.
                    </p>
                    <button
                      type="button"
                      className={styles["admin-user-detail-page__security-button"]}
                      onClick={handleNotImplemented}
                    >
                      <MdLockReset /> Đặt lại mật khẩu
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === "addresses" && (
            <div className={styles["admin-user-detail-page__section-card"]}>
              <div className={styles["admin-user-detail-page__section-header"]}>
                <MdPerson />
                <h3 className={styles["admin-user-detail-page__section-title"]}>
                  Địa chỉ giao hàng
                </h3>
              </div>
              {data.addresses.length === 0 ? (
                <p className={styles["admin-user-detail-page__empty-text"]}>
                  Người dùng chưa có địa chỉ nào được lưu.
                </p>
              ) : (
                <div className={styles["admin-user-detail-page__addresses"]}>
                  {data.addresses.map((address) => (
                    <div
                      key={address.id}
                      className={
                        styles["admin-user-detail-page__address-card"]
                      }
                    >
                      <div
                        className={
                          styles["admin-user-detail-page__address-header"]
                        }
                      >
                        <div>
                          <p
                            className={
                              styles["admin-user-detail-page__address-name"]
                            }
                          >
                            {address.fullName}
                          </p>
                          <p
                            className={
                              styles["admin-user-detail-page__address-meta"]
                            }
                          >
                            {address.phone}
                          </p>
                        </div>
                        {address.isDefault && (
                          <span
                            className={
                              styles["admin-user-detail-page__address-pill"]
                            }
                          >
                            Mặc định
                          </span>
                        )}
                      </div>
                      <p
                        className={
                          styles["admin-user-detail-page__address-meta"]
                        }
                      >
                        {[
                          address.line1,
                          address.line2,
                          address.ward,
                          address.district,
                          address.province,
                          address.country,
                          address.postalCode,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "cart" && (
            <div className={styles["admin-user-detail-page__cart-layout"]}>
              <div className={styles["admin-user-detail-page__section-card"]}>
                <div
                  className={styles["admin-user-detail-page__section-header"]}
                >
                  <MdShoppingCart />
                  <h3
                    className={styles["admin-user-detail-page__section-title"]}
                  >
                    Giỏ hàng ({cartTotals.itemCount})
                  </h3>
                  <button
                    type="button"
                    className={
                      styles["admin-user-detail-page__cart-clear-button"]
                    }
                    onClick={handleNotImplemented}
                  >
                    Xóa giỏ hàng
                  </button>
                </div>
                {(!data.cart || data.cart.items.length === 0) && (
                  <p className={styles["admin-user-detail-page__empty-text"]}>
                    Giỏ hàng hiện tại đang trống.
                  </p>
                )}
                {data.cart && data.cart.items.length > 0 && (
                  <div className={styles["admin-user-detail-page__cart-table-wrapper"]}>
                    <table
                      className={styles["admin-user-detail-page__cart-table"]}
                    >
                      <thead>
                        <tr>
                          <th
                            className={
                              styles[
                                "admin-user-detail-page__cart-table-head-cell"
                              ]
                            }
                          >
                            Sản phẩm
                          </th>
                          <th
                            className={
                              styles[
                                "admin-user-detail-page__cart-table-head-cell"
                              ]
                            }
                          >
                            Đơn giá
                          </th>
                          <th
                            className={
                              styles[
                                "admin-user-detail-page__cart-table-head-cell"
                              ]
                            }
                          >
                            Số lượng
                          </th>
                          <th
                            className={`${styles["admin-user-detail-page__cart-table-head-cell"]} ${styles["admin-user-detail-page__cart-table-head-cell--right"]}`}
                          >
                            Thành tiền
                          </th>
                          <th
                            className={
                              styles[
                                "admin-user-detail-page__cart-table-head-cell"
                              ]
                            }
                          />
                        </tr>
                      </thead>
                      <tbody>
                        {data.cart.items.map((item) => {
                          const unit = Number.parseFloat(
                            item.unitPrice ?? "0",
                          );
                          const lineTotal =
                            Number.isFinite(unit) && item.quantity > 0
                              ? unit * item.quantity
                              : 0;

                          return (
                            <tr
                              key={item.id}
                              className={
                                styles["admin-user-detail-page__cart-table-row"]
                              }
                            >
                              <td
                                className={
                                  styles[
                                    "admin-user-detail-page__cart-table-cell"
                                  ]
                                }
                              >
                                <div
                                  className={
                                    styles[
                                      "admin-user-detail-page__cart-product"
                                    ]
                                  }
                                >
                                  <div
                                    className={
                                      styles[
                                        "admin-user-detail-page__cart-product-thumb"
                                      ]
                                    }
                                  >
                                    {item.product.name
                                      .split(" ")
                                      .slice(0, 2)
                                      .map((part) => part[0])
                                      .join("")
                                      .toUpperCase()}
                                  </div>
                                  <div
                                    className={
                                      styles[
                                        "admin-user-detail-page__cart-product-texts"
                                      ]
                                    }
                                  >
                                    <p
                                      className={
                                        styles[
                                          "admin-user-detail-page__cart-product-name"
                                        ]
                                      }
                                    >
                                      {item.product.name}
                                    </p>
                                    <p
                                      className={
                                        styles[
                                          "admin-user-detail-page__cart-product-sub"
                                        ]
                                      }
                                    >
                                      Mã SP: {item.product.id}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td
                                className={
                                  styles[
                                    "admin-user-detail-page__cart-table-cell"
                                  ]
                                }
                              >
                                <span
                                  className={
                                    styles[
                                      "admin-user-detail-page__cart-price-text"
                                    ]
                                  }
                                >
                                  {formatCurrencyVnd(unit)}
                                </span>
                              </td>
                              <td
                                className={
                                  styles[
                                    "admin-user-detail-page__cart-table-cell"
                                  ]
                                }
                              >
                                <span
                                  className={
                                    styles[
                                      "admin-user-detail-page__cart-quantity-pill"
                                    ]
                                  }
                                >
                                  {item.quantity}
                                </span>
                              </td>
                              <td
                                className={`${styles["admin-user-detail-page__cart-table-cell"]} ${styles["admin-user-detail-page__cart-table-cell--right"]}`}
                              >
                                <span
                                  className={
                                    styles[
                                      "admin-user-detail-page__cart-total-text"
                                    ]
                                  }
                                >
                                  {formatCurrencyVnd(lineTotal)}
                                </span>
                              </td>
                              <td
                                className={
                                  styles[
                                    "admin-user-detail-page__cart-table-cell"
                                  ]
                                }
                              >
                                <button
                                  type="button"
                                  className={
                                    styles[
                                      "admin-user-detail-page__cart-remove-button"
                                    ]
                                  }
                                  onClick={handleNotImplemented}
                                >
                                  ×
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className={styles["admin-user-detail-page__section-card"]}>
                <div
                  className={styles["admin-user-detail-page__section-header"]}
                >
                  <MdShoppingBag />
                  <h3
                    className={styles["admin-user-detail-page__section-title"]}
                  >
                    Tổng quan giỏ hàng
                  </h3>
                </div>
                <div className={styles["admin-user-detail-page__cart-summary"]}>
                  <div
                    className={
                      styles["admin-user-detail-page__cart-summary-row"]
                    }
                  >
                    <span>Giá trị tạm tính</span>
                    <span>{formatCurrencyVnd(cartTotals.subtotal)}</span>
                  </div>
                  <div
                    className={
                      styles["admin-user-detail-page__cart-summary-row"]
                    }
                  >
                    <span>Số lượng sản phẩm</span>
                    <span>{cartTotals.itemCount}</span>
                  </div>
                  <div
                    className={
                      styles["admin-user-detail-page__cart-summary-row"]
                    }
                  >
                    <span>Thuế tạm tính (10%)</span>
                    <span>{formatCurrencyVnd(cartTotals.vat)}</span>
                  </div>
                  <div
                    className={
                      styles["admin-user-detail-page__cart-summary-divider"]
                    }
                  />
                  <div
                    className={
                      styles["admin-user-detail-page__cart-summary-total"]
                    }
                  >
                    <div>
                      <p>Tổng giá trị giỏ hàng</p>
                      <p>
                        {formatCurrencyVnd(cartTotals.total)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={
                      styles["admin-user-detail-page__cart-summary-primary"]
                    }
                    onClick={handleNotImplemented}
                  >
                    Tạo báo giá từ giỏ hàng
                  </button>
                  <button
                    type="button"
                    className={
                      styles["admin-user-detail-page__cart-summary-secondary"]
                    }
                    onClick={handleNotImplemented}
                  >
                    Gửi nhắc nhở giỏ hàng
                  </button>
                  <p
                    className={
                      styles["admin-user-detail-page__cart-summary-footnote"]
                    }
                  >
                    Thời gian cập nhật giỏ hàng sẽ được bổ sung khi kết nối
                    dữ liệu đơn hàng thực tế.
                  </p>
                </div>
              </div>

              <div
                className={
                  styles["admin-user-detail-page__cart-info-banner"]
                }
              >
                <div
                  className={
                    styles["admin-user-detail-page__cart-info-banner-icon"]
                  }
                >
                  <MdLocalShipping />
                </div>
                <div>
                  <h4
                    className={
                      styles["admin-user-detail-page__cart-info-banner-title"]
                    }
                  >
                    Tình trạng tồn kho
                  </h4>
                  <p
                    className={
                      styles["admin-user-detail-page__cart-info-banner-text"]
                    }
                  >
                    Tất cả sản phẩm trong giỏ sẽ được kiểm tra tồn kho thật khi
                    tạo đơn hàng. Thông báo chi tiết sẽ hiển thị ở bước đặt
                    hàng.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "orders" && (
            <div className={styles["admin-user-detail-page__section-card"]}>
              <div className={styles["admin-user-detail-page__section-header"]}>
                <MdReceiptLong />
                <h3 className={styles["admin-user-detail-page__section-title"]}>
                  Đơn hàng gần đây
                </h3>
              </div>
              {data.orders.length === 0 ? (
                <p className={styles["admin-user-detail-page__empty-text"]}>
                  Người dùng chưa có đơn hàng nào.
                </p>
              ) : (
                <div className={styles["admin-user-detail-page__orders-table-wrapper"]}>
                  <table
                    className={styles["admin-user-detail-page__orders-table"]}
                  >
                    <thead>
                      <tr>
                        <th
                          className={
                            styles[
                              "admin-user-detail-page__orders-table-head-cell"
                            ]
                          }
                        >
                          Mã đơn
                        </th>
                        <th
                          className={
                            styles[
                              "admin-user-detail-page__orders-table-head-cell"
                            ]
                          }
                        >
                          Ngày tạo
                        </th>
                        <th
                          className={
                            styles[
                              "admin-user-detail-page__orders-table-head-cell"
                            ]
                          }
                        >
                          Trạng thái
                        </th>
                        <th
                          className={`${styles["admin-user-detail-page__orders-table-head-cell"]} ${styles["admin-user-detail-page__orders-table-head-cell--right"]}`}
                        >
                          Giá trị
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.orders.map((order) => (
                        <tr
                          key={order.id}
                          className={
                            styles["admin-user-detail-page__orders-table-row"]
                          }
                        >
                          <td
                            className={
                              styles[
                                "admin-user-detail-page__orders-table-cell"
                              ]
                            }
                          >
                            {order.id}
                          </td>
                          <td
                            className={
                              styles[
                                "admin-user-detail-page__orders-table-cell"
                              ]
                            }
                          >
                            {formatVietnameseDate(order.createdAt)}
                          </td>
                          <td
                            className={
                              styles[
                                "admin-user-detail-page__orders-table-cell"
                              ]
                            }
                          >
                            <span
                              className={
                                styles[
                                  "admin-user-detail-page__orders-status-pill"
                                ]
                              }
                            >
                              {order.status}
                            </span>
                          </td>
                          <td
                            className={`${styles["admin-user-detail-page__orders-table-cell"]} ${styles["admin-user-detail-page__orders-table-cell--right"]}`}
                          >
                            {formatCurrencyVnd(
                              Number.parseFloat(order.totalAmount ?? "0"),
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className={styles["admin-user-detail-page__footer-actions"]}>
            <button
              type="button"
              className={
                styles["admin-user-detail-page__footer-update-button"]
              }
              onClick={() => router.push(`/admin/users/${userId}/edit`)}
            >
              <MdEdit />
              <span>Cập nhật thông tin</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default AdminUserDetailPage;

