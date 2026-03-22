/* AdminProductNewPage
 * Màn thêm mới sản phẩm trong khu vực admin.
 * Bố cục và phong cách bám sát AdminBrandNewPage:
 * - Header với breadcrumb, nút Huỷ / Tạo sản phẩm.
 * - Card thông tin chung (ảnh sản phẩm, tên, slug, mô tả).
 * - Card giá & tồn kho.
 * - Card cấu hình SEO.
 * - Card chi tiết tư vấn AI (mô tả AI + thẻ AI).
 * Hỗ trợ nhiều ảnh sản phẩm với preview client-side, tải ảnh bất đồng bộ (chỉ xử lý ở UI).
 */

"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MdAdd,
  MdAddCircle,
  MdArrowBack,
  MdAutoFixHigh,
  MdBolt,
  MdInfo,
  MdInventory2,
  MdLightbulb,
  MdPaid,
  MdPhotoCamera,
  MdPsychology,
  MdSearch,
} from "react-icons/md";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import clsx from "clsx";
import styles from "./AdminProductNewPage.module.css";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const createProductSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Tên sản phẩm là bắt buộc.")
    .max(200, "Tên sản phẩm quá dài."),
  slug: z
    .string()
    .trim()
    .min(1, "Slug là bắt buộc.")
    .max(200, "Slug quá dài.")
    .regex(
      /^[a-z0-9-]+$/,
      "Slug chỉ bao gồm chữ thường, số và dấu gạch ngang.",
    ),
  description: z
    .string()
    .trim()
    .min(1, "Mô tả sản phẩm là bắt buộc.")
    .max(2000, "Mô tả sản phẩm quá dài."),
  price: z
    .number()
    .positive("Giá sản phẩm phải lớn hơn 0.")
    .or(z.nan())
    .transform((val) => (Number.isNaN(val) ? 0 : val)),
  discountPercent: z
    .number()
    .min(0, "Giảm giá không được âm.")
    .max(100, "Giảm giá tối đa 100%.")
    .or(z.nan())
    .transform((val) => (Number.isNaN(val) ? 0 : val)),
  currency: z.string().trim().min(1).max(8),
  stock: z
    .number()
    .int("Tồn kho phải là số nguyên.")
    .min(0, "Tồn kho không được âm.")
    .or(z.nan())
    .transform((val) => (Number.isNaN(val) ? 0 : val)),
  status: z.enum(["ACTIVE", "DRAFT", "HIDDEN"]),
  brandId: z
    .string()
    .trim()
    .max(128, "Mã thương hiệu quá dài.")
    .optional()
    .or(z.literal("")),
  categoryId: z
    .string()
    .trim()
    .max(128, "Mã danh mục quá dài.")
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
    .max(800, "Mô tả AI quá dài.")
    .optional()
    .or(z.literal("")),
});

type CreateProductFormValues = z.infer<typeof createProductSchema>;

type BrandOption = {
  id: string;
  name: string;
};

type CategoryOption = {
  id: string;
  name: string;
};

type ImagePreview = {
  file: File;
  previewUrl: string;
};

