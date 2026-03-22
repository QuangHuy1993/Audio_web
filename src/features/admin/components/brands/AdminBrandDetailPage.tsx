"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  MdArrowBack,
  MdInfo,
  MdQueryStats,
  MdSearch,
  MdPsychology,
  MdPhotoCamera,
  MdSave,
  MdAutoFixHigh,
  MdArrowForward,
} from "react-icons/md";
import { toast } from "sonner";
import clsx from "clsx";
import DataLoadingOverlay from "@/components/shared/DataLoadingOverlay";
import styles from "./AdminBrandDetailPage.module.css";

type BrandProduct = {
  id: string;
  name: string;
  slug: string;
  price: number;
  stock: number;
  status: string;
  categoryName: string | null;
  imageUrl: string | null;
};

type BrandDetail = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  aiDescription: string | null;
  aiTags: string[];
  productCount: number;
  products: BrandProduct[];
  createdAt: string;
  updatedAt: string;
};

function formatVnd(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

const AdminBrandDetailPage: React.FC = () => {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const searchParams = useSearchParams();
  const pageParam = searchParams?.get("page");
  const searchParam = searchParams?.get("search");
  const segmentParam = searchParams?.get("segment");

  const backParams = new URLSearchParams();
  if (pageParam && /^\d+$/.test(pageParam)) {
    backParams.set("page", pageParam);
  }
  if (searchParam) {
    backParams.set("search", searchParam);
  }
  if (segmentParam) {
    backParams.set("segment", segmentParam);
  }
  const backQuery = backParams.toString();
  const backUrl = backQuery ? `/admin/brands?${backQuery}` : "/admin/brands";
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [data, setData] = useState<BrandDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [aiDescription, setAiDescription] = useState("");
  const [aiTags, setAiTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    const startedAt = performance.now();
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/admin/brands/${id}`, {
          signal: controller.signal,
        });
        const json = (await res.json()) as {
          error?: string;
          data?: BrandDetail;
        };
        if (!res.ok) {
          setError(json.error ?? "Không thể tải thông tin thương hiệu.");
          return;
        }
        const d = json.data;
        if (!d) {
          setError("Không thể tải thông tin thương hiệu.");
          return;
        }
        setData(d);
        setName(d.name);
        setSlug(d.slug);
        setDescription(d.description ?? "");
        setLogoUrl(d.logoUrl);
        setLogoFile(null);
        setLogoPreview(null);
        setSeoTitle(d.seoTitle ?? "");
        setSeoDescription(d.seoDescription ?? "");
        setAiDescription(d.aiDescription ?? "");
        setAiTags(d.aiTags ?? []);
      } catch (e) {
        if ((e as { name?: string }).name !== "AbortError") {
          setError("Đã xảy ra lỗi khi tải dữ liệu.");
        }
      } finally {
        const elapsed = performance.now() - startedAt;
        const minimum = 500;
        const remaining = minimum - elapsed;
        const done = () => setLoading(false);
        if (remaining > 0) setTimeout(done, remaining);
        else done();
      }
    })();
    return () => controller.abort();
  }, [id]);

  const handleDiscard = () => {
    if (!data) return;
    setName(data.name);
    setSlug(data.slug);
    setDescription(data.description ?? "");
    setLogoUrl(data.logoUrl);
    setLogoFile(null);
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(null);
    setSeoTitle(data.seoTitle ?? "");
    setSeoDescription(data.seoDescription ?? "");
    setAiDescription(data.aiDescription ?? "");
    setAiTags(data.aiTags ?? []);
    toast.success("Đã hoàn tác thay đổi.");
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };

  const handleSave = async () => {
    if (!id || isSaving) return;
    const slugPattern = /^[a-z0-9-]+$/;
    if (!slugPattern.test(slug.trim())) {
      toast.error("Slug chỉ được chứa chữ thường, số và dấu gạch ngang.");
      return;
    }
    setIsSaving(true);
    try {
      if (logoFile) {
        const formData = new FormData();
        formData.append("name", name.trim());
        formData.append("slug", slug.trim());
        formData.append("description", description.trim());
        formData.append("seoTitle", seoTitle.trim());
        formData.append("seoDescription", seoDescription.trim());
        formData.append("aiDescription", aiDescription.trim());
        formData.append("aiTags", JSON.stringify(aiTags));
        formData.append("logo", logoFile);
        const res = await fetch(`/api/admin/brands/${id}`, {
          method: "PATCH",
          body: formData,
        });
        const json = (await res.json()) as { error?: string; data?: { logoUrl?: string | null } };
        if (!res.ok) {
          toast.error(json.error ?? "Không thể cập nhật thương hiệu.");
          return;
        }
        toast.success("Đã lưu thông tin. Logo đang được tải lên và sẽ cập nhật trong giây lát.");
        router.push(backUrl);
        setLogoFile(null);
        if (logoPreview) URL.revokeObjectURL(logoPreview);
        setLogoPreview(null);
        setData((prev) =>
          prev
            ? {
                ...prev,
                name: name.trim(),
                slug: slug.trim(),
                description: description.trim() || null,
                logoUrl: json.data?.logoUrl ?? prev.logoUrl,
                seoTitle: seoTitle.trim() || null,
                seoDescription: seoDescription.trim() || null,
                aiDescription: aiDescription.trim() || null,
                aiTags,
              }
            : null,
        );
        setLogoUrl(json.data?.logoUrl ?? logoUrl);
      } else {
        const res = await fetch(`/api/admin/brands/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            slug: slug.trim(),
            description: description.trim() || null,
            logoUrl: logoUrl?.trim() || null,
            seoTitle: seoTitle.trim() || null,
            seoDescription: seoDescription.trim() || null,
            aiDescription: aiDescription.trim() || null,
            aiTags: aiTags.length ? aiTags : [],
          }),
        });
        const json = (await res.json()) as { error?: string; data?: unknown };
        if (!res.ok) {
          toast.error(json.error ?? "Không thể cập nhật thương hiệu.");
          return;
        }
        toast.success("Đã lưu thông tin thương hiệu.");
        router.push(backUrl);
        setData((prev) =>
          prev
            ? {
                ...prev,
                name: name.trim(),
                slug: slug.trim(),
                description: description.trim() || null,
                logoUrl: logoUrl?.trim() || null,
                seoTitle: seoTitle.trim() || null,
                seoDescription: seoDescription.trim() || null,
                aiDescription: aiDescription.trim() || null,
                aiTags,
              }
            : null,
        );
      }
    } catch {
      toast.error("Có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoClick = () => logoInputRef.current?.click();

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      toast.error("Chỉ chấp nhận ảnh: JPG, PNG, WebP, GIF.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ảnh tối đa 5MB.");
      return;
    }
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    e.target.value = "";
  };

  const handleAddTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (!t || aiTags.includes(t)) return;
    setAiTags((prev) => [...prev, t]);
    setTagInput("");
  };

  const handleRemoveTag = (i: number) => {
    setAiTags((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleRegenerateAi = async () => {
    if (!id) return;
    try {
      const res = await fetch("/api/admin/brands/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        data?: {
          seoTitle?: string;
          seoDescription?: string;
          aiDescription?: string;
          aiTags?: string[];
        };
      };
      if (!res.ok || !json.data) {
        toast.error(json.error ?? "Không thể sinh nội dung AI.");
        return;
      }
      const d = json.data;
      if (d.seoTitle) setSeoTitle(d.seoTitle);
      if (d.seoDescription) setSeoDescription(d.seoDescription);
      if (d.aiDescription) setAiDescription(d.aiDescription ?? "");
      if (d.aiTags?.length) setAiTags((prev) => [...new Set([...prev, ...d.aiTags!])]);
      toast.success("Đã sinh nội dung SEO và AI.");
    } catch {
      toast.error("Có lỗi khi gọi AI.");
    }
  };

  if (loading) {
    return (
      <div className={styles["admin-brand-detail-page"]}>
        <DataLoadingOverlay
          isActive
          subtitle="Đang tải thông tin thương hiệu..."
          bottomText="Đang đồng bộ dữ liệu từ hệ thống..."
        />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles["admin-brand-detail-page"]}>
        <div className={styles["admin-brand-detail-page__error"]}>
          {error ?? "Thương hiệu không tồn tại."}
        </div>
        <Link
          href={backUrl}
          className={styles["admin-brand-detail-page__breadcrumb-link"]}
        >
          Quay lại danh sách thương hiệu
        </Link>
      </div>
    );
  }

  const displayLogo = logoPreview ?? logoUrl ?? null;
  const productCount = data.productCount ?? 0;
  const products = data.products ?? [];

  return (
    <div className={styles["admin-brand-detail-page"]}>
      <header className={styles["admin-brand-detail-page__header"]}>
        <div className={styles["admin-brand-detail-page__header-left"]}>
          <Link
            href={backUrl}
            className={styles["admin-brand-detail-page__back"]}
            aria-label="Quay lại"
          >
            <MdArrowBack />
          </Link>
          <div>
            <nav className={styles["admin-brand-detail-page__breadcrumb"]}>
              <Link
                href={backUrl}
                className={styles["admin-brand-detail-page__breadcrumb-link"]}
              >
                Thương hiệu
              </Link>
              <span>/</span>
              <span className={styles["admin-brand-detail-page__breadcrumb-current"]}>
                {data.name}
              </span>
            </nav>
            <h1 className={styles["admin-brand-detail-page__title"]}>
              Chi tiết và cập nhật thương hiệu
            </h1>
          </div>
        </div>
        <div className={styles["admin-brand-detail-page__header-actions"]}>
          <button
            type="button"
            className={styles["admin-brand-detail-page__btn-discard"]}
            onClick={handleDiscard}
          >
            Huỷ thay đổi
          </button>
          <button
            type="button"
            className={styles["admin-brand-detail-page__btn-save"]}
            onClick={handleSave}
            disabled={isSaving}
          >
            <MdSave />
            Lưu thay đổi
          </button>
        </div>
      </header>

      <div className={styles["admin-brand-detail-page__content"]}>
        <div className={styles["admin-brand-detail-page__grid-top"]}>
          <div className={styles["admin-brand-detail-page__card"]}>
            <div className={styles["admin-brand-detail-page__card-header"]}>
              <h2 className={styles["admin-brand-detail-page__card-title"]}>
                <MdInfo className={styles["admin-brand-detail-page__card-title-icon"]} />
                Thông tin chung
              </h2>
              <span className={styles["admin-brand-detail-page__card-id"]}>
                ID: {data.id.slice(0, 8).toUpperCase()}
              </span>
            </div>
            <div className={styles["admin-brand-detail-page__form-grid"]}>
              <div className={styles["admin-brand-detail-page__logo-wrap"]}>
                <label className={styles["admin-brand-detail-page__label"]}>
                  Logo thương hiệu
                </label>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className={styles["admin-brand-detail-page__logo-input-hidden"]}
                  onChange={handleLogoChange}
                  aria-label="Chọn ảnh logo"
                />
                <button
                  type="button"
                  className={styles["admin-brand-detail-page__logo-zone"]}
                  onClick={handleLogoClick}
                  aria-label="Đổi logo"
                >
                  {displayLogo ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={displayLogo}
                      alt="Logo"
                      className={styles["admin-brand-detail-page__logo-preview"]}
                    />
                  ) : (
                    <MdPhotoCamera style={{ fontSize: 32 }} />
                  )}
                  <span className={styles["admin-brand-detail-page__logo-zone-text"]}>
                    {logoFile ? "Ảnh mới (bấm Lưu để áp dụng)" : "Đổi logo"}
                  </span>
                </button>
              </div>
              <div className={styles["admin-brand-detail-page__fields"]}>
                <div className={styles["admin-brand-detail-page__field-row"]}>
                  <div>
                    <label className={styles["admin-brand-detail-page__label"]}>
                      Tên thương hiệu
                    </label>
                    <input
                      type="text"
                      className={styles["admin-brand-detail-page__input"]}
                      value={name}
                      onChange={handleNameChange}
                    />
                  </div>
                  <div>
                    <label className={styles["admin-brand-detail-page__label"]}>
                      URL Slug
                    </label>
                    <div style={{ display: "flex" }}>
                      <span className={styles["admin-brand-detail-page__slug-prefix"]}>
                        /brand/
                      </span>
                      <input
                        type="text"
                        className={clsx(
                          styles["admin-brand-detail-page__input"],
                          styles["admin-brand-detail-page__slug-input"],
                        )}
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className={styles["admin-brand-detail-page__label"]}>
                    Mô tả thương hiệu
                  </label>
                  <textarea
                    className={styles["admin-brand-detail-page__textarea"]}
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={clsx(styles["admin-brand-detail-page__card"], styles["admin-brand-detail-page__card--performance"])}>
            <div className={styles["admin-brand-detail-page__card-header"]}>
              <h2 className={styles["admin-brand-detail-page__card-title"]}>
                <MdQueryStats className={styles["admin-brand-detail-page__card-title-icon"]} />
                Hiệu suất
              </h2>
            </div>
            <div className={styles["admin-brand-detail-page__performance-list"]}>
              <div className={styles["admin-brand-detail-page__performance-row"]}>
                <span className={styles["admin-brand-detail-page__performance-label"]}>
                  Tổng sản phẩm
                </span>
                <span className={styles["admin-brand-detail-page__performance-value"]}>
                  {productCount}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles["admin-brand-detail-page__grid-bottom"]}>
          <div className={styles["admin-brand-detail-page__card"]}>
            <div className={styles["admin-brand-detail-page__card-header"]}>
              <h2 className={styles["admin-brand-detail-page__card-title"]}>
                <MdSearch className={styles["admin-brand-detail-page__card-title-icon--accent"]} />
                Cấu hình SEO
              </h2>
            </div>
            <div className={styles["admin-brand-detail-page__fields"]}>
              <div>
                <label className={styles["admin-brand-detail-page__label"]}>
                  Meta Title
                </label>
                <input
                  type="text"
                  className={styles["admin-brand-detail-page__input"]}
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  maxLength={60}
                />
                <span className={styles["admin-brand-detail-page__seo-preview-title"]}>
                  {seoTitle.length}/60 ký tự
                </span>
              </div>
              <div>
                <label className={styles["admin-brand-detail-page__label"]}>
                  Meta Description
                </label>
                <textarea
                  className={styles["admin-brand-detail-page__textarea"]}
                  rows={2}
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  maxLength={160}
                />
                <span className={styles["admin-brand-detail-page__seo-preview-title"]}>
                  {seoDescription.length}/160 ký tự
                </span>
              </div>
              <div className={styles["admin-brand-detail-page__seo-preview"]}>
                <p className={styles["admin-brand-detail-page__seo-preview-title"]}>
                  Google Preview
                </p>
                <p className={styles["admin-brand-detail-page__seo-preview-line"]}>
                  {seoTitle || "(Chưa có tiêu đề)"}
                </p>
                <p className={styles["admin-brand-detail-page__seo-preview-url"]}>
                  dcuyaudio.com › brand › {slug || "..."}
                </p>
                <p className={styles["admin-brand-detail-page__seo-preview-desc"]}>
                  {seoDescription || "(Chưa có mô tả)"}
                </p>
              </div>
            </div>
          </div>

          <div className={clsx(styles["admin-brand-detail-page__card"], styles["admin-brand-detail-page__card--ai"])}>
            <div className={styles["admin-brand-detail-page__card-header"]}>
              <h2 className={styles["admin-brand-detail-page__card-title"]}>
                <MdPsychology className={styles["admin-brand-detail-page__card-title-icon--purple"]} />
                Nội dung tư vấn AI
              </h2>
              <button
                type="button"
                className={styles["admin-brand-detail-page__ai-badge"]}
                onClick={handleRegenerateAi}
              >
                <MdAutoFixHigh />
                Sinh lại
              </button>
            </div>
            <div className={styles["admin-brand-detail-page__fields"]}>
              <div>
                <label className={styles["admin-brand-detail-page__label"]}>
                  Mô tả âm thanh / phân khúc (cho AI)
                </label>
                <textarea
                  className={styles["admin-brand-detail-page__textarea"]}
                  rows={3}
                  value={aiDescription}
                  onChange={(e) => setAiDescription(e.target.value)}
                  placeholder="Mô tả phong cách âm thanh, phân khúc. Bấm Sinh lại để tạo tự động."
                />
              </div>
              <div>
                <label className={styles["admin-brand-detail-page__label"]}>
                  Thẻ AI (tags)
                </label>
                <div className={styles["admin-brand-detail-page__ai-tags"]}>
                  {aiTags.map((tag, i) => (
                    <span
                      key={tag}
                      className={clsx(
                        styles["admin-brand-detail-page__tag-pill"],
                        styles["admin-brand-detail-page__tag-pill--ai"],
                      )}
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(i)}
                        aria-label={`Xoá tag ${tag}`}
                        style={{
                          marginLeft: 6,
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: 0,
                          fontSize: 12,
                        }}
                      >
                        x
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    className={styles["admin-brand-detail-page__input"]}
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                    placeholder="Thêm tag..."
                    style={{ width: 120 }}
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className={styles["admin-brand-detail-page__tag-pill"]}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles["admin-brand-detail-page__card"]}>
          <div className={styles["admin-brand-detail-page__products-header"]}>
            <h2 className={styles["admin-brand-detail-page__products-title"]}>
              Sản phẩm thuộc thương hiệu
            </h2>
            <span
              className={styles["admin-brand-detail-page__products-count"]}
            >
              Tổng {productCount} sản phẩm
            </span>
          </div>
          <div className={styles["admin-brand-detail-page__table-wrap"]}>
            {products.length === 0 ? (
              <div className={styles["admin-brand-detail-page__empty"]}>
                Chưa có sản phẩm nào thuộc thương hiệu này.
              </div>
            ) : (
              <table className={styles["admin-brand-detail-page__table"]}>
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th>Danh mục</th>
                    <th>Giá (SRP)</th>
                    <th>Tồn kho</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const stockPct = p.stock > 10 ? 100 : p.stock > 0 ? (p.stock / 10) * 100 : 0;
                    return (
                      <tr key={p.id}>
                        <td>
                          <div className={styles["admin-brand-detail-page__product-cell"]}>
                            {p.imageUrl ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={p.imageUrl}
                                alt=""
                                className={styles["admin-brand-detail-page__product-img"]}
                              />
                            ) : (
                              <div
                                className={styles["admin-brand-detail-page__product-img"]}
                                style={{ background: "var(--background-tertiary)" }}
                              />
                            )}
                            <div>
                              <p className={styles["admin-brand-detail-page__product-name"]}>
                                {p.name}
                              </p>
                              <p className={styles["admin-brand-detail-page__product-sub"]}>
                                {p.slug}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={styles["admin-brand-detail-page__category-badge"]}>
                            {p.categoryName ?? "—"}
                          </span>
                        </td>
                        <td>
                          <span className={styles["admin-brand-detail-page__price"]}>
                            {formatVnd(p.price)} đ
                          </span>
                        </td>
                        <td>
                          <span className={styles["admin-brand-detail-page__stock-bar"]}>
                            <span
                              className={clsx(
                                styles["admin-brand-detail-page__stock-bar-fill"],
                                stockPct < 30 && styles["admin-brand-detail-page__stock-bar-fill--low"],
                              )}
                              style={{ width: `${Math.min(100, stockPct)}%` }}
                            />
                          </span>
                          <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                            {p.stock} trong kho
                          </span>
                        </td>
                        <td>
                          <span
                            className={styles["admin-brand-detail-page__product-link"]}
                            title={`Sản phẩm: ${p.name}`}
                          >
                            <MdArrowForward size={20} />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminBrandDetailPage;
