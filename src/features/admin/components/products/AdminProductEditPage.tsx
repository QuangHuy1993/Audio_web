"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  MdAdd,
  MdArrowBack,
  MdClose,
  MdBolt,
  MdInfo,
  MdInventory2,
  MdPaid,
  MdPhotoCamera,
  MdPsychology,
  MdSave,
  MdSearch,
  MdTrendingUp,
} from "react-icons/md";
import { toast } from "sonner";
import clsx from "clsx";
import DataLoadingOverlay from "@/components/shared/DataLoadingOverlay";
import styles from "./AdminProductNewPage.module.css";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

type ProductStatus = "ACTIVE" | "DRAFT" | "HIDDEN";

type ProductImageDto = {
  id: string;
  url: string;
  alt: string | null;
  isPrimary: boolean;
  sortOrder: number;
};

type ProductDetailDto = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  salePrice: number | null;
  currency: string;
  stock: number;
  status: ProductStatus;
  brandId: string | null;
  brandName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  aiDescription: string | null;
  aiTags: string[];
  images: ProductImageDto[];
  createdAt: string;
  updatedAt: string;
};

type BrandOption = {
  id: string;
  name: string;
};

type CategoryOption = {
  id: string;
  name: string;
};

type NewImagePreview = {
  file: File;
  previewUrl: string;
};

type InventoryLogItem = {
  id: string;
  change: number;
  reason: string | null;
  source: string | null;
  referenceId: string | null;
  createdAt: string;
};

const INVENTORY_LOG_PAGE_SIZE = 20;

function inventorySourceLabel(source: string | null): string {
  switch (source) {
    case "ADMIN_CREATE_PRODUCT":
      return "Khởi tạo";
    case "ADMIN_STOCK_IMPORT":
      return "Nhập kho";
    case "ADMIN_STOCK_ADJUST":
      return "Điều chỉnh";
    case "ORDER_PLACED":
      return "Đơn hàng";
    case "ORDER_CANCELLED":
      return "Huỷ đơn";
    default:
      return source ?? "—";
  }
}