const AdminProductNewPage: React.FC = () => {
  const router = useRouter();

  const primaryImageInputRef = useRef<HTMLInputElement | null>(null);
  const secondaryImagesInputRef = useRef<HTMLInputElement | null>(null);
  const [primaryImage, setPrimaryImage] = useState<ImagePreview | null>(null);
  const [secondaryImages, setSecondaryImages] = useState<ImagePreview[]>([]);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiTags, setAiTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [brandOptions, setBrandOptions] = useState<BrandOption[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [, setMetaError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<CreateProductFormValues>({
    resolver: zodResolver(createProductSchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      price: 0,
      discountPercent: undefined,
      currency: "VND",
      stock: 0,
      status: "ACTIVE",
      brandId: "",
      categoryId: "",
      seoTitle: "",
      seoDescription: "",
      aiDescription: "",
    },
  });

  useEffect(() => {
    return () => {
      if (primaryImage) URL.revokeObjectURL(primaryImage.previewUrl);
      secondaryImages.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    };
  }, [primaryImage, secondaryImages]);

  const nameField = register("name");
  const slugField = register("slug");
  const seoTitle = watch("seoTitle") ?? "";
  const seoDescription = watch("seoDescription") ?? "";
  const priceValue = watch("price") ?? 0;
  const currencyValue = watch("currency") ?? "VND";
  const discountPercent = watch("discountPercent") ?? 0;

  useEffect(() => {
    const loadMeta = async () => {
      setIsLoadingMeta(true);
      setMetaError(null);
      try {
      const [brandsRes, categoriesRes] = await Promise.all([
          fetch("/api/admin/brands?page=1&pageSize=100"),
          fetch("/api/admin/categories?page=1&pageSize=100&level=all"),
        ]);

        if (brandsRes.ok) {
          const brandsJson = (await brandsRes.json()) as {
            data?: { id: string; name: string }[];
          };
          setBrandOptions(
            (brandsJson.data ?? []).map((b) => ({ id: b.id, name: b.name })),
          );
        }

        if (categoriesRes.ok) {
          const categoriesJson = (await categoriesRes.json()) as {
            data?: { id: string; name: string }[];
          };
          setCategoryOptions(
            (categoriesJson.data ?? []).map((c) => ({
              id: c.id,
              name: c.name,
            })),
          );
        }
      } catch {
        setMetaError("Không thể tải danh sách thương hiệu và danh mục.");
      } finally {
        setIsLoadingMeta(false);
      }
    };

    void loadMeta();
  }, []);

  const formatCurrency = (value: number, currency: string) => {
    if (!value || Number.isNaN(value)) return "";
    try {
      return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: currency || "VND",
        maximumFractionDigits: currency === "VND" ? 0 : 2,
      }).format(value);
    } catch {
      return `${value.toLocaleString("vi-VN")} ${currency || "VND"}`;
    }
  };

  const computedDiscountedPrice =
    priceValue && discountPercent
      ? Math.max(0, priceValue * (1 - discountPercent / 100))
      : null;

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    nameField.onChange(e);
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
    setValue("slug", slug, { shouldValidate: true });
  };

  const handlePrimaryImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Chỉ chấp nhận ảnh: JPG, PNG, WebP, GIF.");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      toast.error("Ảnh đại diện tối đa 5MB.");
      return;
    }
    setPrimaryImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return { file, previewUrl: URL.createObjectURL(file) };
    });
  };

  const handleSecondaryImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    const validFiles: File[] = [];
    for (const file of files) {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        toast.error("Chỉ chấp nhận ảnh: JPG, PNG, WebP, GIF.");
        continue;
      }
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        toast.error("Mỗi ảnh tối đa 5MB.");
        continue;
      }
      validFiles.push(file);
    }
    if (validFiles.length === 0) return;

    setSecondaryImages((prev) => [
      ...prev,
      ...validFiles.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })),
    ]);
  };

  const handleRemoveSecondaryImage = (index: number) => {
    setSecondaryImages((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  };

  const handleAddTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (!t || aiTags.includes(t)) return;
    setAiTags((prev) => [...prev, t]);
    setTagInput("");
  };

  const handleRemoveTag = (index: number) => {
    setAiTags((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGenerateAi = async () => {
    if (isGeneratingAi || isSubmitting) return;
    const currentName = getValues("name")?.trim() ?? "";
    const currentDescription = getValues("description")?.trim() ?? "";
    const currentBrandId = getValues("brandId")?.trim() ?? "";
    const currentCategoryId = getValues("categoryId")?.trim() ?? "";
    const currentPrice = priceValue;

    if (!currentName) {
      toast.error("Vui lòng nhập tên sản phẩm trước khi sinh nội dung AI.");
      return;
    }
    setIsGeneratingAi(true);
    try {
      const response = await fetch("/api/admin/products/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: currentName,
          description: currentDescription || undefined,
          brandId: currentBrandId || undefined,
          categoryId: currentCategoryId || undefined,
          price: currentPrice || null,
          currency: currencyValue,
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
            "Không thể sinh nội dung AI cho sản phẩm. Vui lòng thử lại sau.",
        );
        return;
      }

      const {
        seoTitle: st,
        seoDescription: sd,
        aiDescription: ad,
        aiTags: tags,
      } = json.data;

      if (st) setValue("seoTitle", st, { shouldDirty: true });
      if (sd) setValue("seoDescription", sd, { shouldDirty: true });
      if (ad) setValue("aiDescription", ad, { shouldDirty: true });
      if (tags && tags.length > 0) {
        setAiTags((prev) => [...new Set([...prev, ...tags])]);
      }

      toast.success(
        "Đã sinh nội dung SEO và mô tả AI. Bạn có thể chỉnh sửa trước khi tạo.",
      );
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const onSubmit = async (values: CreateProductFormValues) => {
    try {
      const trimmedAiTags = aiTags.map((tag) => tag.trim()).filter(Boolean);

      let response: Response;

      if (primaryImage || secondaryImages.length > 0) {
        const formData = new FormData();
        formData.append("name", values.name.trim());
        formData.append("slug", values.slug.trim());
        formData.append("description", values.description.trim());
        formData.append("price", String(values.price));
        formData.append(
          "discountPercent",
          String(values.discountPercent ?? 0),
        );
        formData.append("currency", values.currency);
        formData.append("stock", String(values.stock));
        formData.append("status", values.status);
        if (values.brandId?.trim()) {
          formData.append("brandId", values.brandId.trim());
        }
        if (values.categoryId?.trim()) {
          formData.append("categoryId", values.categoryId.trim());
        }
        if (values.seoTitle?.trim()) {
          formData.append("seoTitle", values.seoTitle.trim());
        }
        if (values.seoDescription?.trim()) {
          formData.append("seoDescription", values.seoDescription.trim());
        }
        if (values.aiDescription?.trim()) {
          formData.append("aiDescription", values.aiDescription.trim());
        }
        if (trimmedAiTags.length > 0) {
          formData.append("aiTags", JSON.stringify(trimmedAiTags));
        }

        if (primaryImage) {
          formData.append("primaryImage", primaryImage.file);
        }
        secondaryImages.forEach((img) => {
          formData.append("secondaryImages", img.file);
        });

        response = await fetch("/api/admin/products", {
          method: "POST",
          body: formData,
        });
      } else {
        response = await fetch("/api/admin/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: values.name.trim(),
            slug: values.slug.trim(),
            description: values.description.trim(),
            price: values.price,
            discountPercent: values.discountPercent ?? 0,
            currency: values.currency,
            stock: values.stock,
            status: values.status,
            brandId: values.brandId?.trim() || undefined,
            categoryId: values.categoryId?.trim() || undefined,
            seoTitle: values.seoTitle?.trim() || undefined,
            seoDescription: values.seoDescription?.trim() || undefined,
            aiDescription: values.aiDescription?.trim() || undefined,
            aiTags: trimmedAiTags.length > 0 ? trimmedAiTags : undefined,
          }),
        });
      }

      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(json.error ?? "Không thể tạo sản phẩm mới.");
        return;
      }

      toast.success("Tạo sản phẩm mới thành công.");
      router.push("/admin/products");
    } catch {
      toast.error("Có lỗi xảy ra. Vui lòng thử lại.");
    }
  };

  return (
    <div className={styles["admin-product-new-page"]}>
      <header className={styles["admin-product-new-page__header"]}>
        <div className={styles["admin-product-new-page__header-left"]}>
          <Link
            href="/admin/products"
            className={styles["admin-product-new-page__back"]}
            aria-label="Quay lại"
          >
            <MdArrowBack />
          </Link>
          <div>
            <nav className={styles["admin-product-new-page__breadcrumb"]}>
              <Link
                href="/admin/products"
                className={styles["admin-product-new-page__breadcrumb-link"]}
              >
                Sản phẩm
              </Link>
              <span>/</span>
              <span className={styles["admin-product-new-page__breadcrumb-current"]}>
                Thêm sản phẩm
              </span>
            </nav>
            <h1 className={styles["admin-product-new-page__title"]}>
              Đăng ký sản phẩm mới
            </h1>
          </div>
        </div>
        <div className={styles["admin-product-new-page__header-actions"]}>
          <Link
            href="/admin/products"
            className={styles["admin-product-new-page__btn-discard"]}
          >
            Huỷ
          </Link>
          <button
            type="button"
            className={styles["admin-product-new-page__btn-create"]}
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting}
          >
            <MdAddCircle />
            Tạo sản phẩm
          </button>
        </div>
      </header>

      <div className={styles["admin-product-new-page__content"]}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className={styles["admin-product-new-page__grid"]}>
            <div className={styles["admin-product-new-page__card"]}>
              <div className={styles["admin-product-new-page__card-header"]}>
                <h2 className={styles["admin-product-new-page__card-title"]}>
                  <MdInfo className={styles["admin-product-new-page__card-title-icon"]} />
                  Thông tin chung
                </h2>
                <span className={styles["admin-product-new-page__card-badge"]}>
                  Mới
                </span>
              </div>
              <div className={styles["admin-product-new-page__form-grid"]}>
                <div className={styles["admin-product-new-page__image-sections"]}>
                  {/* Ảnh đại diện */}
                  <div>
                    <div className={styles["admin-product-new-page__image-section-header"]}>
                      <label className={styles["admin-product-new-page__label"]}>
                        Ảnh đại diện
                      </label>
                    </div>
                    <input
                      ref={primaryImageInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className={styles["admin-product-new-page__image-input-hidden"]}
                      onChange={handlePrimaryImageChange}
                      aria-label="Chọn ảnh đại diện"
                    />
                    {primaryImage ? (
                      <div className={styles["admin-product-new-page__primary-preview"]}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={primaryImage.previewUrl}
                          alt="Ảnh đại diện"
                          className={styles["admin-product-new-page__primary-preview-img"]}
                        />
                        <button
                          type="button"
                          className={styles["admin-product-new-page__image-grid-remove"]}
                          onClick={() => {
                            URL.revokeObjectURL(primaryImage.previewUrl);
                            setPrimaryImage(null);
                          }}
                          aria-label="Xoá ảnh đại diện"
                        >
                          ×
                        </button>
                        <button
                          type="button"
                          className={styles["admin-product-new-page__primary-change-btn"]}
                          onClick={() => primaryImageInputRef.current?.click()}
                        >
                          Đổi ảnh
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={styles["admin-product-new-page__image-zone"]}
                        onClick={() => primaryImageInputRef.current?.click()}
                        aria-label="Tải ảnh đại diện lên"
                      >
                        <MdPhotoCamera className={styles["admin-product-new-page__image-zone-icon"]} />
                        <span className={styles["admin-product-new-page__image-zone-text"]}>
                          Chọn ảnh đại diện
                        </span>
                        <span className={styles["admin-product-new-page__image-zone-hint"]}>
                          PNG, JPG, WebP, GIF tối đa 5MB
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Ảnh phụ */}
                  <div>
                    <div className={styles["admin-product-new-page__image-section-header"]}>
                      <label className={styles["admin-product-new-page__label"]}>
                        Ảnh phụ{" "}
                        <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 400 }}>
                          — tùy chọn
                        </span>
                      </label>
                    </div>
                    <input
                      ref={secondaryImagesInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      multiple
                      className={styles["admin-product-new-page__image-input-hidden"]}
                      onChange={handleSecondaryImagesChange}
                      aria-label="Chọn ảnh phụ"
                    />
                    <div className={styles["admin-product-new-page__image-grid"]}>
                      {secondaryImages.map((img, index) => (
                        <div
                          key={`${img.previewUrl}-${index}`}
                          className={styles["admin-product-new-page__image-grid-item"]}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.previewUrl}
                            alt=""
                            className={styles["admin-product-new-page__image-grid-preview"]}
                          />
                          <button
                            type="button"
                            className={styles["admin-product-new-page__image-grid-remove"]}
                            onClick={() => handleRemoveSecondaryImage(index)}
                            aria-label="Xoá ảnh phụ"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className={styles["admin-product-new-page__image-grid-add-more"]}
                        onClick={() => secondaryImagesInputRef.current?.click()}
                        aria-label="Thêm ảnh phụ"
                      >
                        <MdAdd />
                      </button>
                    </div>
                  </div>
                </div>

                <div className={styles["admin-product-new-page__fields"]}>
                  <div className={styles["admin-product-new-page__field-row"]}>
                    <div className={styles["admin-product-new-page__field"]}>
                      <label className={styles["admin-product-new-page__label"]}>
                        Tên sản phẩm
                      </label>
                      <input
                        type="text"
                        className={styles["admin-product-new-page__input"]}
                        placeholder="Ví dụ: Loa cột hi-end XYZ 802 D4"
                        {...nameField}
                        onChange={handleNameChange}
                      />
                      {errors.name?.message && (
                        <span className={styles["admin-product-new-page__error"]}>
                          {errors.name.message}
                        </span>
                      )}
                    </div>
                    <div className={styles["admin-product-new-page__field"]}>
                      <label className={styles["admin-product-new-page__label"]}>
                        URL Slug
                      </label>
                      <div style={{ display: "flex" }}>
                        <span className={styles["admin-product-new-page__slug-prefix"]}>
                          /product/
                        </span>
                        <input
                          type="text"
                          className={clsx(
                            styles["admin-product-new-page__input"],
                            styles["admin-product-new-page__input--slug"],
                          )}
                          placeholder="loa-cot-hi-end-xyz-802-d4"
                          {...slugField}
                        />
                      </div>
                      {errors.slug?.message && (
                        <span className={styles["admin-product-new-page__error"]}>
                          {errors.slug.message}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className={styles["admin-product-new-page__field-row"]}>
                    <div className={styles["admin-product-new-page__field"]}>
                      <label className={styles["admin-product-new-page__label"]}>
                        Mã thương hiệu (brandId)
                      </label>
                      <select
                        className={styles["admin-product-new-page__select"]}
                        {...register("brandId")}
                      >
                        <option value="">
                          {isLoadingMeta
                            ? "Đang tải thương hiệu..."
                            : "Không chọn thương hiệu"}
                        </option>
                        {brandOptions.map((brand) => (
                          <option key={brand.id} value={brand.id}>
                            {brand.name}
                          </option>
                        ))}
                      </select>
                      {errors.brandId?.message && (
                        <span className={styles["admin-product-new-page__error"]}>
                          {errors.brandId.message}
                        </span>
                      )}
                    </div>
                    <div className={styles["admin-product-new-page__field"]}>
                      <label className={styles["admin-product-new-page__label"]}>
                        Mã danh mục (categoryId)
                      </label>
                      <select
                        className={styles["admin-product-new-page__select"]}
                        {...register("categoryId")}
                      >
                        <option value="">
                          {isLoadingMeta
                            ? "Đang tải danh mục..."
                            : "Không chọn danh mục"}
                        </option>
                        {categoryOptions.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                      {errors.categoryId?.message && (
                        <span className={styles["admin-product-new-page__error"]}>
                          {errors.categoryId.message}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className={styles["admin-product-new-page__field"]}>
                    <label className={styles["admin-product-new-page__label"]}>
                      Mô tả sản phẩm
                    </label>
                    <textarea
                      className={styles["admin-product-new-page__textarea"]}
                      placeholder="Nhập mô tả chi tiết về công nghệ, cấu hình, trải nghiệm nghe..."
                      rows={4}
                      {...register("description")}
                    />
                    {errors.description?.message && (
                      <span className={styles["admin-product-new-page__error"]}>
                        {errors.description.message}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div
              className={clsx(
                styles["admin-product-new-page__card"],
                styles["admin-product-new-page__card--ai"],
              )}
            >
              <div className={styles["admin-product-new-page__card-header"]}>
                <h2 className={styles["admin-product-new-page__card-title"]}>
                  <MdPsychology className={styles["admin-product-new-page__card-title-icon--purple"]} />
                  Chiến lược AI cho sản phẩm
                </h2>
                <span className={styles["admin-product-new-page__ai-badge"]}>
                  <MdAutoFixHigh /> Hỗ trợ AI
                </span>
              </div>
              <div className={styles["admin-product-new-page__ai-suggestion"]}>
                <p className={styles["admin-product-new-page__ai-suggestion-title"]}>
                  <MdAutoFixHigh /> Gợi ý tự động
                </p>
                <p className={styles["admin-product-new-page__ai-suggestion-text"]}>
                  Điền thông tin chung (tên, mô tả sản phẩm) rồi bấm nút bên dưới để AI gợi ý cấu hình SEO và thẻ AI phục vụ tư vấn.
                </p>
              </div>
              <button
                type="button"
                className={styles["admin-product-new-page__btn-generate"]}
                onClick={handleGenerateAi}
                disabled={isGeneratingAi || isSubmitting}
              >
                <MdBolt />
                {isGeneratingAi ? "Đang sinh nội dung..." : "Sinh gợi ý bằng AI"}
              </button>
            </div>
          </div>

          <div className={styles["admin-product-new-page__grid-second"]}>
            <div className={styles["admin-product-new-page__card"]}>
              <div className={styles["admin-product-new-page__card-header"]}>
                <h2 className={styles["admin-product-new-page__card-title"]}>
                  <MdPaid className={styles["admin-product-new-page__card-title-icon--accent"]} />
                  Giá & tồn kho
                </h2>
              </div>
              <div className={styles["admin-product-new-page__fields"]}>
                <div className={styles["admin-product-new-page__field-row"]}>
                  <div className={styles["admin-product-new-page__field"]}>
                    <label className={styles["admin-product-new-page__label"]}>
                      Giá niêm yết
                    </label>
                    <input
                      type="number"
                      step={1000}
                      className={styles["admin-product-new-page__input"]}
                      placeholder="Ví dụ: 120000000"
                      {...register("price", {
                        valueAsNumber: true,
                        onChange: (e) => {
                          const target = e.target as HTMLInputElement;
                          if (target.value === "") {
                            // Cho phép để trống khi xoá hết
                            setValue("price", 0, { shouldValidate: false });
                          }
                        },
                      })}
                      onFocus={(e) => {
                        if (e.target.value === "0") {
                          e.target.select();
                        }
                      }}
                    />
                    {errors.price?.message && (
                      <span className={styles["admin-product-new-page__error"]}>
                        {errors.price.message}
                      </span>
                    )}
                    {priceValue > 0 && (
                      <p className={styles["admin-product-new-page__char-count"]}>
                        Giá hiển thị:{" "}
                        <strong>
                          {formatCurrency(priceValue, currencyValue)}
                        </strong>
                      </p>
                    )}
                  </div>
                  <div className={styles["admin-product-new-page__field"]}>
                    <label className={styles["admin-product-new-page__label"]}>
                      Giảm giá (%)
                    </label>
                    <input
                      type="number"
                      step={1}
                      min={0}
                      max={100}
                      className={styles["admin-product-new-page__input"]}
                      placeholder="Ví dụ: 10 cho 10%"
                      {...register("discountPercent", {
                        valueAsNumber: true,
                      })}
                    />
                    {errors.discountPercent?.message && (
                      <span className={styles["admin-product-new-page__error"]}>
                        {errors.discountPercent.message}
                      </span>
                    )}
                    {computedDiscountedPrice != null && priceValue > 0 && (
                      <p className={styles["admin-product-new-page__char-count"]}>
                        Giá sau giảm:{" "}
                        <strong>
                          {formatCurrency(
                            computedDiscountedPrice,
                            currencyValue,
                          )}
                        </strong>
                      </p>
                    )}
                  </div>
                </div>

                <div className={styles["admin-product-new-page__field-row"]}>
                  <div className={styles["admin-product-new-page__field"]}>
                    <label className={styles["admin-product-new-page__label"]}>
                      Đơn vị tiền tệ
                    </label>
                    <select
                      className={styles["admin-product-new-page__select"]}
                      {...register("currency")}
                    >
                      <option value="VND">VND</option>
                      <option value="USD">USD</option>
                    </select>
                    {errors.currency?.message && (
                      <span className={styles["admin-product-new-page__error"]}>
                        {errors.currency.message}
                      </span>
                    )}
                  </div>
                  <div className={styles["admin-product-new-page__field"]}>
                    <label className={styles["admin-product-new-page__label"]}>
                      Tồn kho ban đầu
                    </label>
                    <input
                      type="number"
                      step={1}
                      min={0}
                      className={styles["admin-product-new-page__input"]}
                      placeholder="Ví dụ: 5"
                      {...register("stock", {
                        valueAsNumber: true,
                      })}
                    />
                    {errors.stock?.message && (
                      <span className={styles["admin-product-new-page__error"]}>
                        {errors.stock.message}
                      </span>
                    )}
                  </div>
                </div>

                <div className={styles["admin-product-new-page__field"]}>
                  <label className={styles["admin-product-new-page__label"]}>
                    Trạng thái hiển thị
                  </label>
                  <select
                    className={styles["admin-product-new-page__select"]}
                    {...register("status")}
                  >
                    <option value="ACTIVE">Đang hiển thị</option>
                    <option value="DRAFT">Bản nháp</option>
                    <option value="HIDDEN">Đã ẩn</option>
                  </select>
                  {errors.status?.message && (
                    <span className={styles["admin-product-new-page__error"]}>
                      {errors.status.message}
                    </span>
                  )}
                </div>

                <div className={styles["admin-product-new-page__tip-box"]}>
                  <div className={styles["admin-product-new-page__tip-icon"]}>
                    <MdInventory2 />
                  </div>
                  <div>
                    <p className={styles["admin-product-new-page__tip-title"]}>
                      Gợi ý quản lý kho
                    </p>
                    <p className={styles["admin-product-new-page__tip-text"]}>
                      Tồn kho ban đầu sẽ dùng cho module Kho hàng. Mọi thay đổi sau này nên
                      được thực hiện qua màn hình quản lý kho để có đầy đủ lịch sử nhập/xuất.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles["admin-product-new-page__card"]}>
              <div className={styles["admin-product-new-page__card-header"]}>
                <h2 className={styles["admin-product-new-page__card-title"]}>
                  <MdSearch className={styles["admin-product-new-page__card-title-icon--accent"]} />
                  Cấu hình SEO
                </h2>
              </div>
              <div className={styles["admin-product-new-page__fields"]}>
                <div className={styles["admin-product-new-page__field"]}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <label className={styles["admin-product-new-page__label"]}>
                      Meta Title
                    </label>
                    <span className={styles["admin-product-new-page__char-count"]}>
                      {seoTitle.length}/60
                    </span>
                  </div>
                  <input
                    type="text"
                    className={styles["admin-product-new-page__input"]}
                    placeholder="Tên sản phẩm - Đại lý chính hãng | Đức Uy Audio"
                    {...register("seoTitle")}
                  />
                  {errors.seoTitle?.message && (
                    <span className={styles["admin-product-new-page__error"]}>
                      {errors.seoTitle.message}
                    </span>
                  )}
                </div>
                <div className={styles["admin-product-new-page__field"]}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <label className={styles["admin-product-new-page__label"]}>
                      Meta Description
                    </label>
                    <span className={styles["admin-product-new-page__char-count"]}>
                      {seoDescription.length}/160
                    </span>
                  </div>
                  <textarea
                    className={styles["admin-product-new-page__textarea"]}
                    placeholder="Khám phá chi tiết cấu hình, công nghệ và trải nghiệm nghe của sản phẩm..."
                    rows={3}
                    {...register("seoDescription")}
                  />
                  {errors.seoDescription?.message && (
                    <span className={styles["admin-product-new-page__error"]}>
                      {errors.seoDescription.message}
                    </span>
                  )}
                </div>
                <div className={styles["admin-product-new-page__seo-preview"]}>
                  <p className={styles["admin-product-new-page__seo-preview-label"]}>
                    Google Preview
                  </p>
                  <p className={styles["admin-product-new-page__seo-preview-title"]}>
                    {seoTitle || "Nhập tiêu đề ở trên..."}
                  </p>
                  <p className={styles["admin-product-new-page__seo-preview-url"]}>
                    ducuyaudio.com › product › ...
                  </p>
                  <p className={styles["admin-product-new-page__seo-preview-desc"]}>
                    {seoDescription ||
                      "Mô tả SEO sẽ hiển thị tại đây khi bạn nhập."}
                  </p>
                </div>
              </div>
            </div>

            <div
              className={clsx(
                styles["admin-product-new-page__card"],
                styles["admin-product-new-page__card--ai"],
              )}
            >
              <div className={styles["admin-product-new-page__card-header"]}>
                <h2 className={styles["admin-product-new-page__card-title"]}>
                  <MdPsychology className={styles["admin-product-new-page__card-title-icon--purple"]} />
                  Chi tiết tư vấn AI
                </h2>
              </div>
              <div className={styles["admin-product-new-page__fields"]}>
                <div className={styles["admin-product-new-page__field"]}>
                  <label className={styles["admin-product-new-page__label"]}>
                    Mô tả âm thanh/ngữ cảnh cho AI
                  </label>
                  <textarea
                    className={styles["admin-product-new-page__textarea"]}
                    placeholder="Ví dụ: Phù hợp phòng 20–30m2, thiên về vocal, âm ấm, bass kiểm soát tốt..."
                    rows={4}
                    {...register("aiDescription")}
                  />
                  {errors.aiDescription?.message && (
                    <span className={styles["admin-product-new-page__error"]}>
                      {errors.aiDescription.message}
                    </span>
                  )}
                </div>
                <div className={styles["admin-product-new-page__field"]}>
                  <label className={styles["admin-product-new-page__label"]}>
                    Thẻ AI (tags)
                  </label>
                  <div className={styles["admin-product-new-page__tags-wrap"]}>
                    <div className={styles["admin-product-new-page__tag-input-row"]}>
                      <input
                        type="text"
                        className={styles["admin-product-new-page__tag-input"]}
                        placeholder="Thêm thẻ, ví dụ: phong-20-30m2, home-cinema..."
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddTag();
                          }
                        }}
                      />
                      <button
                        type="button"
                        className={styles["admin-product-new-page__tag-add"]}
                        onClick={handleAddTag}
                        aria-label="Thêm thẻ"
                      >
                        <MdAdd />
                      </button>
                    </div>
                    {aiTags.map((tag, i) => (
                      <span
                        key={`${tag}-${i}`}
                        className={styles["admin-product-new-page__tag-pill"]}
                      >
                        {tag}
                        <button
                          type="button"
                          className={
                            styles["admin-product-new-page__tag-pill-remove"]
                          }
                          onClick={() => handleRemoveTag(i)}
                          aria-label="Xoá thẻ"
                        >
                          <MdAdd style={{ transform: "rotate(45deg)" }} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <p className={styles["admin-product-new-page__tags-hint"]}>
                    Gợi ý: phong-20-30m2, phong-khach, nghe-nhac, xem-phim, home-cinema, 2-kenh
                  </p>
                </div>
                <div className={styles["admin-product-new-page__tip-box"]}>
                  <div className={styles["admin-product-new-page__tip-icon"]}>
                    <MdLightbulb />
                  </div>
                  <div>
                    <p className={styles["admin-product-new-page__tip-title"]}>
                      Gợi ý mô tả cho AI
                    </p>
                    <p className={styles["admin-product-new-page__tip-text"]}>
                      Càng mô tả rõ không gian, gu nghe, kiểu nhạc, càng giúp AI gợi ý sản phẩm và phối ghép chính xác cho khách hàng.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminProductNewPage;

