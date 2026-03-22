"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  MdAutoAwesome,
  MdCheckBox,
  MdCheckBoxOutlineBlank,
  MdStop,
  MdArrowBack,
  MdArrowForward,
  MdRefresh,
  MdOpenInNew,
  MdDelete,
  MdFileUpload,
  MdCheckCircle,
  MdError,
} from "react-icons/md";
import { toast } from "sonner";
import styles from "./AdminAiDemoProductsPage.module.css";
import type { GeneratedDemoProduct } from "@/app/api/admin/ai/demo-products/generate/route";

type BrandOption = {
  id: string;
  name: string;
  logoUrl: string | null;
  productCount: number;
};

type CategoryOption = {
  id: string;
  name: string;
  slug: string;
  productCount: number;
};

type ComboItem = {
  brandId: string;
  brandName: string;
  categoryId: string;
  categoryName: string;
};

type ComboResult = {
  combo: ComboItem;
  status: "pending" | "processing" | "success" | "error";
  generatedCount: number;
  errorMessage?: string;
};

type GeneratedProductRow = {
  tempId: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  stock: number;
  status: "ACTIVE" | "DRAFT";
  brandId: string;
  brandName: string;
  categoryId: string;
  categoryName: string;
  aiDescription: string;
  aiTags: string[];
  seoTitle: string;
  seoDescription: string;
  selected: boolean;
  importStatus: "pending" | "importing" | "success" | "error";
  importError?: string;
};

const STEP_LABELS = ["Chọn nhãn hàng", "Chọn danh mục & cấu hình", "Sinh nháp AI", "Kiểm tra & Import"];

