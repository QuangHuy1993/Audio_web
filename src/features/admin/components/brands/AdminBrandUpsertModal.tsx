"use client";

import React, { useState } from "react";
import { MdClose, MdSave } from "react-icons/md";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import styles from "./AdminBrandUpsertModal.module.css";

const upsertBrandSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Tên thương hiệu là bắt buộc.")
    .max(160, "Tên thương hiệu quá dài."),
  slug: z
    .string()
    .trim()
    .min(1, "Slug là bắt buộc.")
    .max(160, "Slug quá dài.")
    .regex(
      /^[a-z0-9-]+$/,
      "Slug chỉ bao gồm chữ thường, số và dấu gạch ngang."
    ),
  description: z
    .string()
    .trim()
    .max(800, "Mô tả quá dài.")
    .optional()
    .or(z.literal("")),
  logoUrl: z
    .string()
    .trim()
    .max(500, "URL logo quá dài.")
    .optional()
    .or(z.literal("")),
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

type UpsertBrandFormValues = z.infer<typeof upsertBrandSchema>;

export type AdminBrandUpsertModalMode = "create" | "edit";

export type AdminBrandUpsertModalBrand = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  logoUrl?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  aiDescription?: string | null;
  aiTags?: string[] | null;
};

type AdminBrandUpsertModalProps = {
  mode: AdminBrandUpsertModalMode;
  isOpen: boolean;
  brand?: AdminBrandUpsertModalBrand | null;
  onClose: () => void;
  onCompleted: () => void;
};

