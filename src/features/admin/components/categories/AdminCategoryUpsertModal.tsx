"use client";

import React from "react";
import { MdClose, MdSave } from "react-icons/md";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import styles from "./AdminCategoryUpsertModal.module.css";

const upsertCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Tên danh mục là bắt buộc.")
    .max(160, "Tên danh mục quá dài."),
  slug: z
    .string()
    .trim()
    .min(1, "Slug là bắt buộc.")
    .max(160, "Slug quá dài.")
    .regex(/^[a-z0-9-]+$/, "Slug chỉ bao gồm chữ thường, số và dấu gạch ngang."),
  description: z
    .string()
    .trim()
    .max(400, "Mô tả quá dài.")
    .optional()
    .or(z.literal("")),
  parentId: z.string().optional().or(z.literal("")),
  seoTitle: z
    .string()
    .trim()
    .max(160, "Tiêu đề SEO quá dài.")
    .optional()
    .or(z.literal("")),
  seoDescription: z
    .string()
    .trim()
    .max(320, "Mô tả SEO quá dài.")
    .optional()
    .or(z.literal("")),
  aiDescription: z
    .string()
    .trim()
    .max(600, "Mô tả AI quá dài.")
    .optional()
    .or(z.literal("")),
  aiTagsInput: z
    .string()
    .trim()
    .max(260, "Danh sách thẻ AI quá dài.")
    .optional()
    .or(z.literal("")),
});

type UpsertCategoryFormValues = z.infer<typeof upsertCategorySchema>;

export type AdminCategoryUpsertModalMode = "create" | "edit";

export type AdminCategoryUpsertModalCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  parentId?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  aiDescription?: string | null;
  aiTags?: string[] | null;
};

export type AdminCategoryUpsertModalParentOption = {
  id: string;
  name: string;
};

type AdminCategoryUpsertModalProps = {
  mode: AdminCategoryUpsertModalMode;
  isOpen: boolean;
  category?: AdminCategoryUpsertModalCategory | null;
  parentOptions: AdminCategoryUpsertModalParentOption[];
  onClose: () => void;
  onCompleted: () => void;
};