const AdminProductEditPage: React.FC = () => {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const searchParams = useSearchParams();

  const pageParam = searchParams?.get("page");
  const searchParam = searchParams?.get("search");
  const statusParam = searchParams?.get("status");

  const backParams = new URLSearchParams();
  if (pageParam && /^\d+$/.test(pageParam)) {
    backParams.set("page", pageParam);
  }
  if (searchParam) {
    backParams.set("search", searchParam);
  }
  if (statusParam) {
    backParams.set("status", statusParam);
  }
  const backQuery = backParams.toString();
  const backUrl = backQuery ? `/admin/products?${backQuery}` : "/admin/products";

  const primaryImageInputRef = useRef<HTMLInputElement | null>(null);
  const secondaryImagesInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const [brandOptions, setBrandOptions] = useState<BrandOption[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);

  const [data, setData] = useState<ProductDetailDto | null>(null);
  const [newPrimaryImage, setNewPrimaryImage] = useState<NewImagePreview | null>(null);
  const [newSecondaryImages, setNewSecondaryImages] = useState<NewImagePreview[]>([]);
  const [imagesToDeleteIds, setImagesToDeleteIds] = useState<string[]>([]);
  const [setPrimaryImageId, setSetPrimaryImageId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [currency, setCurrency] = useState("VND");
  const [stock, setStock] = useState<number>(0);
  const [status, setStatus] = useState<ProductStatus>("ACTIVE");
  const [brandId, setBrandId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [aiDescription, setAiDescription] = useState("");
  const [aiTags, setAiTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const [showImportModal, setShowImportModal] = useState(false);
  const [importQuantity, setImportQuantity] = useState("");
  const [importReason, setImportReason] = useState("");
  const [importReferenceId, setImportReferenceId] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustMode, setAdjustMode] = useState<"decreaseBy" | "setTo">("decreaseBy");
  const [adjustValue, setAdjustValue] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustReferenceId, setAdjustReferenceId] = useState("");
  const [isAdjusting, setIsAdjusting] = useState(false);

  const [inventoryLogs, setInventoryLogs] = useState<InventoryLogItem[]>([]);
  const [inventoryLogsPage, setInventoryLogsPage] = useState(1);
  const [inventoryLogsTotal, setInventoryLogsTotal] = useState(0);
  const [inventoryLogsLoading, setInventoryLogsLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    const startedAt = performance.now();
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [detailRes, brandsRes, categoriesRes] = await Promise.all([
          fetch(`/api/admin/products/${id}`, { signal: controller.signal }),
          fetch("/api/admin/brands?page=1&pageSize=100", {
            signal: controller.signal,
          }),
          fetch(
            "/api/admin/categories?page=1&pageSize=100&level=all",
            { signal: controller.signal },
          ),
        ]);

        const detailJson = (await detailRes.json()) as {
          error?: string;
          data?: ProductDetailDto;
        };

        if (!detailRes.ok || !detailJson.data) {
          setError(detailJson.error ?? "Không thể tải thông tin sản phẩm.");
          return;
        }

        const d = detailJson.data;
        setData(d);
        setName(d.name);
        setSlug(d.slug);
        setDescription(d.description);
        setPrice(d.price);
        setDiscountPercent(
          d.salePrice && d.price
            ? Math.round((1 - d.salePrice / d.price) * 100)
            : 0,
        );
        setCurrency(d.currency || "VND");
        setStock(d.stock);
        setStatus(d.status);
        setBrandId(d.brandId ?? "");
        setCategoryId(d.categoryId ?? "");
        setSeoTitle(d.seoTitle ?? "");
        setSeoDescription(d.seoDescription ?? "");
        setAiDescription(d.aiDescription ?? "");
        setAiTags(d.aiTags ?? []);

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
      } catch (e) {
        if ((e as { name?: string }).name !== "AbortError") {
          setError("Đã xảy ra lỗi khi tải dữ liệu.");
        }
      } finally {
        const elapsed = performance.now() - startedAt;
        const minimum = 600;
        const remaining = minimum - elapsed;
        const done = () => setLoading(false);
        if (remaining > 0) setTimeout(done, remaining);
        else done();
      }
    })();

    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    if (!id || !data) return;
    const controller = new AbortController();
    setInventoryLogsLoading(true);
    fetch(
      `/api/admin/products/${id}/inventory/logs?page=${inventoryLogsPage}&pageSize=${INVENTORY_LOG_PAGE_SIZE}`,
      { signal: controller.signal },
    )
      .then((res) => res.json())
      .then((json: { data?: InventoryLogItem[]; total?: number }) => {
        setInventoryLogs(json.data ?? []);
        setInventoryLogsTotal(json.total ?? 0);
      })
      .catch((e) => {
        if ((e as { name?: string }).name !== "AbortError") {
          toast.error("Không thể tải lịch sử tồn kho.");
        }
      })
      .finally(() => setInventoryLogsLoading(false));
    return () => controller.abort();
  }, [id, data, inventoryLogsPage]);

  useEffect(() => {
    return () => {
      if (newPrimaryImage) URL.revokeObjectURL(newPrimaryImage.previewUrl);
      newSecondaryImages.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    };
  }, [newPrimaryImage, newSecondaryImages]);

  const actionParam = searchParams?.get("action");

  useEffect(() => {
    if (!data || !actionParam) return;
    if (actionParam === "import") {
      setImportQuantity("");
      setImportReason("");
      setShowImportModal(true);
      const next = new URLSearchParams(searchParams?.toString() ?? "");
      next.delete("action");
      const q = next.toString();
      router.replace(q ? `/admin/products/${id}?${q}` : `/admin/products/${id}`, {
        scroll: false,
      });
    } else if (actionParam === "adjust") {
      setAdjustMode("decreaseBy");
      setAdjustValue("");
      setAdjustReason("");
      setShowAdjustModal(true);
      const next = new URLSearchParams(searchParams?.toString() ?? "");
      next.delete("action");
      const q = next.toString();
      router.replace(q ? `/admin/products/${id}?${q}` : `/admin/products/${id}`, {
        scroll: false,
      });
    }
  }, [data, actionParam, id, router, searchParams]);

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
    setNewPrimaryImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return { file, previewUrl: URL.createObjectURL(file) };
    });
    // Clear "set as primary" selection since a new file takes precedence
    setSetPrimaryImageId(null);
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

    setNewSecondaryImages((prev) => [
      ...prev,
      ...validFiles.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })),
    ]);
  };

  const handleRemoveNewSecondaryImage = (index: number) => {
    setNewSecondaryImages((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  };

  const handleMarkExistingImageForDelete = (imageId: string) => {
    setImagesToDeleteIds((prev) =>
      prev.includes(imageId) ? prev : [...prev, imageId],
    );
    // If we're deleting the image that was chosen as "set primary", clear that choice
    if (setPrimaryImageId === imageId) {
      setSetPrimaryImageId(null);
    }
  };

  const handleSetAsPrimary = (imageId: string) => {
    // Clear any new primary upload since an existing image is being promoted
    setNewPrimaryImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    setSetPrimaryImageId(imageId);
  };

  const openImportModal = () => {
    setImportQuantity("");
    setImportReason("");
    setImportReferenceId("");
    setShowImportModal(true);
  };

  const closeImportModal = () => setShowImportModal(false);

  const submitImport = async () => {
    const q = Math.trunc(Number(importQuantity) || 0);
    if (!q || q <= 0) {
      toast.error("Số lượng nhập kho phải là số nguyên dương.");
      return;
    }
    if (!id) return;
    setIsImporting(true);
    try {
      const res = await fetch(`/api/admin/products/${id}/inventory/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: q,
          reason: importReason.trim() || undefined,
          referenceId: importReferenceId.trim() || undefined,
        }),
      });
      const json = (await res.json()) as { error?: string; data?: { newStock: number } };
      if (!res.ok) {
        toast.error(json.error ?? "Không thể nhập kho.");
        return;
      }
      setStock(json.data?.newStock ?? stock + q);
      setInventoryLogsPage(1);
      toast.success(`Đã nhập thêm ${q} đơn vị vào kho.`);
      closeImportModal();
    } finally {
      setIsImporting(false);
    }
  };

  const openAdjustModal = () => {
    setAdjustMode("decreaseBy");
    setAdjustValue("");
    setAdjustReason("");
    setAdjustReferenceId("");
    setShowAdjustModal(true);
  };

  const closeAdjustModal = () => setShowAdjustModal(false);

  const submitAdjust = async () => {
    const reasonTrim = adjustReason.trim();
    if (!reasonTrim) {
      toast.error("Lý do điều chỉnh tồn kho là bắt buộc.");
      return;
    }
    const num = Math.trunc(Number(adjustValue) || 0);
    if (adjustMode === "decreaseBy" && (num <= 0 || num > stock)) {
      toast.error("Số lượng giảm phải là số nguyên dương và không vượt quá tồn kho hiện tại.");
      return;
    }
    if (adjustMode === "setTo" && num < 0) {
      toast.error("Tồn kho mới không được âm.");
      return;
    }
    if (!id) return;
    setIsAdjusting(true);
    try {
      const body =
        adjustMode === "decreaseBy"
          ? {
              decreaseBy: num,
              reason: reasonTrim,
              referenceId: adjustReferenceId.trim() || undefined,
            }
          : {
              setTo: num,
              reason: reasonTrim,
              referenceId: adjustReferenceId.trim() || undefined,
            };
      const res = await fetch(`/api/admin/products/${id}/inventory/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        error?: string;
        data?: { previousStock: number; newStock: number };
      };
      if (!res.ok) {
        toast.error(json.error ?? "Không thể điều chỉnh tồn kho.");
        return;
      }
      const newStock = json.data?.newStock ?? stock;
      setStock(newStock);
      setInventoryLogsPage(1);
      toast.success(
        json.data?.previousStock !== json.data?.newStock
          ? `Đã điều chỉnh tồn kho từ ${json.data?.previousStock} xuống ${newStock}.`
          : "Tồn kho không thay đổi.",
      );
      closeAdjustModal();
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleDiscard = () => {
    if (!data) return;
    setName(data.name);
    setSlug(data.slug);
    setDescription(data.description);
    setPrice(data.price);
    setDiscountPercent(
      data.salePrice && data.price
        ? Math.round((1 - data.salePrice / data.price) * 100)
        : 0,
    );
    setCurrency(data.currency || "VND");
    setStock(data.stock);
    setStatus(data.status);
    setBrandId(data.brandId ?? "");
    setCategoryId(data.categoryId ?? "");
    setSeoTitle(data.seoTitle ?? "");
    setSeoDescription(data.seoDescription ?? "");
    setAiDescription(data.aiDescription ?? "");
    setAiTags(data.aiTags ?? []);
    setNewPrimaryImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    setNewSecondaryImages((prev) => {
      prev.forEach((img) => URL.revokeObjectURL(img.previewUrl));
      return [];
    });
    setImagesToDeleteIds([]);
    setSetPrimaryImageId(null);
    toast.success("Đã hoàn tác thay đổi.");
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

  const formatCurrency = (value: number, curr: string) => {
    if (!value || Number.isNaN(value)) return "";
    try {
      return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: curr || "VND",
        maximumFractionDigits: curr === "VND" ? 0 : 2,
      }).format(value);
    } catch {
      return `${value.toLocaleString("vi-VN")} ${curr || "VND"}`;
    }
  };

  const computedDiscountedPrice =
    price && discountPercent
      ? Math.max(0, price * (1 - discountPercent / 100))
      : null;

  const handleGenerateAi = async () => {
    if (isGeneratingAi || isSaving) return;
    if (!name.trim()) {
      toast.error("Vui lòng nhập tên sản phẩm trước khi sinh nội dung AI.");
      return;
    }
    setIsGeneratingAi(true);
    try {
      const response = await fetch("/api/admin/products/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          brandId: brandId || undefined,
          categoryId: categoryId || undefined,
          price: price || null,
          currency,
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

      if (st) setSeoTitle(st);
      if (sd) setSeoDescription(sd);
      if (ad) setAiDescription(ad);
      if (tags && tags.length > 0) {
        setAiTags((prev) => [...new Set([...prev, ...tags])]);
      }

      toast.success(
        "Đã sinh nội dung SEO và mô tả AI. Bạn có thể chỉnh sửa trước khi lưu.",
      );
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleSave = async () => {
    if (!id || isSaving) return;
    const slugPattern = /^[a-z0-9-]+$/;
    if (!slugPattern.test(slug.trim())) {
      toast.error("Slug chỉ được chứa chữ thường, số và dấu gạch ngang.");
      return;
    }
    if (!price || price <= 0) {
      toast.error("Giá sản phẩm phải lớn hơn 0.");
      return;
    }
    setIsSaving(true);
    try {
      let response: Response;

      const hasNewImages = newPrimaryImage !== null || newSecondaryImages.length > 0;
      const hasImageChanges = hasNewImages || imagesToDeleteIds.length > 0 || setPrimaryImageId !== null;

      if (hasImageChanges || hasNewImages) {
        const formData = new FormData();
        formData.append("name", name.trim());
        formData.append("slug", slug.trim());
        formData.append("description", description.trim());
        formData.append("price", String(price));
        formData.append("discountPercent", String(discountPercent || 0));
        formData.append("currency", currency);
        formData.append("stock", String(stock));
        formData.append("status", status);
        if (brandId) formData.append("brandId", brandId);
        if (categoryId) formData.append("categoryId", categoryId);
        if (seoTitle.trim()) formData.append("seoTitle", seoTitle.trim());
        if (seoDescription.trim()) {
          formData.append("seoDescription", seoDescription.trim());
        }
        if (aiDescription.trim()) {
          formData.append("aiDescription", aiDescription.trim());
        }
        if (aiTags.length > 0) {
          formData.append("aiTags", JSON.stringify(aiTags));
        }
        if (imagesToDeleteIds.length > 0) {
          formData.append(
            "imageIdsToDelete",
            JSON.stringify(imagesToDeleteIds),
          );
        }
        if (newPrimaryImage) {
          formData.append("primaryImage", newPrimaryImage.file);
        }
        newSecondaryImages.forEach((img) => {
          formData.append("secondaryImages", img.file);
        });
        if (setPrimaryImageId && !newPrimaryImage) {
          formData.append("setPrimaryImageId", setPrimaryImageId);
        }

        response = await fetch(`/api/admin/products/${id}`, {
          method: "PATCH",
          body: formData,
        });
      } else {
        response = await fetch(`/api/admin/products/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            slug: slug.trim(),
            description: description.trim(),
            price,
            discountPercent: discountPercent || 0,
            currency,
            stock,
            status,
            brandId: brandId || null,
            categoryId: categoryId || null,
            seoTitle: seoTitle.trim() || null,
            seoDescription: seoDescription.trim() || null,
            aiDescription: aiDescription.trim() || null,
            aiTags: aiTags,
            imageIdsToDelete: imagesToDeleteIds,
          }),
        });
      }

      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(json.error ?? "Không thể cập nhật sản phẩm.");
        return;
      }

      toast.success(
        hasNewImages
          ? "Đã lưu thông tin. Ảnh mới đang được tải lên ở nền."
          : "Đã lưu thông tin sản phẩm.",
      );
      router.push(backUrl);
    } catch {
      toast.error("Có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles["admin-product-new-page"]}>
        <DataLoadingOverlay
          isActive
          subtitle="Đang tải thông tin sản phẩm..."
          bottomText="Đang đồng bộ dữ liệu sản phẩm từ hệ thống..."
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles["admin-product-new-page"]}>
        <div className={styles["admin-product-new-page__content"]}>
          <p style={{ color: "var(--error)", fontSize: 14 }}>{error}</p>
          <button
            type="button"
            className={styles["admin-product-new-page__btn-discard"]}
            onClick={() => router.push(backUrl)}
          >
            Quay lại danh sách
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className={styles["admin-product-new-page"]}>
      <header className={styles["admin-product-new-page__header"]}>
        <div className={styles["admin-product-new-page__header-left"]}>
          <button
            type="button"
            className={styles["admin-product-new-page__back"]}
            onClick={() => router.push(backUrl)}
            aria-label="Quay lại"
          >
            <MdArrowBack />
          </button>
          <div>
            <nav className={styles["admin-product-new-page__breadcrumb"]}>
              <Link
                href={backUrl}
                className={styles["admin-product-new-page__breadcrumb-link"]}
              >
                Sản phẩm
              </Link>
              <span>/</span>
              <span className={styles["admin-product-new-page__breadcrumb-current"]}>
                Cập nhật sản phẩm
              </span>
            </nav>
            <h1 className={styles["admin-product-new-page__title"]}>
              Cập nhật sản phẩm
            </h1>
          </div>
        </div>
        <div className={styles["admin-product-new-page__header-actions"]}>
          <button
            type="button"
            className={styles["admin-product-new-page__btn-discard"]}
            onClick={handleDiscard}
          >
            Hoàn tác
          </button>
          <button
            type="button"
            className={styles["admin-product-new-page__btn-create"]}
            onClick={handleSave}
            disabled={isSaving}
          >
            <MdSave />
            Lưu thay đổi
          </button>
        </div>
      </header>

      <div className={styles["admin-product-new-page__content"]}>
        <div className={styles["admin-product-new-page__grid"]}>
          <div className={styles["admin-product-new-page__card"]}>
            <div className={styles["admin-product-new-page__card-header"]}>
              <h2 className={styles["admin-product-new-page__card-title"]}>
                <MdInfo className={styles["admin-product-new-page__card-title-icon"]} />
                Thông tin chung
              </h2>
            </div>
            <div className={styles["admin-product-new-page__form-grid"]}>
              <div>
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
                      aria-label="Chọn ảnh đại diện mới"
                    />
                    {(() => {
                      // New primary upload preview takes priority
                      if (newPrimaryImage) {
                        return (
                          <div className={styles["admin-product-new-page__primary-preview"]}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={newPrimaryImage.previewUrl}
                              alt="Ảnh đại diện mới"
                              className={styles["admin-product-new-page__primary-preview-img"]}
                            />
                            <button
                              type="button"
                              className={styles["admin-product-new-page__image-grid-remove"]}
                              onClick={() => {
                                URL.revokeObjectURL(newPrimaryImage.previewUrl);
                                setNewPrimaryImage(null);
                              }}
                              aria-label="Huỷ ảnh đại diện mới"
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
                        );
                      }
                      // Show effective primary: setPrimaryImageId > existing isPrimary
                      const effectivePrimary =
                        setPrimaryImageId
                          ? data.images.find(
                              (img) =>
                                img.id === setPrimaryImageId &&
                                !imagesToDeleteIds.includes(img.id),
                            )
                          : data.images.find(
                              (img) =>
                                img.isPrimary && !imagesToDeleteIds.includes(img.id),
                            );

                      if (effectivePrimary) {
                        return (
                          <div className={styles["admin-product-new-page__primary-preview"]}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={effectivePrimary.url}
                              alt={effectivePrimary.alt ?? "Ảnh đại diện"}
                              className={styles["admin-product-new-page__primary-preview-img"]}
                            />
                            <button
                              type="button"
                              className={styles["admin-product-new-page__image-grid-remove"]}
                              onClick={() =>
                                handleMarkExistingImageForDelete(effectivePrimary.id)
                              }
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
                        );
                      }

                      return (
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
                      );
                    })()}
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
                      aria-label="Thêm ảnh phụ"
                    />
                    <div className={styles["admin-product-new-page__image-grid"]}>
                      {/* Existing secondary images (not marked for delete, not the set-primary target) */}
                      {data.images
                        .filter(
                          (img) =>
                            !imagesToDeleteIds.includes(img.id) &&
                            !(img.isPrimary && !setPrimaryImageId) &&
                            img.id !== (setPrimaryImageId ?? "__none__"),
                        )
                        .map((img) => (
                          <div
                            key={img.id}
                            className={styles["admin-product-new-page__image-grid-item"]}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={img.url}
                              alt={img.alt ?? ""}
                              className={styles["admin-product-new-page__image-grid-preview"]}
                            />
                            <button
                              type="button"
                              className={styles["admin-product-new-page__image-grid-remove"]}
                              onClick={() => handleMarkExistingImageForDelete(img.id)}
                              aria-label="Xoá ảnh"
                            >
                              ×
                            </button>
                            {!newPrimaryImage && (
                              <button
                                type="button"
                                className={styles["admin-product-new-page__image-set-primary-btn"]}
                                onClick={() => handleSetAsPrimary(img.id)}
                                title="Đặt làm ảnh đại diện"
                              >
                                Đặt đại diện
                              </button>
                            )}
                          </div>
                        ))}
                      {/* If there's a current primary that got demoted (setPrimaryImageId is a different image), show it here */}
                      {setPrimaryImageId &&
                        data.images
                          .filter(
                            (img) =>
                              img.isPrimary &&
                              img.id !== setPrimaryImageId &&
                              !imagesToDeleteIds.includes(img.id),
                          )
                          .map((img) => (
                            <div
                              key={`demoted-${img.id}`}
                              className={styles["admin-product-new-page__image-grid-item"]}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={img.url}
                                alt={img.alt ?? ""}
                                className={styles["admin-product-new-page__image-grid-preview"]}
                              />
                              <button
                                type="button"
                                className={styles["admin-product-new-page__image-grid-remove"]}
                                onClick={() => handleMarkExistingImageForDelete(img.id)}
                                aria-label="Xoá ảnh"
                              >
                                ×
                              </button>
                              {!newPrimaryImage && (
                                <button
                                  type="button"
                                  className={styles["admin-product-new-page__image-set-primary-btn"]}
                                  onClick={() => handleSetAsPrimary(img.id)}
                                  title="Đặt lại làm ảnh đại diện"
                                >
                                  Đặt đại diện
                                </button>
                              )}
                            </div>
                          ))}
                      {/* New secondary image previews */}
                      {newSecondaryImages.map((img, index) => (
                        <div
                          key={`new-sec-${img.previewUrl}-${index}`}
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
                            onClick={() => handleRemoveNewSecondaryImage(index)}
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
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
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
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className={styles["admin-product-new-page__field-row"]}>
                  <div className={styles["admin-product-new-page__field"]}>
                    <label className={styles["admin-product-new-page__label"]}>
                      Thương hiệu
                    </label>
                    <select
                      className={styles["admin-product-new-page__select"]}
                      value={brandId}
                      onChange={(e) => setBrandId(e.target.value)}
                    >
                      <option value="">
                        {brandOptions.length === 0
                          ? "Không chọn thương hiệu"
                          : "Không chọn thương hiệu"}
                      </option>
                      {brandOptions.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles["admin-product-new-page__field"]}>
                    <label className={styles["admin-product-new-page__label"]}>
                      Danh mục
                    </label>
                    <select
                      className={styles["admin-product-new-page__select"]}
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                    >
                      <option value="">
                        {categoryOptions.length === 0
                          ? "Không chọn danh mục"
                          : "Không chọn danh mục"}
                      </option>
                      {categoryOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={styles["admin-product-new-page__field"]}>
                  <label className={styles["admin-product-new-page__label"]}>
                    Mô tả sản phẩm
                  </label>
                  <textarea
                    className={styles["admin-product-new-page__textarea"]}
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

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
                    className={styles["admin-product-new-page__input"]}
                    value={price}
                    onChange={(e) =>
                      setPrice(Number(e.target.value || "0"))
                    }
                  />
                  {price > 0 && (
                    <p className={styles["admin-product-new-page__char-count"]}>
                      Giá hiển thị:{" "}
                      <strong>{formatCurrency(price, currency)}</strong>
                    </p>
                  )}
                </div>
                <div className={styles["admin-product-new-page__field"]}>
                  <label className={styles["admin-product-new-page__label"]}>
                    Giảm giá (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className={styles["admin-product-new-page__input"]}
                    value={discountPercent}
                    onChange={(e) =>
                      setDiscountPercent(Number(e.target.value || "0"))
                    }
                  />
                  {computedDiscountedPrice != null && price > 0 && (
                    <p className={styles["admin-product-new-page__char-count"]}>
                      Giá sau giảm:{" "}
                      <strong>
                        {formatCurrency(computedDiscountedPrice, currency)}
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
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    <option value="VND">VND</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <div className={styles["admin-product-new-page__field"]}>
                  <label className={styles["admin-product-new-page__label"]}>
                    Tồn kho hiện tại
                  </label>
                  <input
                    type="number"
                    className={styles["admin-product-new-page__input"]}
                    value={stock}
                    onChange={(e) =>
                      setStock(Math.max(0, Number(e.target.value || "0")))
                    }
                  />
                  <div className={styles["admin-product-new-page__inventory-actions"]}>
                    <button
                      type="button"
                      className={clsx(
                        styles["admin-product-new-page__inventory-btn"],
                        styles["admin-product-new-page__inventory-btn--primary"],
                      )}
                      onClick={openImportModal}
                      disabled={isSaving}
                    >
                      <MdTrendingUp />
                      Nhập kho
                    </button>
                    <button
                      type="button"
                      className={styles["admin-product-new-page__inventory-btn"]}
                      onClick={openAdjustModal}
                      disabled={isSaving}
                    >
                      <MdInventory2 />
                      Điều chỉnh tồn kho
                    </button>
                  </div>
                </div>
              </div>

              <div className={styles["admin-product-new-page__field"]}>
                <label className={styles["admin-product-new-page__label"]}>
                  Trạng thái hiển thị
                </label>
                <select
                  className={styles["admin-product-new-page__select"]}
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as ProductStatus)
                  }
                >
                  <option value="ACTIVE">Đang hiển thị</option>
                  <option value="DRAFT">Bản nháp</option>
                  <option value="HIDDEN">Đã ẩn</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className={styles["admin-product-new-page__grid-second"]}>
          <div className={styles["admin-product-new-page__card"]}>
            <div className={styles["admin-product-new-page__card-header"]}>
              <h2 className={styles["admin-product-new-page__card-title"]}>
                <MdSearch className={styles["admin-product-new-page__card-title-icon--accent"]} />
                Cấu hình SEO
              </h2>
            </div>
            <div className={styles["admin-product-new-page__fields"]}>
              <div
                className={styles["admin-product-new-page__ai-suggestion"]}
                style={{ marginBottom: 16 }}
              >
                <p className={styles["admin-product-new-page__ai-suggestion-text"]}>
                  Thiếu Meta Title, Meta Description hoặc thẻ AI? Bấm nút bên dưới để tự sinh từ tên và mô tả sản phẩm.
                </p>
                <button
                  type="button"
                  className={styles["admin-product-new-page__btn-generate"]}
                  onClick={handleGenerateAi}
                  disabled={isGeneratingAi || isSaving}
                >
                  <MdBolt />
                  {isGeneratingAi ? "Đang sinh nội dung..." : "Sinh gợi ý bằng AI"}
                </button>
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
                    Meta Title
                  </label>
                  <span className={styles["admin-product-new-page__char-count"]}>
                    {seoTitle.length}/60
                  </span>
                </div>
                <input
                  type="text"
                  className={styles["admin-product-new-page__input"]}
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                />
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
                  rows={3}
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                />
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

          <div className={styles["admin-product-new-page__card"]}>
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
                  rows={4}
                  value={aiDescription}
                  onChange={(e) => setAiDescription(e.target.value)}
                />
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
                      className={styles["admin-product-new-page__tag-add"]}
                      onClick={handleAddTag}
                    >
                      +
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
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {showImportModal && (
          <div
            className={styles["admin-product-new-page__inventory-modal"]}
            role="dialog"
            aria-modal="true"
            aria-labelledby="inventory-import-title"
          >
            <div
              className={styles["admin-product-new-page__inventory-modal-backdrop"]}
              onClick={closeImportModal}
              onKeyDown={(e) => e.key === "Escape" && closeImportModal()}
            />
            <div className={styles["admin-product-new-page__inventory-modal-panel"]}>
              <div className={styles["admin-product-new-page__inventory-modal-header"]}>
                <h3
                  id="inventory-import-title"
                  className={styles["admin-product-new-page__inventory-modal-title"]}
                >
                  Nhập kho
                </h3>
                <button
                  type="button"
                  className={styles["admin-product-new-page__inventory-modal-close"]}
                  onClick={closeImportModal}
                  aria-label="Đóng"
                >
                  <MdClose />
                </button>
              </div>
              <div className={styles["admin-product-new-page__inventory-modal-body"]}>
                <div className={styles["admin-product-new-page__inventory-modal-field"]}>
                  <label className={styles["admin-product-new-page__inventory-modal-label"]}>
                    Số lượng nhập
                  </label>
                  <input
                    type="number"
                    min={1}
                    className={styles["admin-product-new-page__inventory-modal-input"]}
                    value={importQuantity}
                    onChange={(e) => setImportQuantity(e.target.value)}
                    placeholder="Ví dụ: 20"
                  />
                </div>
                <div className={styles["admin-product-new-page__inventory-modal-field"]}>
                  <label className={styles["admin-product-new-page__inventory-modal-label"]}>
                    Ghi chú (tuỳ chọn)
                  </label>
                  <textarea
                    className={styles["admin-product-new-page__inventory-modal-textarea"]}
                    value={importReason}
                    onChange={(e) => setImportReason(e.target.value)}
                    placeholder="Ví dụ: Nhập hàng đợt 10/2026"
                    rows={2}
                  />
                </div>
                <div className={styles["admin-product-new-page__inventory-modal-field"]}>
                  <label className={styles["admin-product-new-page__inventory-modal-label"]}>
                    Mã tham chiếu (tuỳ chọn)
                  </label>
                  <input
                    type="text"
                    className={styles["admin-product-new-page__inventory-modal-input"]}
                    value={importReferenceId}
                    onChange={(e) => setImportReferenceId(e.target.value)}
                    placeholder="Ví dụ: PO-2026-10-001, mã phiếu nhập..."
                  />
                  <p className={styles["admin-product-new-page__char-count"]}>
                    Lưu lại mã phiếu nhập hoặc chứng từ để đối chiếu trong lịch sử tồn kho.
                  </p>
                </div>
              </div>
              <div className={styles["admin-product-new-page__inventory-modal-footer"]}>
                <button
                  type="button"
                  className={clsx(
                    styles["admin-product-new-page__inventory-modal-btn"],
                    styles["admin-product-new-page__inventory-modal-btn--secondary"],
                  )}
                  onClick={closeImportModal}
                >
                  Huỷ
                </button>
                <button
                  type="button"
                  className={clsx(
                    styles["admin-product-new-page__inventory-modal-btn"],
                    styles["admin-product-new-page__inventory-modal-btn--primary"],
                  )}
                  onClick={submitImport}
                  disabled={isImporting}
                >
                  {isImporting ? "Đang xử lý..." : "Xác nhận nhập kho"}
                </button>
              </div>
            </div>
          </div>
        )}

        {showAdjustModal && (
          <div
            className={styles["admin-product-new-page__inventory-modal"]}
            role="dialog"
            aria-modal="true"
            aria-labelledby="inventory-adjust-title"
          >
            <div
              className={styles["admin-product-new-page__inventory-modal-backdrop"]}
              onClick={closeAdjustModal}
            />
            <div className={styles["admin-product-new-page__inventory-modal-panel"]}>
              <div className={styles["admin-product-new-page__inventory-modal-header"]}>
                <h3
                  id="inventory-adjust-title"
                  className={styles["admin-product-new-page__inventory-modal-title"]}
                >
                  Điều chỉnh tồn kho
                </h3>
                <button
                  type="button"
                  className={styles["admin-product-new-page__inventory-modal-close"]}
                  onClick={closeAdjustModal}
                  aria-label="Đóng"
                >
                  <MdClose />
                </button>
              </div>
              <div className={styles["admin-product-new-page__inventory-modal-body"]}>
                <p className={styles["admin-product-new-page__char-count"]} style={{ marginBottom: 12 }}>
                  Tồn kho hiện tại: <strong>{stock}</strong>
                </p>
                <div className={styles["admin-product-new-page__inventory-modal-field"]}>
                  <span className={styles["admin-product-new-page__inventory-modal-label"]}>
                    Cách điều chỉnh
                  </span>
                  <div className={styles["admin-product-new-page__inventory-modal-mode-row"]}>
                    <label className={styles["admin-product-new-page__inventory-modal-radio-wrap"]}>
                      <input
                        type="radio"
                        name="adjustMode"
                        checked={adjustMode === "decreaseBy"}
                        onChange={() => setAdjustMode("decreaseBy")}
                      />
                      Giảm theo số lượng
                    </label>
                    <label className={styles["admin-product-new-page__inventory-modal-radio-wrap"]}>
                      <input
                        type="radio"
                        name="adjustMode"
                        checked={adjustMode === "setTo"}
                        onChange={() => setAdjustMode("setTo")}
                      />
                      Đặt tồn kho tuyệt đối
                    </label>
                  </div>
                </div>
                <div className={styles["admin-product-new-page__inventory-modal-field"]}>
                  <label className={styles["admin-product-new-page__inventory-modal-label"]}>
                    {adjustMode === "decreaseBy" ? "Số lượng giảm" : "Tồn kho mới"}
                  </label>
                  <input
                    type="number"
                    min={adjustMode === "setTo" ? 0 : 1}
                    max={adjustMode === "decreaseBy" ? stock : undefined}
                    className={styles["admin-product-new-page__inventory-modal-input"]}
                    value={adjustValue}
                    onChange={(e) => setAdjustValue(e.target.value)}
                    placeholder={
                      adjustMode === "decreaseBy"
                        ? "Ví dụ: 3"
                        : "Ví dụ: 47"
                    }
                  />
                </div>
                <div className={styles["admin-product-new-page__inventory-modal-field"]}>
                  <label className={styles["admin-product-new-page__inventory-modal-label"]}>
                    Lý do (bắt buộc)
                  </label>
                  <textarea
                    className={styles["admin-product-new-page__inventory-modal-textarea"]}
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder="Ví dụ: Kiểm kê kho tháng 10, Hàng lỗi"
                    rows={2}
                  />
                </div>
                <div className={styles["admin-product-new-page__inventory-modal-field"]}>
                  <label className={styles["admin-product-new-page__inventory-modal-label"]}>
                    Mã tham chiếu (tuỳ chọn)
                  </label>
                  <input
                    type="text"
                    className={styles["admin-product-new-page__inventory-modal-input"]}
                    value={adjustReferenceId}
                    onChange={(e) => setAdjustReferenceId(e.target.value)}
                    placeholder="Ví dụ: KK-2026-10-001, mã biên bản kiểm kê..."
                  />
                  <p className={styles["admin-product-new-page__char-count"]}>
                    Mã tham chiếu sẽ được ghi lại trong lịch sử tồn kho để dễ tra cứu.
                  </p>
                </div>
              </div>
              <div className={styles["admin-product-new-page__inventory-modal-footer"]}>
                <button
                  type="button"
                  className={clsx(
                    styles["admin-product-new-page__inventory-modal-btn"],
                    styles["admin-product-new-page__inventory-modal-btn--secondary"],
                  )}
                  onClick={closeAdjustModal}
                >
                  Huỷ
                </button>
                <button
                  type="button"
                  className={clsx(
                    styles["admin-product-new-page__inventory-modal-btn"],
                    styles["admin-product-new-page__inventory-modal-btn--primary"],
                  )}
                  onClick={submitAdjust}
                  disabled={isAdjusting}
                >
                  {isAdjusting ? "Đang xử lý..." : "Xác nhận điều chỉnh"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className={styles["admin-product-new-page__inventory-log-card"]}>
          <h3 className={styles["admin-product-new-page__inventory-log-card-title"]}>
            <MdInventory2 />
            Lịch sử tồn kho
          </h3>
          <div className={styles["admin-product-new-page__inventory-log-table-wrap"]}>
            {inventoryLogsLoading ? (
              <DataLoadingOverlay
                isActive
                subtitle="Đang tải lịch sử..."
                bottomText="Đang đồng bộ dữ liệu tồn kho..."
              />
            ) : (
              <>
                <table className={styles["admin-product-new-page__inventory-log-table"]}>
                  <thead className={styles["admin-product-new-page__inventory-log-thead"]}>
                    <tr>
                      <th className={styles["admin-product-new-page__inventory-log-th"]}>
                        Thời gian
                      </th>
                      <th className={styles["admin-product-new-page__inventory-log-th"]}>
                        Thay đổi
                      </th>
                      <th className={styles["admin-product-new-page__inventory-log-th"]}>
                        Nguồn
                      </th>
                      <th className={styles["admin-product-new-page__inventory-log-th"]}>
                        Lý do
                      </th>
                    </tr>
                  </thead>
                  <tbody className={styles["admin-product-new-page__inventory-log-tbody"]}>
                    {inventoryLogs.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className={styles["admin-product-new-page__inventory-log-empty"]}
                        >
                          Chưa có lịch sử tồn kho.
                        </td>
                      </tr>
                    ) : (
                      inventoryLogs.map((log) => (
                        <tr key={log.id} className={styles["admin-product-new-page__inventory-log-tr"]}>
                          <td className={styles["admin-product-new-page__inventory-log-td"]}>
                            {new Date(log.createdAt).toLocaleString("vi-VN")}
                          </td>
                          <td className={styles["admin-product-new-page__inventory-log-td"]}>
                            <span
                              className={clsx(
                                styles["admin-product-new-page__inventory-log-change"],
                                log.change > 0
                                  ? styles["admin-product-new-page__inventory-log-change--in"]
                                  : styles["admin-product-new-page__inventory-log-change--out"],
                              )}
                            >
                              {log.change > 0 ? `+${log.change}` : log.change}
                            </span>
                          </td>
                          <td className={styles["admin-product-new-page__inventory-log-td"]}>
                            <span className={styles["admin-product-new-page__inventory-log-source"]}>
                              {inventorySourceLabel(log.source)}
                            </span>
                          </td>
                          <td className={styles["admin-product-new-page__inventory-log-td"]}>
                            {log.reason ?? "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                {inventoryLogsTotal > INVENTORY_LOG_PAGE_SIZE && (
                  <div className={styles["admin-product-new-page__inventory-log-pagination"]}>
                    <span className={styles["admin-product-new-page__inventory-log-pagination-info"]}>
                      {inventoryLogsTotal} bản ghi
                    </span>
                    <div className={styles["admin-product-new-page__inventory-log-pagination-btns"]}>
                      <button
                        type="button"
                        className={styles["admin-product-new-page__inventory-log-pagination-btn"]}
                        disabled={inventoryLogsPage <= 1}
                        onClick={() => setInventoryLogsPage((p) => Math.max(1, p - 1))}
                      >
                        Trước
                      </button>
                      <button
                        type="button"
                        className={styles["admin-product-new-page__inventory-log-pagination-btn"]}
                        disabled={
                          inventoryLogsPage >=
                          Math.ceil(inventoryLogsTotal / INVENTORY_LOG_PAGE_SIZE)
                        }
                        onClick={() =>
                          setInventoryLogsPage((p) =>
                            p + 1,
                          )
                        }
                      >
                        Sau
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminProductEditPage;

