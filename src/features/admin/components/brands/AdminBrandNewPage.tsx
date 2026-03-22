"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MdArrowBack,
  MdAddCircle,
  MdInfo,
  MdPsychology,
  MdSearch,
  MdAutoFixHigh,
  MdBolt,
  MdAdd,
  MdLightbulb,
  MdPhotoCamera,
} from "react-icons/md";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import clsx from "clsx";
import styles from "./AdminBrandNewPage.module.css";

const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const createBrandSchema = z.object({
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
});

type CreateBrandFormValues = z.infer<typeof createBrandSchema>;

const AdminBrandNewPage: React.FC = () => {
  const router = useRouter();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [aiTags, setAiTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<CreateBrandFormValues>({
    resolver: zodResolver(createBrandSchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      seoTitle: "",
      seoDescription: "",
      aiDescription: "",
    },
  });

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  const nameField = register("name");
  const slugField = register("slug");
  const seoTitle = watch("seoTitle") ?? "";
  const seoDescription = watch("seoDescription") ?? "";

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

  const handleAddTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (!t || aiTags.includes(t)) return;
    setAiTags((prev) => [...prev, t]);
    setTagInput("");
  };

  const handleRemoveTag = (index: number) => {
    setAiTags((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLogoZoneClick = () => {
    logoInputRef.current?.click();
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Chỉ chấp nhận ảnh: JPG, PNG, WebP, GIF.");
      return;
    }
    if (file.size > MAX_LOGO_SIZE_BYTES) {
      toast.error("Ảnh tối đa 5MB.");
      return;
    }
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(URL.createObjectURL(file));
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
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
      const { seoTitle: st, seoDescription: sd, aiDescription: ad, aiTags: tags } = json.data;
      if (st) setValue("seoTitle", st, { shouldDirty: true });
      if (sd) setValue("seoDescription", sd, { shouldDirty: true });
      if (ad) setValue("aiDescription", ad, { shouldDirty: true });
      if (tags && tags.length > 0) setAiTags((prev) => [...new Set([...prev, ...tags])]);
      toast.success("Đã sinh nội dung SEO và mô tả AI. Bạn có thể chỉnh sửa trước khi tạo.");
    } catch {
      toast.error("Có lỗi khi gọi AI. Vui lòng kiểm tra cấu hình Groq và thử lại.");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const onSubmit = async (values: CreateBrandFormValues) => {
    try {
      if (logoFile) {
        const formData = new FormData();
        formData.append("name", values.name.trim());
        formData.append("slug", values.slug.trim());
        formData.append("description", values.description?.trim() ?? "");
        formData.append("seoTitle", values.seoTitle?.trim() ?? "");
        formData.append("seoDescription", values.seoDescription?.trim() ?? "");
        formData.append("aiDescription", values.aiDescription?.trim() ?? "");
        formData.append("aiTags", JSON.stringify(aiTags));
        formData.append("logo", logoFile);
        const response = await fetch("/api/admin/brands", {
          method: "POST",
          body: formData,
        });
        const json = (await response.json()) as { error?: string; data?: unknown };
        if (!response.ok) {
          toast.error(json.error ?? "Không thể tạo thương hiệu mới.");
          return;
        }
        toast.success("Tạo thương hiệu mới thành công. Logo đang được tải lên và sẽ cập nhật trong giây lát.");
        router.push("/admin/brands");
      } else {
        const payload = {
          name: values.name.trim(),
          slug: values.slug.trim(),
          description: values.description?.trim() || undefined,
          logoUrl: logoDataUrl?.trim() || undefined,
          seoTitle: values.seoTitle?.trim() || undefined,
          seoDescription: values.seoDescription?.trim() || undefined,
          aiDescription: values.aiDescription?.trim() || undefined,
          aiTags: aiTags.length > 0 ? aiTags : undefined,
        };
        const response = await fetch("/api/admin/brands", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = (await response.json()) as { error?: string };
        if (!response.ok) {
          toast.error(json.error ?? "Không thể tạo thương hiệu mới.");
          return;
        }
        toast.success("Tạo thương hiệu mới thành công.");
        router.push("/admin/brands");
      }
    } catch {
      toast.error("Có lỗi xảy ra. Vui lòng thử lại.");
    }
  };

  return (
    <div className={styles["admin-brand-new-page"]}>
      <header className={styles["admin-brand-new-page__header"]}>
        <div className={styles["admin-brand-new-page__header-left"]}>
          <Link
            href="/admin/brands"
            className={styles["admin-brand-new-page__back"]}
            aria-label="Quay lại"
          >
            <MdArrowBack />
          </Link>
          <div>
            <nav className={styles["admin-brand-new-page__breadcrumb"]}>
              <Link
                href="/admin/brands"
                className={styles["admin-brand-new-page__breadcrumb-link"]}
              >
                Thương hiệu
              </Link>
              <span>/</span>
              <span className={styles["admin-brand-new-page__breadcrumb-current"]}>
                Thêm thương hiệu
              </span>
            </nav>
            <h1 className={styles["admin-brand-new-page__title"]}>
              Đăng ký thương hiệu mới
            </h1>
          </div>
        </div>
        <div className={styles["admin-brand-new-page__header-actions"]}>
          <Link
            href="/admin/brands"
            className={styles["admin-brand-new-page__btn-discard"]}
          >
            Huỷ
          </Link>
          <button
            type="button"
            className={styles["admin-brand-new-page__btn-create"]}
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting}
          >
            <MdAddCircle />
            Tạo thương hiệu
          </button>
        </div>
      </header>

      <div className={styles["admin-brand-new-page__content"]}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className={styles["admin-brand-new-page__grid"]}>
            <div className={styles["admin-brand-new-page__card"]}>
              <div className={styles["admin-brand-new-page__card-header"]}>
                <h2 className={styles["admin-brand-new-page__card-title"]}>
                  <MdInfo className={styles["admin-brand-new-page__card-title-icon"]} />
                  Thông tin chung
                </h2>
                <span className={styles["admin-brand-new-page__card-badge"]}>
                  Mới
                </span>
              </div>
              <div className={styles["admin-brand-new-page__form-grid"]}>
                <div>
                  <label className={styles["admin-brand-new-page__label"]}>
                    Logo thương hiệu
                  </label>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className={styles["admin-brand-new-page__logo-input-hidden"]}
                    onChange={handleLogoChange}
                    aria-label="Chọn ảnh logo"
                  />
                  <button
                    type="button"
                    className={styles["admin-brand-new-page__logo-zone"]}
                    onClick={handleLogoZoneClick}
                    aria-label="Tải logo lên hoặc đổi ảnh"
                  >
                    {logoPreview || logoDataUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element -- preview from blob/data URL */
                      <img
                        src={logoPreview ?? logoDataUrl ?? ""}
                        alt="Preview logo"
                        className={styles["admin-brand-new-page__logo-preview"]}
                      />
                    ) : (
                      <>
                        <MdPhotoCamera className={styles["admin-brand-new-page__logo-zone-icon"]} />
                        <span className={styles["admin-brand-new-page__logo-zone-text"]}>
                          Tải ảnh lên
                        </span>
                        <span className={styles["admin-brand-new-page__logo-zone-hint"]}>
                          PNG, JPG tối đa 5MB
                        </span>
                      </>
                    )}
                  </button>
                </div>
                <div className={styles["admin-brand-new-page__fields"]}>
                  <div className={styles["admin-brand-new-page__field-row"]}>
                    <div className={styles["admin-brand-new-page__field"]}>
                      <label className={styles["admin-brand-new-page__label"]}>
                        Tên chính thức
                      </label>
                      <input
                        type="text"
                        className={styles["admin-brand-new-page__input"]}
                        placeholder="Ví dụ: Bowers & Wilkins"
                        {...nameField}
                        onChange={handleNameChange}
                      />
                      {errors.name?.message && (
                        <span className={styles["admin-brand-new-page__error"]}>
                          {errors.name.message}
                        </span>
                      )}
                    </div>
                    <div className={styles["admin-brand-new-page__field"]}>
                      <label className={styles["admin-brand-new-page__label"]}>
                        URL Slug
                      </label>
                      <div style={{ display: "flex" }}>
                        <span className={styles["admin-brand-new-page__slug-prefix"]}>
                          /brand/
                        </span>
                        <input
                          type="text"
                          className={clsx(
                            styles["admin-brand-new-page__input"],
                            styles["admin-brand-new-page__input--slug"]
                          )}
                          placeholder="ten-thuong-hieu"
                          {...slugField}
                        />
                      </div>
                      {errors.slug?.message && (
                        <span className={styles["admin-brand-new-page__error"]}>
                          {errors.slug.message}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={styles["admin-brand-new-page__field"]}>
                    <label className={styles["admin-brand-new-page__label"]}>
                      Mô tả thương hiệu
                    </label>
                    <textarea
                      className={styles["admin-brand-new-page__textarea"]}
                      placeholder="Nhập mô tả ngắn về thương hiệu và lịch sử..."
                      rows={3}
                      {...register("description")}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className={clsx(styles["admin-brand-new-page__card"], styles["admin-brand-new-page__card--ai"])}>
              <div className={styles["admin-brand-new-page__card-header"]}>
                <h2 className={styles["admin-brand-new-page__card-title"]}>
                  <MdPsychology className={styles["admin-brand-new-page__card-title-icon--purple"]} />
                  Chiến lược AI
                </h2>
                <span className={styles["admin-brand-new-page__ai-badge"]}>
                  <MdAutoFixHigh /> Hỗ trợ AI
                </span>
              </div>
              <div className={styles["admin-brand-new-page__ai-suggestion"]}>
                <p className={styles["admin-brand-new-page__ai-suggestion-title"]}>
                  <MdAutoFixHigh /> Gợi ý tự động
                </p>
                <p className={styles["admin-brand-new-page__ai-suggestion-text"]}>
                  Chỉ cần điền thông tin chung (tên, mô tả thương hiệu) bên trái, sau đó bấm nút bên dưới để AI tự sinh Cấu hình SEO và Chi tiết tư vấn AI.
                </p>
              </div>
              <button
                type="button"
                className={styles["admin-brand-new-page__btn-generate"]}
                onClick={handleGenerateAi}
                disabled={isGeneratingAi || isSubmitting}
              >
                <MdBolt />
                {isGeneratingAi ? "Đang sinh nội dung..." : "Sinh nội dung bằng AI"}
              </button>
            </div>
          </div>

          <div className={styles["admin-brand-new-page__grid-second"]}>
            <div className={styles["admin-brand-new-page__card"]}>
              <div className={styles["admin-brand-new-page__card-header"]}>
                <h2 className={styles["admin-brand-new-page__card-title"]}>
                  <MdSearch className={styles["admin-brand-new-page__card-title-icon--accent"]} />
                  Cấu hình SEO
                </h2>
              </div>
              <div className={styles["admin-brand-new-page__fields"]}>
                <div className={styles["admin-brand-new-page__field"]}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label className={styles["admin-brand-new-page__label"]}>
                      Meta Title
                    </label>
                    <span className={styles["admin-brand-new-page__char-count"]}>
                      {seoTitle.length}/60
                    </span>
                  </div>
                  <input
                    type="text"
                    className={styles["admin-brand-new-page__input"]}
                    placeholder="Tên thương hiệu - Đại lý chính hãng | Đức Uy Audio"
                    {...register("seoTitle")}
                  />
                  {errors.seoTitle?.message && (
                    <span className={styles["admin-brand-new-page__error"]}>
                      {errors.seoTitle.message}
                    </span>
                  )}
                </div>
                <div className={styles["admin-brand-new-page__field"]}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label className={styles["admin-brand-new-page__label"]}>
                      Meta Description
                    </label>
                    <span className={styles["admin-brand-new-page__char-count"]}>
                      {seoDescription.length}/160
                    </span>
                  </div>
                  <textarea
                    className={styles["admin-brand-new-page__textarea"]}
                    placeholder="Khám phá giải pháp âm thanh cao cấp từ..."
                    rows={3}
                    {...register("seoDescription")}
                  />
                  {errors.seoDescription?.message && (
                    <span className={styles["admin-brand-new-page__error"]}>
                      {errors.seoDescription.message}
                    </span>
                  )}
                </div>
                <div className={styles["admin-brand-new-page__seo-preview"]}>
                  <p className={styles["admin-brand-new-page__seo-preview-label"]}>
                    Google Preview
                  </p>
                  <p className={styles["admin-brand-new-page__seo-preview-title"]}>
                    {seoTitle || "Nhập tiêu đề ở trên..."}
                  </p>
                  <p className={styles["admin-brand-new-page__seo-preview-url"]}>
                    ducuyaudio.com › brand › ...
                  </p>
                  <p className={styles["admin-brand-new-page__seo-preview-desc"]}>
                    {seoDescription || "Mô tả SEO sẽ hiển thị tại đây khi bạn nhập."}
                  </p>
                </div>
              </div>
            </div>

            <div className={clsx(styles["admin-brand-new-page__card"], styles["admin-brand-new-page__card--ai"])}>
              <div className={styles["admin-brand-new-page__card-header"]}>
                <h2 className={styles["admin-brand-new-page__card-title"]}>
                  <MdPsychology className={styles["admin-brand-new-page__card-title-icon--purple"]} />
                  Chi tiết tư vấn AI
                </h2>
              </div>
              <div className={styles["admin-brand-new-page__fields"]}>
                <div className={styles["admin-brand-new-page__field"]}>
                  <label className={styles["admin-brand-new-page__label"]}>
                    Mô tả âm thanh cho AI (phân khúc thị trường)
                  </label>
                  <textarea
                    className={styles["admin-brand-new-page__textarea"]}
                    placeholder="Ví dụ: Thương hiệu đại diện phân khúc Ultra Hi-end với âm ấm, mạnh mẽ..."
                    rows={4}
                    {...register("aiDescription")}
                  />
                  {errors.aiDescription?.message && (
                    <span className={styles["admin-brand-new-page__error"]}>
                      {errors.aiDescription.message}
                    </span>
                  )}
                </div>
                <div className={styles["admin-brand-new-page__field"]}>
                  <label className={styles["admin-brand-new-page__label"]}>
                    Thẻ AI (tương tác)
                  </label>
                  <div className={styles["admin-brand-new-page__tags-wrap"]}>
                    <div className={styles["admin-brand-new-page__tag-input-row"]}>
                      <input
                        type="text"
                        className={styles["admin-brand-new-page__tag-input"]}
                        placeholder="Thêm thẻ..."
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
                        className={styles["admin-brand-new-page__tag-add"]}
                        onClick={handleAddTag}
                        aria-label="Thêm thẻ"
                      >
                        <MdAdd />
                      </button>
                    </div>
                    {aiTags.map((tag, i) => (
                      <span
                        key={`${tag}-${i}`}
                        className={styles["admin-brand-new-page__tag-pill"]}
                      >
                        {tag}
                        <button
                          type="button"
                          className={styles["admin-brand-new-page__tag-pill-remove"]}
                          onClick={() => handleRemoveTag(i)}
                          aria-label="Xoá thẻ"
                        >
                          <MdAdd style={{ transform: "rotate(45deg)" }} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <p className={styles["admin-brand-new-page__tags-hint"]}>
                    Gợi ý: #hi-end, #analog, #am, #luxury, #chuyen-nghiep
                  </p>
                </div>
                <div className={styles["admin-brand-new-page__tip-box"]}>
                  <div className={styles["admin-brand-new-page__tip-icon"]}>
                    <MdLightbulb />
                  </div>
                  <div>
                    <p className={styles["admin-brand-new-page__tip-title"]}>
                      Gợi ý liên kết thương hiệu
                    </p>
                    <p className={styles["admin-brand-new-page__tip-text"]}>
                      Mô tả rõ đặc tính âm thanh giúp AI gợi ý sản phẩm phù hợp hơn cho khách hàng.
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

export default AdminBrandNewPage;