const AdminCategoryUpsertModal: React.FC<AdminCategoryUpsertModalProps> = ({
  mode,
  isOpen,
  category,
  parentOptions,
  onClose,
  onCompleted,
}) => {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<UpsertCategoryFormValues>({
    resolver: zodResolver(upsertCategorySchema),
    defaultValues: {
      name: category?.name ?? "",
      slug: category?.slug ?? "",
      description: category?.description ?? "",
      parentId: category?.parentId ?? "",
      seoTitle: category?.seoTitle ?? "",
      seoDescription: category?.seoDescription ?? "",
      aiDescription: category?.aiDescription ?? "",
      aiTagsInput: category?.aiTags?.join(", ") ?? "",
    },
    values: {
      name: category?.name ?? "",
      slug: category?.slug ?? "",
      description: category?.description ?? "",
      parentId: category?.parentId ?? "",
      seoTitle: category?.seoTitle ?? "",
      seoDescription: category?.seoDescription ?? "",
      aiDescription: category?.aiDescription ?? "",
      aiTagsInput: category?.aiTags?.join(", ") ?? "",
    },
  });

  const isEdit = mode === "edit";

  const [kind, setKind] = React.useState<"parent" | "child">(
    category?.parentId ? "child" : "parent",
  );
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = React.useState(false);

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const onSubmit = async (values: UpsertCategoryFormValues) => {
    const aiTags =
      values.aiTagsInput
        ?.split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0) ?? [];

    const payload = {
      name: values.name.trim(),
      slug: values.slug.trim(),
      description: values.description?.trim() || undefined,
      parentId: values.parentId ? values.parentId : undefined,
      seoTitle: values.seoTitle?.trim() || undefined,
      seoDescription: values.seoDescription?.trim() || undefined,
      aiDescription: values.aiDescription?.trim() || undefined,
      aiTags: aiTags.length > 0 ? aiTags : undefined,
    };

    try {
      const response = await fetch(
        isEdit && category
          ? `/api/admin/categories/${encodeURIComponent(category.id)}`
          : "/api/admin/categories",
        {
          method: isEdit ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const json = (await response.json()) as { error?: string };

      if (!response.ok) {
        toast.error(
          json.error ??
            (isEdit
              ? "Không thể cập nhật danh mục."
              : "Không thể tạo danh mục mới."),
        );
        return;
      }

      toast.success(
        isEdit ? "Cập nhật danh mục thành công." : "Tạo danh mục mới thành công.",
      );
      reset();
      onCompleted();
      onClose();
    } catch (error) {
      console.error("Failed to upsert category", error);
      toast.error(
        isEdit
          ? "Có lỗi xảy ra khi cập nhật danh mục. Vui lòng thử lại."
          : "Có lỗi xảy ra khi tạo danh mục. Vui lòng thử lại.",
      );
    }
  };

  const handleGenerateAi = async () => {
    if (isGeneratingAi || isSubmitting) return;

    const currentName = getValues("name")?.trim() ?? "";
    const currentDescription = getValues("description")?.trim() ?? "";
    const currentParentId = getValues("parentId")?.trim() || "";

    if (!currentName) {
      toast.error("Vui lòng nhập tên danh mục trước khi sinh nội dung AI.");
      return;
    }

    setIsGeneratingAi(true);

    try {
      const response = await fetch("/api/admin/categories/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: currentName,
          description: currentDescription || undefined,
          parentId: currentParentId || undefined,
        }),
      });

      const json = (await response.json()) as {
        error?: string;
        data?: {
          seoTitle?: string;
          seoDescription?: string;
          aiDescription?: string;
          aiTags?: string[];
        };
      };

      if (!response.ok || !json.data) {
        toast.error(
          json.error ??
            "Không thể sinh nội dung AI cho danh mục. Vui lòng thử lại sau.",
        );
        return;
      }

      const { seoTitle, seoDescription, aiDescription, aiTags } = json.data;

      if (seoTitle) {
        setValue("seoTitle", seoTitle, { shouldDirty: true });
      }
      if (seoDescription) {
        setValue("seoDescription", seoDescription, { shouldDirty: true });
      }
      if (aiDescription) {
        setValue("aiDescription", aiDescription, { shouldDirty: true });
      }
      if (aiTags && aiTags.length > 0) {
        setValue("aiTagsInput", aiTags.join(", "), { shouldDirty: true });
      }

      toast.success(
        "Đã sinh nội dung SEO và mô tả AI cho danh mục. Bạn có thể chỉnh sửa lại trước khi lưu.",
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to generate AI content for category", error);
      toast.error(
        "Có lỗi xảy ra khi gọi AI. Vui lòng kiểm tra cấu hình key Gemini và thử lại.",
      );
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const title = isEdit ? "Cập nhật danh mục" : "Thêm danh mục mới";
  const subtitle = isEdit
    ? "Chỉnh sửa thông tin danh mục sản phẩm trong hệ thống Đức Uy Audio."
    : "Tạo nhóm danh mục mới cho hệ thống hi-fi và phụ kiện âm thanh.";

  const primaryLabel = isEdit ? "Lưu thay đổi" : "Tạo danh mục";

  const nameField = register("name");
  const slugField = register("slug");

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={styles["admin-category-upsert-modal"]}
      role="dialog"
      aria-modal="true"
    >
      <div className={styles["admin-category-upsert-modal__panel"]}>
        <header className={styles["admin-category-upsert-modal__header"]}>
          <div className={styles["admin-category-upsert-modal__title-group"]}>
            <h2 className={styles["admin-category-upsert-modal__title"]}>
              {title}
            </h2>
            <p className={styles["admin-category-upsert-modal__subtitle"]}>
              {subtitle}
            </p>
          </div>
          <button
            type="button"
            className={styles["admin-category-upsert-modal__close-button"]}
            onClick={handleClose}
            aria-label="Đóng"
          >
            <MdClose />
          </button>
        </header>

        <div className={styles["admin-category-upsert-modal__type-tabs"]}>
          <button
            type="button"
            className={`${styles["admin-category-upsert-modal__type-tab"]} ${
              kind === "parent"
                ? styles["admin-category-upsert-modal__type-tab--active"]
                : ""
            }`}
            onClick={() => {
              if (isEdit) return;
              setKind("parent");
              setValue("parentId", "");
            }}
            disabled={isEdit}
          >
            Danh mục cha
          </button>
          <button
            type="button"
            className={`${styles["admin-category-upsert-modal__type-tab"]} ${
              kind === "child"
                ? styles["admin-category-upsert-modal__type-tab--active"]
                : ""
            }`}
            onClick={() => {
              if (isEdit) return;
              setKind("child");
            }}
            disabled={isEdit}
          >
            Danh mục con
          </button>
        </div>

        <form
          className={styles["admin-category-upsert-modal__body"]}
          onSubmit={handleSubmit(onSubmit)}
        >
          <div className={styles["admin-category-upsert-modal__field-row"]}>
            <div>
              <div className={styles["admin-category-upsert-modal__field-label"]}>
                Tên danh mục
              </div>
              <p
                className={
                  styles["admin-category-upsert-modal__field-description"]
                }
              >
                Ví dụ: Loa Hi-end, Ampli Nghe Nhạc, Phụ Kiện Audio.
              </p>
            </div>
            <input
              type="text"
              className={styles["admin-category-upsert-modal__input"]}
              placeholder="Nhập tên danh mục"
              {...nameField}
              onChange={(event) => {
                nameField.onChange(event);
                if (!isEdit && !slugTouched) {
                  const base = event.target.value.trim();
                  if (!base) {
                    setValue("slug", "");
                    return;
                  }
                  const slug = base
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-+|-+$/g, "")
                    .replace(/-{2,}/g, "-");
                  setValue("slug", slug);
                }
              }}
            />
            {errors.name?.message && (
              <p className={styles["admin-category-upsert-modal__error-text"]}>
                {errors.name.message}
              </p>
            )}
          </div>

          <div className={styles["admin-category-upsert-modal__field-row"]}>
            <div className={styles["admin-category-upsert-modal__ai-header"]}>
              <div>
                <div className={styles["admin-category-upsert-modal__field-label"]}>
                  Tối ưu SEO & AI (tuỳ chọn)
                </div>
                <p
                  className={
                    styles["admin-category-upsert-modal__field-description"]
                  }
                >
                  Nếu để trống, hệ thống sẽ cố gắng tự sinh nội dung cho SEO và AI tư vấn
                  dựa trên tên và mô tả danh mục.
                </p>
              </div>
              <button
                type="button"
                className={
                  styles["admin-category-upsert-modal__ai-generate-button"]
                }
                onClick={handleGenerateAi}
                disabled={isSubmitting || isGeneratingAi}
              >
                {isGeneratingAi ? "Đang sinh nội dung..." : "Sinh nội dung bằng AI"}
              </button>
            </div>
            <div className={styles["admin-category-upsert-modal__ai-grid"]}>
              <div>
                <div
                  className={
                    styles["admin-category-upsert-modal__field-label-inline"]
                  }
                >
                  Tiêu đề SEO
                </div>
                <input
                  type="text"
                  className={styles["admin-category-upsert-modal__input"]}
                  placeholder="Ví dụ: Loa hi-end phòng khách cao cấp"
                  {...register("seoTitle")}
                />
                {errors.seoTitle?.message && (
                  <p className={styles["admin-category-upsert-modal__error-text"]}>
                    {errors.seoTitle.message}
                  </p>
                )}
              </div>
              <div>
                <div
                  className={
                    styles["admin-category-upsert-modal__field-label-inline"]
                  }
                >
                  Mô tả SEO
                </div>
                <textarea
                  className={styles["admin-category-upsert-modal__textarea"]}
                  placeholder="Mô tả ngắn cho SEO, tối đa khoảng 1–2 câu."
                  {...register("seoDescription")}
                />
                {errors.seoDescription?.message && (
                  <p className={styles["admin-category-upsert-modal__error-text"]}>
                    {errors.seoDescription.message}
                  </p>
                )}
              </div>
            </div>
            <div className={styles["admin-category-upsert-modal__ai-grid"]}>
              <div>
                <div
                  className={
                    styles["admin-category-upsert-modal__field-label-inline"]
                  }
                >
                  Mô tả cho AI
                </div>
                <textarea
                  className={styles["admin-category-upsert-modal__textarea"]}
                  placeholder="Giải thích cho AI: danh mục này phù hợp không gian, phong cách nghe nào, ưu tiên trải nghiệm gì..."
                  {...register("aiDescription")}
                />
                {errors.aiDescription?.message && (
                  <p className={styles["admin-category-upsert-modal__error-text"]}>
                    {errors.aiDescription.message}
                  </p>
                )}
              </div>
              <div>
                <div
                  className={
                    styles["admin-category-upsert-modal__field-label-inline"]
                  }
                >
                  Thẻ AI (slug, cách nhau bởi dấu phẩy)
                </div>
                <input
                  type="text"
                  className={styles["admin-category-upsert-modal__input"]}
                  placeholder="Ví dụ: loa-hi-end, phong-khach, xem-phim, nghe-nhac"
                  {...register("aiTagsInput")}
                />
                {errors.aiTagsInput?.message && (
                  <p className={styles["admin-category-upsert-modal__error-text"]}>
                    {errors.aiTagsInput.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className={styles["admin-category-upsert-modal__field-row"]}>
            <div>
              <div className={styles["admin-category-upsert-modal__field-label"]}>
                Slug danh mục
              </div>
              <p
                className={
                  styles["admin-category-upsert-modal__field-description"]
                }
              >
                Dùng trong đường dẫn URL, chỉ gồm chữ thường, số và dấu gạch ngang.
              </p>
            </div>
            <input
              type="text"
              className={styles["admin-category-upsert-modal__input"]}
              placeholder="Ví dụ: loa-hi-end, ampli-nghe-nhac"
              {...slugField}
              onChange={(event) => {
                slugField.onChange(event);
                if (!slugTouched) {
                  setSlugTouched(true);
                }
              }}
              disabled={isEdit}
            />
            {errors.slug?.message && (
              <p className={styles["admin-category-upsert-modal__error-text"]}>
                {errors.slug.message}
              </p>
            )}
          </div>

          <div className={styles["admin-category-upsert-modal__field-row"]}>
            <div>
              <div className={styles["admin-category-upsert-modal__field-label"]}>
                Mô tả danh mục
              </div>
              <p
                className={
                  styles["admin-category-upsert-modal__field-description"]
                }
              >
                Giới thiệu ngắn gọn về nhóm sản phẩm, giúp AI và khách hàng hiểu
                rõ hơn về vai trò của danh mục này.
              </p>
            </div>
            <textarea
              className={styles["admin-category-upsert-modal__textarea"]}
              placeholder="Ví dụ: Dòng loa hi-end với khả năng tái tạo sân khấu rộng, độ động cao và độ chi tiết ấn tượng..."
              {...register("description")}
            />
            {errors.description?.message && (
              <p className={styles["admin-category-upsert-modal__error-text"]}>
                {errors.description.message}
              </p>
            )}
          </div>

          <div className={styles["admin-category-upsert-modal__field-row"]}>
            <div>
              <div className={styles["admin-category-upsert-modal__field-label"]}>
                Danh mục cha
              </div>
              <p
                className={
                  styles["admin-category-upsert-modal__field-description"]
                }
              >
                {kind === "parent"
                  ? "Đây là danh mục cấp cao nhất, không thuộc danh mục khác."
                  : "Chọn danh mục gốc nếu đây là danh mục con."}
              </p>
            </div>
            <select
              className={styles["admin-category-upsert-modal__select"]}
              {...register("parentId")}
              disabled={kind === "parent"}
            >
              <option value="">Không có danh mục cha</option>
              {parentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
            {errors.parentId?.message && (
              <p className={styles["admin-category-upsert-modal__error-text"]}>
                {errors.parentId.message}
              </p>
            )}
          </div>

          <footer className={styles["admin-category-upsert-modal__footer"]}>
            <button
              type="button"
              className={styles["admin-category-upsert-modal__secondary-button"]}
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Hủy
            </button>
            <button
              type="submit"
              className={styles["admin-category-upsert-modal__primary-button"]}
              disabled={isSubmitting}
            >
              {isSubmitting && (
                <span
                  className={
                    styles["admin-category-upsert-modal__primary-button-spinner"]
                  }
                />
              )}
              <MdSave />
              <span>{primaryLabel}</span>
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default AdminCategoryUpsertModal;