const AdminAiDemoProductsPage: React.FC = () => {
  const [step, setStep] = useState(0);

  // Step 0
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [isLoadingBrands, setIsLoadingBrands] = useState(true);
  const [selectedBrandIds, setSelectedBrandIds] = useState<Set<string>>(new Set());

  // Step 1
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());
  const [countPerCombo, setCountPerCombo] = useState(3);
  const [skipExisting, setSkipExisting] = useState(true);
  const [defaultStatusDraft, setDefaultStatusDraft] = useState(true);

  // Step 2 — generation only (no DB save)
  const [combos, setCombos] = useState<ComboItem[]>([]);
  const [results, setResults] = useState<ComboResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalGenerated, setTotalGenerated] = useState(0);
  const [generatedProducts, setGeneratedProducts] = useState<GeneratedProductRow[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // Step 3 — review & import
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importDone, setImportDone] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  const fetchBrands = useCallback(async () => {
    setIsLoadingBrands(true);
    try {
      const res = await fetch("/api/admin/brands?pageSize=50");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setBrands((data.data ?? []) as BrandOption[]);
    } catch {
      toast.error("Không thể tải danh sách nhãn hàng.");
    } finally {
      setIsLoadingBrands(false);
    }
  }, []);

  useEffect(() => {
    void fetchBrands();
  }, [fetchBrands]);

  const fetchCategories = useCallback(async () => {
    setIsLoadingCategories(true);
    try {
      const res = await fetch("/api/admin/categories?pageSize=50");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCategories((data.data ?? []) as CategoryOption[]);
    } catch {
      toast.error("Không thể tải danh sách danh mục.");
    } finally {
      setIsLoadingCategories(false);
    }
  }, []);

  useEffect(() => {
    if (step === 1) void fetchCategories();
  }, [step, fetchCategories]);

  const toggleBrand = (id: string) => {
    setSelectedBrandIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAllBrands = () => {
    setSelectedBrandIds(
      selectedBrandIds.size === brands.length && brands.length > 0
        ? new Set()
        : new Set(brands.map((b) => b.id)),
    );
  };

  const toggleCategory = (id: string) => {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAllCategories = () => {
    setSelectedCategoryIds(
      selectedCategoryIds.size === categories.length && categories.length > 0
        ? new Set()
        : new Set(categories.map((c) => c.id)),
    );
  };

  const goToStep1 = () => {
    if (selectedBrandIds.size === 0) {
      toast.error("Vui lòng chọn ít nhất 1 nhãn hàng.");
      return;
    }
    setStep(1);
  };

  const goToStep2 = () => {
    if (selectedCategoryIds.size === 0) {
      toast.error("Vui lòng chọn ít nhất 1 danh mục.");
      return;
    }
    const clampedCount = Math.max(1, Math.min(8, Math.round(countPerCombo)));
    setCountPerCombo(clampedCount);

    const selectedBrands = brands.filter((b) => selectedBrandIds.has(b.id));
    const selectedCategories = categories.filter((c) => selectedCategoryIds.has(c.id));

    const newCombos: ComboItem[] = [];
    for (const brand of selectedBrands) {
      for (const cat of selectedCategories) {
        newCombos.push({ brandId: brand.id, brandName: brand.name, categoryId: cat.id, categoryName: cat.name });
      }
    }

    setCombos(newCombos);
    setResults(newCombos.map((combo) => ({ combo, status: "pending", generatedCount: 0 })));
    setProgress(0);
    setTotalGenerated(0);
    setGeneratedProducts([]);
    setIsDone(false);
    setStep(2);
  };

  // Step 2: chỉ gọi AI và tích lũy sản phẩm vào state, KHÔNG lưu DB
  const handleRun = async () => {
    if (combos.length === 0) return;

    abortRef.current = new AbortController();
    setIsRunning(true);
    setIsDone(false);
    setProgress(0);
    setTotalGenerated(0);
    setGeneratedProducts([]);
    setResults(combos.map((combo) => ({ combo, status: "pending", generatedCount: 0 })));

    const productStatus = defaultStatusDraft ? "DRAFT" : "ACTIVE";
    let totalGeneratedCount = 0;

    for (let i = 0; i < combos.length; i++) {
      if (abortRef.current.signal.aborted) break;

      const combo = combos[i];

      setResults((prev) =>
        prev.map((r) =>
          r.combo.brandId === combo.brandId && r.combo.categoryId === combo.categoryId
            ? { ...r, status: "processing" }
            : r,
        ),
      );

      try {
        const generateRes = await fetch("/api/admin/ai/demo-products/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brandId: combo.brandId,
            brandName: combo.brandName,
            categoryId: combo.categoryId,
            categoryName: combo.categoryName,
            count: countPerCombo,
            status: productStatus,
          }),
          signal: abortRef.current.signal,
        });

        if (!generateRes.ok) {
          const errData = (await generateRes.json().catch(() => ({}))) as { error?: string };
          throw new Error(errData.error ?? "AI sinh thất bại");
        }

        const generateData = (await generateRes.json()) as { products: GeneratedDemoProduct[] };
        const products = generateData.products ?? [];

        if (products.length === 0) throw new Error("AI không sinh được sản phẩm");

        // Tích lũy sản phẩm vào state — chưa lưu DB
        const newRows: GeneratedProductRow[] = products.map((p, pIdx) => ({
          tempId: `${combo.brandId}-${combo.categoryId}-${pIdx}-${Math.random().toString(36).slice(2)}`,
          name: p.name,
          slug: p.slug,
          description: p.description,
          price: p.priceVnd,
          stock: 5,
          status: productStatus,
          brandId: combo.brandId,
          brandName: combo.brandName,
          categoryId: combo.categoryId,
          categoryName: combo.categoryName,
          aiDescription: p.aiDescription,
          aiTags: p.aiTags ?? [],
          seoTitle: p.seoTitle,
          seoDescription: p.seoDescription,
          selected: true,
          importStatus: "pending",
        }));

        setGeneratedProducts((prev) => [...prev, ...newRows]);
        totalGeneratedCount += newRows.length;
        setTotalGenerated(totalGeneratedCount);

        setResults((prev) =>
          prev.map((r) =>
            r.combo.brandId === combo.brandId && r.combo.categoryId === combo.categoryId
              ? { ...r, status: "success", generatedCount: newRows.length }
              : r,
          ),
        );
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") break;
        setResults((prev) =>
          prev.map((r) =>
            r.combo.brandId === combo.brandId && r.combo.categoryId === combo.categoryId
              ? { ...r, status: "error", errorMessage: err instanceof Error ? err.message : "Lỗi không xác định" }
              : r,
          ),
        );
      }

      setProgress(Math.round(((i + 1) / combos.length) * 100));

      if (i < combos.length - 1 && !abortRef.current.signal.aborted) {
        await new Promise<void>((resolve) => setTimeout(resolve, 2000));
      }
    }

    setIsRunning(false);
    setIsDone(true);
  };

  const handleStop = () => {
    if (abortRef.current) abortRef.current.abort();
    setIsRunning(false);
    toast.info("Đã dừng tiến trình sinh sản phẩm.");
  };

  // Step 3: cập nhật field của 1 row
  const handleUpdateRow = (tempId: string, field: keyof GeneratedProductRow, value: unknown) => {
    setGeneratedProducts((prev) =>
      prev.map((row) => (row.tempId === tempId ? { ...row, [field]: value } : row)),
    );
  };

  const handleDeleteRow = (tempId: string) => {
    setGeneratedProducts((prev) => prev.filter((row) => row.tempId !== tempId));
  };

  const handleToggleRow = (tempId: string) => {
    handleUpdateRow(tempId, "selected", !generatedProducts.find((r) => r.tempId === tempId)?.selected);
  };

  const handleSelectAll = () => {
    const pending = generatedProducts.filter((r) => r.importStatus === "pending");
    const allSelected = pending.every((r) => r.selected);
    setGeneratedProducts((prev) =>
      prev.map((row) =>
        row.importStatus === "pending" ? { ...row, selected: !allSelected } : row,
      ),
    );
  };

  // Step 3: import các sản phẩm đã chọn vào DB
  const handleImport = async () => {
    const toImport = generatedProducts.filter((p) => p.selected && p.importStatus === "pending");
    if (toImport.length === 0) {
      toast.error("Chưa chọn sản phẩm nào để import.");
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    setImportedCount(0);
    setImportDone(false);

    let count = 0;
    for (let i = 0; i < toImport.length; i++) {
      const product = toImport[i];

      // Đánh dấu đang import
      setGeneratedProducts((prev) =>
        prev.map((r) => (r.tempId === product.tempId ? { ...r, importStatus: "importing" } : r)),
      );

      const body = {
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        stock: product.stock,
        status: product.status,
        brandId: product.brandId,
        categoryId: product.categoryId,
        aiDescription: product.aiDescription || null,
        aiTags: product.aiTags,
        seoTitle: product.seoTitle || null,
        seoDescription: product.seoDescription || null,
      };

      let saveRes = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      // Nếu 409 slug conflict → suffix timestamp unique và thử lại
      if (saveRes.status === 409) {
        const uniqueSuffix = Date.now().toString(36);
        const newSlug = `${product.slug}-${uniqueSuffix}`;
        saveRes = await fetch("/api/admin/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, slug: newSlug }),
        });
        if (saveRes.ok) {
          setGeneratedProducts((prev) =>
            prev.map((r) => (r.tempId === product.tempId ? { ...r, slug: newSlug } : r)),
          );
        }
      }

      if (saveRes.ok) {
        count++;
        setGeneratedProducts((prev) =>
          prev.map((r) => (r.tempId === product.tempId ? { ...r, importStatus: "success" } : r)),
        );
      } else {
        const errData = (await saveRes.json().catch(() => ({}))) as { error?: string };
        setGeneratedProducts((prev) =>
          prev.map((r) =>
            r.tempId === product.tempId
              ? { ...r, importStatus: "error", importError: errData.error ?? "Lỗi không xác định" }
              : r,
          ),
        );
      }

      setImportProgress(Math.round(((i + 1) / toImport.length) * 100));
    }

    setImportedCount(count);
    setIsImporting(false);
    setImportDone(true);
    toast.success(`Đã import ${count}/${toImport.length} sản phẩm thành công.`);
  };

  const handleReset = () => {
    setStep(0);
    setSelectedBrandIds(new Set());
    setSelectedCategoryIds(new Set());
    setCountPerCombo(3);
    setSkipExisting(true);
    setDefaultStatusDraft(true);
    setCombos([]);
    setResults([]);
    setProgress(0);
    setTotalGenerated(0);
    setGeneratedProducts([]);
    setIsDone(false);
    setIsImporting(false);
    setImportProgress(0);
    setImportDone(false);
    setImportedCount(0);
  };

  const totalEstimated = selectedBrandIds.size * selectedCategoryIds.size * countPerCombo;
  const estimatedMinutes = Math.ceil((selectedBrandIds.size * selectedCategoryIds.size * 0.8) / 60);
  const successCombos = results.filter((r) => r.status === "success").length;
  const errorCombos = results.filter((r) => r.status === "error").length;

  const pendingRows = generatedProducts.filter((r) => r.importStatus === "pending");
  const selectedCount = pendingRows.filter((r) => r.selected).length;
  const allPendingSelected = pendingRows.length > 0 && pendingRows.every((r) => r.selected);
  const importErrorCount = generatedProducts.filter((r) => r.importStatus === "error").length;

  return (
    <div className={styles["admin-ai-demo-products-page"]}>
      <div className={styles["admin-ai-demo-products-page__header"]}>
        <div>
          <h1 className={styles["admin-ai-demo-products-page__title"]}>Tạo sản phẩm mẫu AI</h1>
          <p className={styles["admin-ai-demo-products-page__subtitle"]}>
            Sinh sản phẩm âm thanh thực tế bằng AI theo nhãn hàng và danh mục để demo
          </p>
        </div>
      </div>

      <nav className={styles["admin-ai-demo-products-page__subnav"]}>
        <Link href="/admin/ai" className={styles["admin-ai-demo-products-page__subnav-link"]}>Tổng quan</Link>
        <Link href="/admin/ai/sessions" className={styles["admin-ai-demo-products-page__subnav-link"]}>Lịch sử phiên</Link>
        <Link href="/admin/ai/content" className={styles["admin-ai-demo-products-page__subnav-link"]}>Nội dung AI</Link>
        <Link href="/admin/ai/settings" className={styles["admin-ai-demo-products-page__subnav-link"]}>Cài đặt</Link>
        <Link href="/admin/ai/prompts" className={styles["admin-ai-demo-products-page__subnav-link"]}>Prompt</Link>
        <Link href="/admin/ai/batch" className={styles["admin-ai-demo-products-page__subnav-link"]}>Sinh hàng loạt</Link>
        <Link href="/admin/ai/demo-products" className={`${styles["admin-ai-demo-products-page__subnav-link"]} ${styles["admin-ai-demo-products-page__subnav-link--active"]}`}>Sản phẩm mẫu</Link>
      </nav>

      {/* Stepper */}
      <div className={styles["admin-ai-demo-products-page__stepper"]}>
        {STEP_LABELS.map((label, idx) => (
          <React.Fragment key={label}>
            <div
              className={[
                styles["admin-ai-demo-products-page__step"],
                idx <= step ? styles["admin-ai-demo-products-page__step--active"] : "",
                idx < step ? styles["admin-ai-demo-products-page__step--done"] : "",
              ].join(" ")}
            >
              <div className={styles["admin-ai-demo-products-page__step-num"]}>{idx + 1}</div>
              <span className={styles["admin-ai-demo-products-page__step-label"]}>{label}</span>
            </div>
            {idx < STEP_LABELS.length - 1 && (
              <div
                className={[
                  styles["admin-ai-demo-products-page__step-line"],
                  idx < step ? styles["admin-ai-demo-products-page__step-line--done"] : "",
                ].join(" ")}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step 0: Chọn brand */}
      {step === 0 && (
        <div className={styles["admin-ai-demo-products-page__step-content"]}>
          <h2 className={styles["admin-ai-demo-products-page__step-title"]}>Chọn nhãn hàng</h2>
          <p className={styles["admin-ai-demo-products-page__step-hint"]}>
            AI sẽ sinh sản phẩm thực tế cho từng nhãn hàng bạn chọn.
          </p>

          <div className={styles["admin-ai-demo-products-page__select-row"]}>
            <button type="button" className={styles["admin-ai-demo-products-page__btn-select-all"]} onClick={toggleAllBrands}>
              {selectedBrandIds.size === brands.length && brands.length > 0 ? <MdCheckBox /> : <MdCheckBoxOutlineBlank />}
              {selectedBrandIds.size === brands.length && brands.length > 0 ? "Bỏ chọn tất cả" : "Chọn tất cả"}
            </button>
            <span className={styles["admin-ai-demo-products-page__selected-count"]}>
              Đã chọn: {selectedBrandIds.size} / {brands.length}
            </span>
          </div>

          {isLoadingBrands ? (
            <p className={styles["admin-ai-demo-products-page__loading"]}>Đang tải danh sách nhãn hàng...</p>
          ) : brands.length === 0 ? (
            <p className={styles["admin-ai-demo-products-page__empty"]}>Chưa có nhãn hàng nào trong hệ thống.</p>
          ) : (
            <div className={styles["admin-ai-demo-products-page__brand-grid"]}>
              {brands.map((brand) => {
                const selected = selectedBrandIds.has(brand.id);
                return (
                  <button
                    key={brand.id}
                    type="button"
                    className={[
                      styles["admin-ai-demo-products-page__brand-card"],
                      selected ? styles["admin-ai-demo-products-page__brand-card--selected"] : "",
                    ].join(" ")}
                    onClick={() => toggleBrand(brand.id)}
                  >
                    {brand.logoUrl ? (
                      <img src={brand.logoUrl} alt={brand.name} className={styles["admin-ai-demo-products-page__brand-logo"]} />
                    ) : (
                      <div className={styles["admin-ai-demo-products-page__brand-logo-placeholder"]}>
                        {brand.name.charAt(0)}
                      </div>
                    )}
                    <div className={styles["admin-ai-demo-products-page__brand-info"]}>
                      <div className={styles["admin-ai-demo-products-page__brand-name"]}>{brand.name}</div>
                      <div className={styles["admin-ai-demo-products-page__brand-count"]}>{brand.productCount} sản phẩm</div>
                    </div>
                    <span className={styles["admin-ai-demo-products-page__brand-check"]}>
                      {selected ? <MdCheckBox /> : <MdCheckBoxOutlineBlank />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className={styles["admin-ai-demo-products-page__step-actions"]}>
            <button type="button" className={styles["admin-ai-demo-products-page__btn-primary"]} onClick={goToStep1}>
              Tiếp theo <MdArrowForward />
            </button>
          </div>
        </div>
      )}

      {/* Step 1: Chọn category + cấu hình */}
      {step === 1 && (
        <div className={styles["admin-ai-demo-products-page__step-content"]}>
          <h2 className={styles["admin-ai-demo-products-page__step-title"]}>Chọn danh mục & cấu hình</h2>
          <p className={styles["admin-ai-demo-products-page__step-hint"]}>
            AI sẽ sinh sản phẩm cho từng bộ nhãn hàng × danh mục được chọn.
          </p>

          <div className={styles["admin-ai-demo-products-page__select-row"]}>
            <button type="button" className={styles["admin-ai-demo-products-page__btn-select-all"]} onClick={toggleAllCategories}>
              {selectedCategoryIds.size === categories.length && categories.length > 0 ? <MdCheckBox /> : <MdCheckBoxOutlineBlank />}
              {selectedCategoryIds.size === categories.length && categories.length > 0 ? "Bỏ chọn tất cả" : "Chọn tất cả"}
            </button>
            <span className={styles["admin-ai-demo-products-page__selected-count"]}>
              Đã chọn: {selectedCategoryIds.size} / {categories.length}
            </span>
          </div>

          {isLoadingCategories ? (
            <p className={styles["admin-ai-demo-products-page__loading"]}>Đang tải danh mục...</p>
          ) : (
            <div className={styles["admin-ai-demo-products-page__category-list"]}>
              {categories.map((cat) => {
                const selected = selectedCategoryIds.has(cat.id);
                return (
                  <div
                    key={cat.id}
                    className={[
                      styles["admin-ai-demo-products-page__category-row"],
                      selected ? styles["admin-ai-demo-products-page__category-row--selected"] : "",
                    ].join(" ")}
                    onClick={() => toggleCategory(cat.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && toggleCategory(cat.id)}
                  >
                    <span className={styles["admin-ai-demo-products-page__category-check"]}>
                      {selected ? <MdCheckBox /> : <MdCheckBoxOutlineBlank />}
                    </span>
                    <span className={styles["admin-ai-demo-products-page__category-name"]}>{cat.name}</span>
                    <span className={styles["admin-ai-demo-products-page__category-count"]}>{cat.productCount} SP</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className={styles["admin-ai-demo-products-page__config-section"]}>
            <h3 className={styles["admin-ai-demo-products-page__config-title"]}>Cấu hình tạo sản phẩm</h3>

            <div className={styles["admin-ai-demo-products-page__config-field"]}>
              <span>Số sản phẩm mỗi bộ (nhãn hàng × danh mục):</span>
              <input
                type="number"
                min={1}
                max={8}
                value={countPerCombo}
                onChange={(e) => setCountPerCombo(Math.max(1, Math.min(8, parseInt(e.target.value) || 1)))}
                className={styles["admin-ai-demo-products-page__count-input"]}
              />
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>(1–8)</span>
            </div>

            <div className={styles["admin-ai-demo-products-page__config-field"]}>
              <label>
                <input type="checkbox" checked={skipExisting} onChange={(e) => setSkipExisting(e.target.checked)} />
                Bỏ qua nếu nhãn hàng × danh mục đã có sản phẩm trong DB
              </label>
            </div>

            <div className={styles["admin-ai-demo-products-page__config-field"]}>
              <label>
                <input type="checkbox" checked={defaultStatusDraft} onChange={(e) => setDefaultStatusDraft(e.target.checked)} />
                Trạng thái mặc định: DRAFT (có thể đổi từng sản phẩm ở bước kiểm tra)
              </label>
            </div>
          </div>

          <div className={styles["admin-ai-demo-products-page__step-actions"]}>
            <button type="button" className={styles["admin-ai-demo-products-page__btn-secondary"]} onClick={() => setStep(0)}>
              <MdArrowBack /> Quay lại
            </button>
            <button type="button" className={styles["admin-ai-demo-products-page__btn-primary"]} onClick={goToStep2}>
              Xem trước & Chạy <MdArrowForward />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Sinh nháp AI (không lưu DB) */}
      {step === 2 && (
        <div className={styles["admin-ai-demo-products-page__step-content"]}>
          <h2 className={styles["admin-ai-demo-products-page__step-title"]}>Sinh nháp AI</h2>

          {/* Preview trước khi chạy */}
          {!isRunning && !isDone && (
            <div className={styles["admin-ai-demo-products-page__preview-section"]}>
              <div className={styles["admin-ai-demo-products-page__preview-summary"]}>
                <div className={styles["admin-ai-demo-products-page__preview-stat"]}>
                  <span className={styles["admin-ai-demo-products-page__preview-stat-label"]}>Tổng bộ combo</span>
                  <span className={styles["admin-ai-demo-products-page__preview-stat-value"]}>{combos.length}</span>
                </div>
                <div className={styles["admin-ai-demo-products-page__preview-stat"]}>
                  <span className={styles["admin-ai-demo-products-page__preview-stat-label"]}>SP ước tính</span>
                  <span className={styles["admin-ai-demo-products-page__preview-stat-value"]}>{totalEstimated}</span>
                </div>
                <div className={styles["admin-ai-demo-products-page__preview-stat"]}>
                  <span className={styles["admin-ai-demo-products-page__preview-stat-label"]}>Ước tính thời gian</span>
                  <span className={styles["admin-ai-demo-products-page__preview-stat-value"]}>~{estimatedMinutes} phút</span>
                </div>
                <div className={styles["admin-ai-demo-products-page__preview-stat"]}>
                  <span className={styles["admin-ai-demo-products-page__preview-stat-label"]}>Trạng thái mặc định</span>
                  <span className={styles["admin-ai-demo-products-page__preview-stat-value"]} style={{ fontSize: 14 }}>
                    {defaultStatusDraft ? "DRAFT" : "ACTIVE"}
                  </span>
                </div>
              </div>

              <table className={styles["admin-ai-demo-products-page__preview-table"]}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Nhãn hàng</th>
                    <th>Danh mục</th>
                    <th>Số SP</th>
                  </tr>
                </thead>
                <tbody>
                  {combos.map((combo, idx) => (
                    <tr key={`${combo.brandId}-${combo.categoryId}`}>
                      <td style={{ color: "var(--text-muted)", fontSize: 12 }}>{idx + 1}</td>
                      <td>{combo.brandName}</td>
                      <td>{combo.categoryName}</td>
                      <td style={{ fontWeight: 600 }}>{countPerCombo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Progress khi đang chạy hoặc xong */}
          {(isRunning || isDone) && (
            <div className={styles["admin-ai-demo-products-page__progress-section"]}>
              <div className={styles["admin-ai-demo-products-page__progress-header"]}>
                <span>
                  {isRunning
                    ? `Đang sinh nháp... (${progress}%)`
                    : `Sinh nháp hoàn thành — ${totalGenerated} sản phẩm`}
                </span>
                <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                  Đã sinh: {totalGenerated} sản phẩm
                </span>
              </div>
              <div className={styles["admin-ai-demo-products-page__progress-bar-wrapper"]}>
                <div className={styles["admin-ai-demo-products-page__progress-bar"]} style={{ width: `${progress}%` }} />
              </div>

              <div className={styles["admin-ai-demo-products-page__result-list"]}>
                {results.map((r) => (
                  <div
                    key={`${r.combo.brandId}-${r.combo.categoryId}`}
                    className={[
                      styles["admin-ai-demo-products-page__result-row"],
                      styles[`admin-ai-demo-products-page__result-row--${r.status}`],
                    ].join(" ")}
                  >
                    <span className={styles["admin-ai-demo-products-page__result-dot"]} />
                    <span className={styles["admin-ai-demo-products-page__result-label"]}>
                      {r.combo.brandName} × {r.combo.categoryName}
                    </span>
                    <span className={styles["admin-ai-demo-products-page__result-status"]}>
                      {r.status === "pending" && "Chờ..."}
                      {r.status === "processing" && "Đang sinh..."}
                      {r.status === "success" && `${r.generatedCount} sản phẩm`}
                      {r.status === "error" && (r.errorMessage ?? "Lỗi")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary + nút sang step 3 */}
          {isDone && (
            <div className={styles["admin-ai-demo-products-page__summary-card"]}>
              <div className={styles["admin-ai-demo-products-page__summary-stat"]}>
                <span className={styles["admin-ai-demo-products-page__summary-stat-label"]}>Tổng đã sinh</span>
                <span className={`${styles["admin-ai-demo-products-page__summary-stat-value"]} ${styles["admin-ai-demo-products-page__summary-stat-value--success"]}`}>
                  {totalGenerated}
                </span>
              </div>
              <div className={styles["admin-ai-demo-products-page__summary-stat"]}>
                <span className={styles["admin-ai-demo-products-page__summary-stat-label"]}>Combo thành công</span>
                <span className={`${styles["admin-ai-demo-products-page__summary-stat-value"]} ${styles["admin-ai-demo-products-page__summary-stat-value--success"]}`}>
                  {successCombos}
                </span>
              </div>
              {errorCombos > 0 && (
                <div className={styles["admin-ai-demo-products-page__summary-stat"]}>
                  <span className={styles["admin-ai-demo-products-page__summary-stat-label"]}>Combo lỗi</span>
                  <span className={`${styles["admin-ai-demo-products-page__summary-stat-value"]} ${styles["admin-ai-demo-products-page__summary-stat-value--error"]}`}>
                    {errorCombos}
                  </span>
                </div>
              )}
              <p className={styles["admin-ai-demo-products-page__summary-note"]}>
                Sản phẩm chưa được lưu. Chuyển sang bước tiếp theo để kiểm tra, chỉnh sửa và import.
              </p>
            </div>
          )}

          <div className={styles["admin-ai-demo-products-page__step-actions"]}>
            {!isRunning && !isDone && (
              <>
                <button type="button" className={styles["admin-ai-demo-products-page__btn-secondary"]} onClick={() => setStep(1)}>
                  <MdArrowBack /> Quay lại
                </button>
                <button type="button" className={styles["admin-ai-demo-products-page__btn-run"]} onClick={() => void handleRun()}>
                  <MdAutoAwesome /> Bắt đầu sinh {totalEstimated} sản phẩm
                </button>
              </>
            )}

            {isRunning && (
              <button type="button" className={styles["admin-ai-demo-products-page__btn-stop"]} onClick={handleStop}>
                <MdStop /> Dừng lại
              </button>
            )}

            {isDone && totalGenerated > 0 && (
              <button
                type="button"
                className={styles["admin-ai-demo-products-page__btn-primary"]}
                onClick={() => setStep(3)}
              >
                Kiểm tra & Import {totalGenerated} sản phẩm <MdArrowForward />
              </button>
            )}

            {isDone && (
              <button type="button" className={styles["admin-ai-demo-products-page__btn-secondary"]} onClick={handleReset}>
                <MdRefresh /> Làm lại
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Review table + Import */}
      {step === 3 && (
        <div className={styles["admin-ai-demo-products-page__step-content"]}>
          <h2 className={styles["admin-ai-demo-products-page__step-title"]}>Kiểm tra & Import</h2>
          <p className={styles["admin-ai-demo-products-page__step-hint"]}>
            Xem lại, chỉnh sửa thông tin sản phẩm nếu cần, sau đó bấm Import để lưu vào hệ thống.
          </p>

          {/* Toolbar */}
          <div className={styles["admin-ai-demo-products-page__review-toolbar"]}>
            <div className={styles["admin-ai-demo-products-page__review-toolbar-left"]}>
              <button
                type="button"
                className={styles["admin-ai-demo-products-page__btn-select-all"]}
                onClick={handleSelectAll}
                disabled={isImporting || pendingRows.length === 0}
              >
                {allPendingSelected ? <MdCheckBox /> : <MdCheckBoxOutlineBlank />}
                {allPendingSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
              </button>
              <span className={styles["admin-ai-demo-products-page__selected-count"]}>
                Đã chọn: {selectedCount} / {pendingRows.length} sản phẩm chưa import
              </span>
            </div>

            <div className={styles["admin-ai-demo-products-page__review-toolbar-right"]}>
              {!importDone && (
                <button
                  type="button"
                  className={styles["admin-ai-demo-products-page__btn-import"]}
                  onClick={() => void handleImport()}
                  disabled={isImporting || selectedCount === 0}
                >
                  <MdFileUpload />
                  {isImporting ? `Đang import... (${importProgress}%)` : `Import ${selectedCount} sản phẩm`}
                </button>
              )}
            </div>
          </div>

          {/* Progress bar import */}
          {isImporting && (
            <div className={styles["admin-ai-demo-products-page__progress-bar-wrapper"]} style={{ marginBottom: 0 }}>
              <div className={styles["admin-ai-demo-products-page__progress-bar"]} style={{ width: `${importProgress}%`, background: "#10b981" }} />
            </div>
          )}

          {/* Summary sau khi import */}
          {importDone && (
            <div className={styles["admin-ai-demo-products-page__summary-card"]}>
              <div className={styles["admin-ai-demo-products-page__summary-stat"]}>
                <span className={styles["admin-ai-demo-products-page__summary-stat-label"]}>Đã import thành công</span>
                <span className={`${styles["admin-ai-demo-products-page__summary-stat-value"]} ${styles["admin-ai-demo-products-page__summary-stat-value--success"]}`}>
                  {importedCount}
                </span>
              </div>
              {importErrorCount > 0 && (
                <div className={styles["admin-ai-demo-products-page__summary-stat"]}>
                  <span className={styles["admin-ai-demo-products-page__summary-stat-label"]}>Lỗi</span>
                  <span className={`${styles["admin-ai-demo-products-page__summary-stat-value"]} ${styles["admin-ai-demo-products-page__summary-stat-value--error"]}`}>
                    {importErrorCount}
                  </span>
                </div>
              )}
              <Link href="/admin/products" className={styles["admin-ai-demo-products-page__btn-link"]} style={{ marginLeft: "auto" }}>
                <MdOpenInNew /> Xem sản phẩm
              </Link>
            </div>
          )}

          {/* Bảng review */}
          <div className={styles["admin-ai-demo-products-page__review-table-wrapper"]}>
            <table className={styles["admin-ai-demo-products-page__review-table"]}>
              <thead>
                <tr>
                  <th className={styles["admin-ai-demo-products-page__review-th-check"]}></th>
                  <th className={styles["admin-ai-demo-products-page__review-th-num"]}>#</th>
                  <th>Tên sản phẩm</th>
                  <th className={styles["admin-ai-demo-products-page__review-th-price"]}>Giá (VND)</th>
                  <th className={styles["admin-ai-demo-products-page__review-th-stock"]}>Kho</th>
                  <th className={styles["admin-ai-demo-products-page__review-th-status"]}>Trạng thái</th>
                  <th className={styles["admin-ai-demo-products-page__review-th-brand"]}>Nhãn hàng</th>
                  <th className={styles["admin-ai-demo-products-page__review-th-cat"]}>Danh mục</th>
                  <th className={styles["admin-ai-demo-products-page__review-th-action"]}></th>
                </tr>
              </thead>
              <tbody>
                {generatedProducts.map((row, idx) => {
                  const isSuccess = row.importStatus === "success";
                  const isError = row.importStatus === "error";
                  const isLoading = row.importStatus === "importing";
                  const isPending = row.importStatus === "pending";
                  return (
                    <tr
                      key={row.tempId}
                      className={[
                        styles["admin-ai-demo-products-page__review-row"],
                        isSuccess ? styles["admin-ai-demo-products-page__review-row--success"] : "",
                        isError ? styles["admin-ai-demo-products-page__review-row--error"] : "",
                        isLoading ? styles["admin-ai-demo-products-page__review-row--loading"] : "",
                      ].join(" ")}
                    >
                      {/* Checkbox */}
                      <td className={styles["admin-ai-demo-products-page__review-td-check"]}>
                        {isPending ? (
                          <button
                            type="button"
                            className={styles["admin-ai-demo-products-page__review-checkbox"]}
                            onClick={() => handleToggleRow(row.tempId)}
                            disabled={isImporting}
                          >
                            {row.selected ? <MdCheckBox /> : <MdCheckBoxOutlineBlank />}
                          </button>
                        ) : isSuccess ? (
                          <MdCheckCircle className={styles["admin-ai-demo-products-page__review-icon--success"]} />
                        ) : isError ? (
                          <MdError className={styles["admin-ai-demo-products-page__review-icon--error"]} title={row.importError} />
                        ) : (
                          <span className={styles["admin-ai-demo-products-page__review-spinner"]} />
                        )}
                      </td>

                      {/* Row number */}
                      <td className={styles["admin-ai-demo-products-page__review-td-num"]}>{idx + 1}</td>

                      {/* Name */}
                      <td>
                        <input
                          type="text"
                          value={row.name}
                          onChange={(e) => handleUpdateRow(row.tempId, "name", e.target.value)}
                          disabled={!isPending || isImporting}
                          className={styles["admin-ai-demo-products-page__review-input"]}
                          placeholder="Tên sản phẩm"
                        />
                      </td>

                      {/* Price */}
                      <td>
                        <input
                          type="number"
                          value={row.price}
                          onChange={(e) => handleUpdateRow(row.tempId, "price", parseInt(e.target.value) || 0)}
                          disabled={!isPending || isImporting}
                          className={styles["admin-ai-demo-products-page__review-input-number"]}
                          min={0}
                        />
                      </td>

                      {/* Stock */}
                      <td>
                        <input
                          type="number"
                          value={row.stock}
                          onChange={(e) => handleUpdateRow(row.tempId, "stock", parseInt(e.target.value) || 0)}
                          disabled={!isPending || isImporting}
                          className={styles["admin-ai-demo-products-page__review-input-number"]}
                          min={0}
                        />
                      </td>

                      {/* Status */}
                      <td>
                        <select
                          value={row.status}
                          onChange={(e) => handleUpdateRow(row.tempId, "status", e.target.value as "ACTIVE" | "DRAFT")}
                          disabled={!isPending || isImporting}
                          className={styles["admin-ai-demo-products-page__review-select"]}
                        >
                          <option value="DRAFT">DRAFT</option>
                          <option value="ACTIVE">ACTIVE</option>
                        </select>
                      </td>

                      {/* Brand */}
                      <td>
                        <span className={styles["admin-ai-demo-products-page__review-badge"]}>{row.brandName}</span>
                      </td>

                      {/* Category */}
                      <td>
                        <span className={styles["admin-ai-demo-products-page__review-badge"]}>{row.categoryName}</span>
                      </td>

                      {/* Delete */}
                      <td>
                        {isPending && !isImporting && (
                          <button
                            type="button"
                            className={styles["admin-ai-demo-products-page__review-btn-delete"]}
                            onClick={() => handleDeleteRow(row.tempId)}
                            title="Xóa khỏi danh sách"
                          >
                            <MdDelete />
                          </button>
                        )}
                        {isError && (
                          <span className={styles["admin-ai-demo-products-page__review-error-text"]} title={row.importError}>
                            Lỗi
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {generatedProducts.length === 0 && (
            <p className={styles["admin-ai-demo-products-page__empty"]}>Không còn sản phẩm nào trong danh sách.</p>
          )}

          <div className={styles["admin-ai-demo-products-page__step-actions"]}>
            {!isImporting && !importDone && (
              <button type="button" className={styles["admin-ai-demo-products-page__btn-secondary"]} onClick={() => setStep(2)}>
                <MdArrowBack /> Quay lại
              </button>
            )}
            {importDone && (
              <button type="button" className={styles["admin-ai-demo-products-page__btn-secondary"]} onClick={handleReset}>
                <MdRefresh /> Tạo thêm
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAiDemoProductsPage;