const AdminBrandUpsertModal: React.FC<AdminBrandUpsertModalProps> = ({
  mode,
  isOpen,
  brand,
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
  } = useForm<UpsertBrandFormValues>({
    resolver: zodResolver(upsertBrandSchema),
    defaultValues: {
      name: brand?.name ?? "",
      slug: brand?.slug ?? "",
      description: brand?.description ?? "",
      logoUrl: brand?.logoUrl ?? "",
      seoTitle: brand?.seoTitle ?? "",
      seoDescription: brand?.seoDescription ?? "",
      aiDescription: brand?.aiDescription ?? "",
      aiTagsInput: brand?.aiTags?.join(", ") ?? "",
    },
    values: {
      name: brand?.name ?? "",
      slug: brand?.slug ?? "",
      description: brand?.description ?? "",
      logoUrl: brand?.logoUrl ?? "",
      seoTitle: brand?.seoTitle ?? "",
      seoDescription: brand?.seoDescription ?? "",
      aiDescription: brand?.aiDescription ?? "",
      aiTagsInput: brand?.aiTags?.join(", ") ?? "",
    },
  });

  const isEdit = mode === "edit";
  const [slugTouched, setSlugTouched] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const onSubmit = async (values: UpsertBrandFormValues) => {
    const aiTags =
      values.aiTagsInput
        ?.split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0) ?? [];

    const payload = {
      name: values.name.trim(),
      slug: values.slug.trim(),
      description: values.description?.trim() || undefined,
      logoUrl: values.logoUrl?.trim() || undefined,
      seoTitle: values.seoTitle?.trim() || undefined,
      seoDescription: values.seoDescription?.trim() || undefined,
      aiDescription: values.aiDescription?.trim() || undefined,
      aiTags: aiTags.length > 0 ? aiTags : undefined,
    };

    try {
      const response = await fetch(
        isEdit && brand
          ? `/api/admin/brands/${encodeURIComponent(brand.id)}`
          : "/api/admin/brands",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const json = (await response.json()) as { error?: string };

      if (!response.ok) {
        toast.error(
          json.error ??
            (isEdit
              ? "Không thể cập nhật thương hiệu."
              : "Không thể tạo thương hiệu mới.")
        );
        return;
      }

      toast.success(
        isEdit
          ? "Cập nhật thương hiệu thành công."
          : "Tạo thương hiệu mới thành công."
      );
      reset();
      onCompleted();
      onClose();
    } catch {
      toast.error(
        isEdit
          ? "Có lỗi xảy ra khi cập nhật thương hiệu. Vui lòng thử lại."
          : "Có lỗi xảy ra khi tạo thương hiệu. Vui lòng thử lại."
      );
    }
  };

  const handleGenerateAi = async () => {
    if (isGeneratingAi || isSubmitting) return;

    const currentName = getValues("name")?.trim() ?? "";
    const currentDescription = getValues("description")?.trim() ?? "";

    if (!currentName) {
      toast.error("Vui lòng nhập tên thương hiệu trước khi sinh nội dung AI.");
      return;
    }

    setIsGeneratingAi(true);

    try {
      const response = await fetch("/api/admin/brands/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: currentName,
          description: currentDescription || undefined,
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
            "Không thể sinh nội dung AI cho thương hiệu. Vui lòng thử lại sau."
        );
        return;
      }

      const { seoTitle, seoDescription, aiDescription, aiTags } = json.data;

      if (seoTitle) setValue("seoTitle", seoTitle, { shouldDirty: true });
      if (seoDescription)
        setValue("seoDescription", seoDescription, { shouldDirty: true });
      if (aiDescription)
        setValue("aiDescription", aiDescription, { shouldDirty: true });
      if (aiTags && aiTags.length > 0)
        setValue("aiTagsInput", aiTags.join(", "), { shouldDirty: true });

      toast.success(
        "Đã sinh nội dung SEO và mô tả AI cho thương hiệu. Bạn có thể chỉnh sửa lại trước khi lưu."
      );
    } catch {
      toast.error(
        "Có lỗi xảy ra khi gọi AI. Vui lòng kiểm tra cấu hình Groq và thử lại."
      );
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const title = isEdit ? "Cập nhật thương hiệu" : "Thêm thương hiệu mới";
  const subtitle = isEdit
    ? "Chỉnh sửa thông tin và nội dung SEO/AI của thương hiệu."
    : "Tạo thương hiệu mới cho hệ thống Đức Uy Audio.";
  const primaryLabel = isEdit ? "Lưu thay đổi" : "Tạo thương hiệu";

  const nameField = register("name");
  const slugField = register("slug");

  if (!isOpen) return null;

  return (
    <div
      className={styles["admin-brand-upsert-modal"]}
      role="dialog"
      aria-modal="true"
    >
      <div className={styles["admin-brand-upsert-modal__panel"]}>
        <header className={styles["admin-brand-upsert-modal__header"]}>
          <div className={styles["admin-brand-upsert-modal__title-group"]}>
            <h2 className={styles["admin-brand-upsert-modal__title"]}>
              {title}
            </h2>
            <p className={styles["admin-brand-upsert-modal__subtitle"]}>
              {subtitle}
            </p>
          </div>
          <button
            type="button"
            className={styles["admin-brand-upsert-modal__close-button"]}
            onClick={handleClose}
            aria-label="Đóng"
          >
            <MdClose />
          </button>
        </header>

        <form
          className={styles["admin-brand-upsert-modal__body"]}
          onSubmit={handleSubmit(onSubmit)}
        >
          <div className={styles["admin-brand-upsert-modal__field-row"]}>
            <div>
              <div className={styles["admin-brand-upsert-modal__field-label"]}>
                Tên thương hiệu
              </div>
              <p
                className={
                  styles["admin-brand-upsert-modal__field-description"]
                }
              >
                Ví dụ: Accuphase, McIntosh, JBL Synthesis.
              </p>
            </div>
            <input
              type="text"
              className={styles["admin-brand-upsert-modal__input"]}
              placeholder="Nhập tên thương hiệu"
              {...nameField}
              onChange={(e) => {
                nameField.onChange(e);
                if (!isEdit && !slugTouched) {
                  const base = e.target.value.trim();
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
              <p className={styles["admin-brand-upsert-modal__error-text"]}>
                {errors.name.message}
              </p>
            )}
          </div>

          <div className={styles["admin-brand-upsert-modal__field-row"]}>
            <div>
              <div className={styles["admin-brand-upsert-modal__field-label"]}>
                Slug
              </div>
              <p
                className={
                  styles["admin-brand-upsert-modal__field-description"]
                }
              >
                Dùng trong URL, chỉ chữ thường, số và dấu gạch ngang.
              </p>
            </div>
            <input
              type="text"
              className={styles["admin-brand-upsert-modal__input"]}
              placeholder="Ví dụ: accuphase-audio"
              {...slugField}
              onChange={(e) => {
                slugField.onChange(e);
                if (!slugTouched) setSlugTouched(true);
              }}
              disabled={isEdit}
            />
            {errors.slug?.message && (
              <p className={styles["admin-brand-upsert-modal__error-text"]}>
                {errors.slug.message}
              </p>
            )}
          </div>

          <div className={styles["admin-brand-upsert-modal__field-row"]}>
            <div>
              <div className={styles["admin-brand-upsert-modal__field-label"]}>
                URL logo (tuỳ chọn)
              </div>
              <p
                className={
                  styles["admin-brand-upsert-modal__field-description"]
                }
              >
                Đường dẫn ảnh logo thương hiệu.
              </p>
            </div>
            <input
              type="url"
              className={styles["admin-brand-upsert-modal__input"]}
              placeholder="https://..."
              {...register("logoUrl")}
            />
            {errors.logoUrl?.message && (
              <p className={styles["admin-brand-upsert-modal__error-text"]}>
                {errors.logoUrl.message}
              </p>
            )}
          </div>

          <div className={styles["admin-brand-upsert-modal__field-row"]}>
            <div>
              <div className={styles["admin-brand-upsert-modal__field-label"]}>
                Mô tả thương hiệu
              </div>
              <p
                className={
                  styles["admin-brand-upsert-modal__field-description"]
                }
              >
                Giới thiệu ngắn về thương hiệu, giúp AI sinh nội dung SEO chính xác hơn.
              </p>
            </div>
            <textarea
              className={styles["admin-brand-upsert-modal__textarea"]}
              placeholder="Ví dụ: Thương hiệu Nhật Bản chuyên ampli và DAC hi-end..."
              {...register("description")}
            />
            {errors.description?.message && (
              <p className={styles["admin-brand-upsert-modal__error-text"]}>
                {errors.description.message}
              </p>
            )}
          </div>

          <div className={styles["admin-brand-upsert-modal__field-row"]}>
            <div className={styles["admin-brand-upsert-modal__ai-header"]}>
              <div>
                <div
                  className={styles["admin-brand-upsert-modal__field-label"]}
                >
                  Tối ưu SEO & AI (tuỳ chọn)
                </div>
                <p
                  className={
                    styles["admin-brand-upsert-modal__field-description"]
                  }
                >
                  Để trống thì khi lưu hệ thống có thể tự sinh. Hoặc bấm nút bên dưới để sinh ngay.
                </p>
              </div>
              <button
                type="button"
                className={
                  styles["admin-brand-upsert-modal__ai-generate-button"]
                }
                onClick={handleGenerateAi}
                disabled={isSubmitting || isGeneratingAi}
              >
                {isGeneratingAi
                  ? "Đang sinh nội dung..."
                  : "Sinh nội dung bằng AI"}
              </button>
            </div>
            <div className={styles["admin-brand-upsert-modal__ai-grid"]}>
              <div>
                <div
                  className={
                    styles["admin-brand-upsert-modal__field-label-inline"]
                  }
                >
                  Tiêu đề SEO
                </div>
                <input
                  type="text"
                  className={styles["admin-brand-upsert-modal__input"]}
                  placeholder="Ví dụ: Accuphase - Ampli Hi-End Đức Uy Audio"
                  {...register("seoTitle")}
                />
                {errors.seoTitle?.message && (
                  <p className={styles["admin-brand-upsert-modal__error-text"]}>
                    {errors.seoTitle.message}
                  </p>
                )}
              </div>
              <div>
                <div
                  className={
                    styles["admin-brand-upsert-modal__field-label-inline"]
                  }
                >
                  Mô tả SEO
                </div>
                <textarea
                  className={styles["admin-brand-upsert-modal__textarea"]}
                  placeholder="Mô tả ngắn 155-160 ký tự cho trang thương hiệu."
                  {...register("seoDescription")}
                />
                {errors.seoDescription?.message && (
                  <p className={styles["admin-brand-upsert-modal__error-text"]}>
                    {errors.seoDescription.message}
                  </p>
                )}
              </div>
            </div>
            <div className={styles["admin-brand-upsert-modal__ai-grid"]}>
              <div>
                <div
                  className={
                    styles["admin-brand-upsert-modal__field-label-inline"]
                  }
                >
                  Mô tả cho AI
                </div>
                <textarea
                  className={styles["admin-brand-upsert-modal__textarea"]}
                  placeholder="Phong cách âm thanh, phân khúc, điểm mạnh..."
                  {...register("aiDescription")}
                />
                {errors.aiDescription?.message && (
                  <p className={styles["admin-brand-upsert-modal__error-text"]}>
                    {errors.aiDescription.message}
                  </p>
                )}
              </div>
              <div>
                <div
                  className={
                    styles["admin-brand-upsert-modal__field-label-inline"]
                  }
                >
                  Thẻ AI (cách nhau bởi dấu phẩy)
                </div>
                <input
                  type="text"
                  className={styles["admin-brand-upsert-modal__input"]}
                  placeholder="Ví dụ: nhat, am-thanh-am, hi-end"
                  {...register("aiTagsInput")}
                />
                {errors.aiTagsInput?.message && (
                  <p className={styles["admin-brand-upsert-modal__error-text"]}>
                    {errors.aiTagsInput.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          <footer className={styles["admin-brand-upsert-modal__footer"]}>
            <button
              type="button"
              className={styles["admin-brand-upsert-modal__secondary-button"]}
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Huỷ
            </button>
            <button
              type="submit"
              className={styles["admin-brand-upsert-modal__primary-button"]}
              disabled={isSubmitting}
            >
              {isSubmitting && (
                <span
                  className={
                    styles["admin-brand-upsert-modal__primary-button-spinner"]
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

export default AdminBrandUpsertModal;
