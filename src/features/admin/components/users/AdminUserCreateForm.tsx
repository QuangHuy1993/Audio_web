import React from "react";
import { MdClose, MdPersonAddAlt } from "react-icons/md";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import styles from "./AdminUserCreateForm.module.css";

const createUserSchema = z.object({
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
  password: z
    .string()
    .min(6, "Mật khẩu phải có ít nhất 6 ký tự.")
    .max(128, "Mật khẩu quá dài."),
  role: z.enum(["USER", "ADMIN"]),
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;

type AdminUserCreateFormProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
};

const AdminUserCreateForm: React.FC<AdminUserCreateFormProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "USER",
    },
  });

  if (!isOpen) {
    return null;
  }

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const onSubmit = async (values: CreateUserFormValues) => {
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: values.name?.trim() || undefined,
          email: values.email.trim(),
          password: values.password,
          role: values.role,
        }),
      });

      const json = (await response.json()) as { error?: string };

      if (!response.ok) {
        toast.error(json.error ?? "Không thể tạo người dùng mới.");
        return;
      }

      toast.success("Tạo người dùng mới thành công.");
      reset();
      onCreated();
      onClose();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to create admin user", error);
      toast.error("Có lỗi xảy ra khi tạo người dùng. Vui lòng thử lại.");
    }
  };

  return (
    <div className={styles["admin-user-create-form-modal"]} role="dialog" aria-modal="true">
      <div className={styles["admin-user-create-form-modal__panel"]}>
        <header className={styles["admin-user-create-form-modal__header"]}>
          <div className={styles["admin-user-create-form-modal__title-group"]}>
            <h2 className={styles["admin-user-create-form-modal__title"]}>
              Thêm người dùng mới
            </h2>
            <p className={styles["admin-user-create-form-modal__subtitle"]}>
              Tạo tài khoản quản lý khách hàng cho hệ thống Đức Uy Audio.
            </p>
          </div>
          <button
            type="button"
            className={styles["admin-user-create-form-modal__close-button"]}
            onClick={handleClose}
            aria-label="Đóng"
          >
            <MdClose />
          </button>
        </header>

        <form
          className={styles["admin-user-create-form-modal__body"]}
          onSubmit={handleSubmit(onSubmit)}
        >
          <div className={styles["admin-user-create-form-modal__field-row"]}>
            <div>
              <div className={styles["admin-user-create-form-modal__field-label"]}>
                Họ và tên
              </div>
              <p className={styles["admin-user-create-form-modal__field-description"]}>
                Tên hiển thị trong hệ thống và email.
              </p>
            </div>
            <input
              type="text"
              className={styles["admin-user-create-form-modal__input"]}
              placeholder="Ví dụ: Nguyễn Văn A"
              {...register("name")}
            />
            {errors.name?.message && (
              <p className={styles["admin-user-create-form-modal__error-text"]}>
                {errors.name.message}
              </p>
            )}
          </div>

          <div className={styles["admin-user-create-form-modal__field-row"]}>
            <div>
              <div className={styles["admin-user-create-form-modal__field-label"]}>
                Email đăng nhập
              </div>
              <p className={styles["admin-user-create-form-modal__field-description"]}>
                Sử dụng email thật để khách có thể nhận thông báo và đặt hàng.
              </p>
            </div>
            <input
              type="email"
              autoComplete="email"
              className={styles["admin-user-create-form-modal__input"]}
              placeholder="name@example.com"
              {...register("email")}
            />
            {errors.email?.message && (
              <p className={styles["admin-user-create-form-modal__error-text"]}>
                {errors.email.message}
              </p>
            )}
          </div>

          <div className={styles["admin-user-create-form-modal__field-row"]}>
            <div>
              <div className={styles["admin-user-create-form-modal__field-label"]}>
                Mật khẩu tạm thời
              </div>
              <p className={styles["admin-user-create-form-modal__field-description"]}>
                Người dùng có thể đổi lại mật khẩu sau khi đăng nhập lần đầu.
              </p>
            </div>
            <input
              type="password"
              autoComplete="new-password"
              className={styles["admin-user-create-form-modal__input"]}
              placeholder="Tối thiểu 6 ký tự"
              {...register("password")}
            />
            {errors.password?.message && (
              <p className={styles["admin-user-create-form-modal__error-text"]}>
                {errors.password.message}
              </p>
            )}
          </div>

          <div className={styles["admin-user-create-form-modal__field-row"]}>
            <div>
              <div className={styles["admin-user-create-form-modal__field-label"]}>
                Vai trò trong hệ thống
              </div>
              <p className={styles["admin-user-create-form-modal__field-description"]}>
                Chỉ chọn Admin cho tài khoản nội bộ cần toàn quyền quản trị.
              </p>
            </div>
            <select
              className={styles["admin-user-create-form-modal__select"]}
              {...register("role")}
            >
              <option value="USER">Khách hàng</option>
              <option value="ADMIN">Quản trị viên</option>
            </select>
            {errors.role?.message && (
              <p className={styles["admin-user-create-form-modal__error-text"]}>
                {errors.role.message}
              </p>
            )}
          </div>

          <footer className={styles["admin-user-create-form-modal__footer"]}>
            <button
              type="button"
              className={styles["admin-user-create-form-modal__secondary-button"]}
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Hủy
            </button>
            <button
              type="submit"
              className={styles["admin-user-create-form-modal__primary-button"]}
              disabled={isSubmitting}
            >
              {isSubmitting && (
                <span
                  className={
                    styles["admin-user-create-form-modal__primary-button-spinner"]
                  }
                />
              )}
              <MdPersonAddAlt />
              <span>Tạo người dùng</span>
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default AdminUserCreateForm;

