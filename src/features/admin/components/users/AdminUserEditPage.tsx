"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { MdArrowBack } from "react-icons/md";
import { toast } from "sonner";
import styles from "./AdminUserEditPage.module.css";

type AdminUserEditPageProps = {
  userId: string;
};

type AdminUserDetailResponse = {
  data: {
    user: {
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
      createdAt: string;
    };
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

const editUserSchema = z
  .object({
    name: z
      .string()
      .trim()
      .max(120, "Tên quá dài.")
      .optional()
      .or(z.literal("")),
    email: z
      .string()
      .trim()
      .min(1, "Email là bắt buộc.")
      .email("Email không hợp lệ."),
    addressFullName: z
      .string()
      .trim()
      .max(160, "Họ tên quá dài.")
      .optional()
      .or(z.literal("")),
    addressPhone: z
      .string()
      .trim()
      .max(32, "Số điện thoại quá dài.")
      .optional()
      .or(z.literal("")),
    addressLine1: z
      .string()
      .trim()
      .max(200, "Địa chỉ quá dài.")
      .optional()
      .or(z.literal("")),
    addressLine2: z
      .string()
      .trim()
      .max(200, "Địa chỉ quá dài.")
      .optional()
      .or(z.literal("")),
    ward: z.string().trim().max(120).optional().or(z.literal("")),
    district: z.string().trim().max(120).optional().or(z.literal("")),
    province: z.string().trim().max(120).optional().or(z.literal("")),
    postalCode: z.string().trim().max(32).optional().or(z.literal("")),
    newPassword: z
      .string()
      .min(0)
      .max(128, "Mật khẩu quá dài."),
    confirmPassword: z
      .string()
      .min(0)
      .max(128, "Mật khẩu quá dài."),
  })
  .refine(
    (values) => {
      if (!values.newPassword && !values.confirmPassword) {
        return true;
      }
      if (values.newPassword.length < 6) {
        return false;
      }
      return values.newPassword === values.confirmPassword;
    },
    {
      message:
        "Mật khẩu mới phải có ít nhất 6 ký tự và trùng khớp xác nhận.",
      path: ["confirmPassword"],
    },
  );

type EditUserFormValues = z.infer<typeof editUserSchema>;

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

const formatVietnameseDate = (isoString: string): string => {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const AdminUserEditPage: React.FC<AdminUserEditPageProps> = ({ userId }) => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] =
    useState<AdminUserDetailResponse["data"] | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      name: "",
      email: "",
      addressFullName: "",
      addressPhone: "",
      addressLine1: "",
      addressLine2: "",
      ward: "",
      district: "",
      province: "",
      postalCode: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

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
          throw new Error(
            "error" in json && json.error
              ? json.error
              : "Không thể tải thông tin người dùng.",
          );
        }

        if (!aborted && "data" in json) {
          setDetail(json.data);
          const defaultAddress =
            json.data.addresses.find((address) => address.isDefault) ??
            json.data.addresses[0] ??
            null;

          reset({
            name: json.data.user.name ?? "",
            email: json.data.user.email ?? "",
            addressFullName: defaultAddress?.fullName ?? "",
            addressPhone: defaultAddress?.phone ?? "",
            addressLine1: defaultAddress?.line1 ?? "",
            addressLine2: defaultAddress?.line2 ?? "",
            ward: defaultAddress?.ward ?? "",
            district: defaultAddress?.district ?? "",
            province: defaultAddress?.province ?? "",
            postalCode: defaultAddress?.postalCode ?? "",
            newPassword: "",
            confirmPassword: "",
          });
        }
      } catch (err) {
        if (!aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "Đã xảy ra lỗi khi tải thông tin người dùng.",
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
  }, [userId, reset]);

  const joinDate = useMemo(
    () => (detail ? formatVietnameseDate(detail.user.createdAt) : ""),
    [detail],
  );

  const onSubmit = async (values: EditUserFormValues) => {
    try {
      const payload: Record<string, unknown> = {
        name: values.name?.trim() || undefined,
        email: values.email.trim(),
      };

      if (
        values.addressFullName?.trim() ||
        values.addressPhone?.trim() ||
        values.addressLine1?.trim()
      ) {
        payload.defaultAddress = {
          fullName: values.addressFullName ?? "",
          phone: values.addressPhone ?? "",
          line1: values.addressLine1 ?? "",
          line2: values.addressLine2 ?? "",
          ward: values.ward ?? "",
          district: values.district ?? "",
          province: values.province ?? "",
          postalCode: values.postalCode ?? "",
        };
      }

      if (values.newPassword) {
        payload.changePassword = {
          newPassword: values.newPassword,
        };
      }

      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = (await response.json()) as { error?: string };

      if (!response.ok) {
        toast.error(json.error ?? "Không thể cập nhật thông tin người dùng.");
        return;
      }

      toast.success("Cập nhật thông tin người dùng thành công.");
      router.push(`/admin/users/${userId}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to update admin user", err);
      toast.error("Đã xảy ra lỗi khi cập nhật người dùng. Vui lòng thử lại.");
    }
  };

  const handleCancel = () => {
    router.push(`/admin/users/${userId}`);
  };

  if (isLoading || !detail) {
    return (
      <div className={styles["admin-user-edit-page"]}>
        <header className={styles["admin-user-edit-page__header"]}>
          <div className={styles["admin-user-edit-page__header-left"]}>
            <button
              type="button"
              className={styles["admin-user-edit-page__back-button"]}
              onClick={handleCancel}
            >
              <MdArrowBack />
              <span>Quay lại chi tiết</span>
            </button>
            <h1 className={styles["admin-user-edit-page__header-title"]}>
              Chỉnh sửa người dùng
            </h1>
          </div>
        </header>
        <main className={styles["admin-user-edit-page__content"]}>
          <p className={styles["admin-user-edit-page__global-error"]}>
            Đang tải dữ liệu người dùng...
          </p>
        </main>
      </div>
    );
  }

  const initials = getInitials(detail.user.name, detail.user.email);

  const newPassword = watch("newPassword");
  const confirmPassword = watch("confirmPassword");
  const isPasswordTouched = Boolean(newPassword || confirmPassword);

  return (
    <div className={styles["admin-user-edit-page"]}>
      <header className={styles["admin-user-edit-page__header"]}>
        <div className={styles["admin-user-edit-page__header-left"]}>
          <button
            type="button"
            className={styles["admin-user-edit-page__back-button"]}
            onClick={handleCancel}
          >
            <MdArrowBack />
            <span>Quay lại chi tiết</span>
          </button>
          <h1 className={styles["admin-user-edit-page__header-title"]}>
            Chỉnh sửa người dùng
          </h1>
        </div>
      </header>

      <main className={styles["admin-user-edit-page__content"]}>
        <section
          className={`${styles["admin-user-edit-page__card"]} ${styles["admin-user-edit-page__summary"]}`}
        >
          <div className={styles["admin-user-edit-page__summary-main"]}>
            <div className={styles["admin-user-edit-page__summary-header"]}>
              <div className={styles["admin-user-edit-page__avatar-shell"]}>
                {detail.user.image ? (
                  <img
                    src={detail.user.image}
                    alt={detail.user.name ?? detail.user.email ?? "Avatar"}
                    className={styles["admin-user-edit-page__avatar-image"]}
                  />
                ) : (
                  initials
                )}
              </div>
            </div>
            <div className={styles["admin-user-edit-page__summary-name-row"]}>
              <h2 className={styles["admin-user-edit-page__summary-name"]}>
                {detail.user.name ?? "Người dùng chưa có tên"}
              </h2>
              <span className={styles["admin-user-edit-page__status-pill"]}>
                Đang hoạt động
              </span>
              <p className={styles["admin-user-edit-page__summary-meta"]}>
                Mã khách hàng: {detail.user.id} • Tham gia từ {joinDate}
              </p>
            </div>
          </div>
        </section>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className={styles["admin-user-edit-page__section"]}
        >
          <section className={styles["admin-user-edit-page__card"]}>
            <div className={styles["admin-user-edit-page__section-header"]}>
              <h3 className={styles["admin-user-edit-page__section-title"]}>
                Thông tin cơ bản
              </h3>
            </div>
            <div className={styles["admin-user-edit-page__field-grid"]}>
              <div>
                <div
                  className={styles["admin-user-edit-page__field-label"]}
                >
                  Họ và tên
                </div>
                <input
                  type="text"
                  className={styles["admin-user-edit-page__input"]}
                  placeholder="Nhập họ và tên"
                  {...register("name")}
                />
                {errors.name?.message && (
                  <p className={styles["admin-user-edit-page__error-text"]}>
                    {errors.name.message}
                  </p>
                )}
              </div>
              <div>
                <div
                  className={styles["admin-user-edit-page__field-label"]}
                >
                  Địa chỉ email
                </div>
                <input
                  type="email"
                  className={styles["admin-user-edit-page__input"]}
                  placeholder="Nhập email"
                  {...register("email")}
                />
                {errors.email?.message && (
                  <p className={styles["admin-user-edit-page__error-text"]}>
                    {errors.email.message}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className={styles["admin-user-edit-page__card"]}>
            <div className={styles["admin-user-edit-page__section-header"]}>
              <h3 className={styles["admin-user-edit-page__section-title"]}>
                Địa chỉ mặc định
              </h3>
            </div>
            <div className={styles["admin-user-edit-page__field-grid"]}>
              <div>
                <div
                  className={styles["admin-user-edit-page__field-label"]}
                >
                  Họ và tên nhận hàng
                </div>
                <input
                  type="text"
                  className={styles["admin-user-edit-page__input"]}
                  placeholder="Nhập họ và tên"
                  {...register("addressFullName")}
                />
                {errors.addressFullName?.message && (
                  <p className={styles["admin-user-edit-page__error-text"]}>
                    {errors.addressFullName.message}
                  </p>
                )}
              </div>
              <div>
                <div
                  className={styles["admin-user-edit-page__field-label"]}
                >
                  Số điện thoại
                </div>
                <input
                  type="tel"
                  className={styles["admin-user-edit-page__input"]}
                  placeholder="Nhập số điện thoại"
                  {...register("addressPhone")}
                />
                {errors.addressPhone?.message && (
                  <p className={styles["admin-user-edit-page__error-text"]}>
                    {errors.addressPhone.message}
                  </p>
                )}
              </div>
              <div>
                <div
                  className={styles["admin-user-edit-page__field-label"]}
                >
                  Địa chỉ dòng 1
                </div>
                <input
                  type="text"
                  className={styles["admin-user-edit-page__input"]}
                  placeholder="Số nhà, tên đường..."
                  {...register("addressLine1")}
                />
                {errors.addressLine1?.message && (
                  <p className={styles["admin-user-edit-page__error-text"]}>
                    {errors.addressLine1.message}
                  </p>
                )}
              </div>
              <div>
                <div
                  className={styles["admin-user-edit-page__field-label"]}
                >
                  Địa chỉ dòng 2 (tuỳ chọn)
                </div>
                <input
                  type="text"
                  className={styles["admin-user-edit-page__input"]}
                  placeholder="Toà nhà, khu..."
                  {...register("addressLine2")}
                />
                {errors.addressLine2?.message && (
                  <p className={styles["admin-user-edit-page__error-text"]}>
                    {errors.addressLine2.message}
                  </p>
                )}
              </div>
              <div>
                <div
                  className={styles["admin-user-edit-page__field-label"]}
                >
                  Phường / Xã
                </div>
                <input
                  type="text"
                  className={styles["admin-user-edit-page__input"]}
                  {...register("ward")}
                />
              </div>
              <div>
                <div
                  className={styles["admin-user-edit-page__field-label"]}
                >
                  Quận / Huyện
                </div>
                <input
                  type="text"
                  className={styles["admin-user-edit-page__input"]}
                  {...register("district")}
                />
              </div>
              <div>
                <div
                  className={styles["admin-user-edit-page__field-label"]}
                >
                  Tỉnh / Thành phố
                </div>
                <input
                  type="text"
                  className={styles["admin-user-edit-page__input"]}
                  {...register("province")}
                />
              </div>
              <div>
                <div
                  className={styles["admin-user-edit-page__field-label"]}
                >
                  Mã bưu chính
                </div>
                <input
                  type="text"
                  className={styles["admin-user-edit-page__input"]}
                  {...register("postalCode")}
                />
              </div>
            </div>
          </section>

          <section className={styles["admin-user-edit-page__card"]}>
            <div className={styles["admin-user-edit-page__section-header"]}>
              <h3 className={styles["admin-user-edit-page__section-title"]}>
                Đổi mật khẩu
              </h3>
            </div>
            <div className={styles["admin-user-edit-page__field-grid"]}>
              <div>
                <div
                  className={styles["admin-user-edit-page__field-label"]}
                >
                  Mật khẩu mới
                </div>
                <input
                  type="password"
                  className={styles["admin-user-edit-page__input"]}
                  placeholder="Để trống nếu không đổi"
                  {...register("newPassword")}
                />
              </div>
              <div>
                <div
                  className={styles["admin-user-edit-page__field-label"]}
                >
                  Xác nhận mật khẩu mới
                </div>
                <input
                  type="password"
                  className={styles["admin-user-edit-page__input"]}
                  placeholder="Nhập lại mật khẩu mới"
                  {...register("confirmPassword")}
                />
                {errors.confirmPassword?.message && (
                  <p className={styles["admin-user-edit-page__error-text"]}>
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>
            </div>
            {isPasswordTouched && !errors.confirmPassword && (
              <p className={styles["admin-user-edit-page__field-description"]}>
                Mật khẩu mới sẽ áp dụng cho lần đăng nhập tiếp theo của người
                dùng.
              </p>
            )}
          </section>

          {error && (
            <p className={styles["admin-user-edit-page__global-error"]}>
              {error}
            </p>
          )}

          <div className={styles["admin-user-edit-page__footer"]}>
            <button
              type="button"
              className={
                styles["admin-user-edit-page__footer-button-cancel"]
              }
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Hủy thay đổi
            </button>
            <button
              type="submit"
              className={styles["admin-user-edit-page__footer-button-save"]}
              disabled={!isDirty || isSubmitting}
            >
              Lưu thay đổi
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default AdminUserEditPage;

