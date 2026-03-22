"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  MdAutoAwesome,
  MdCheckBox,
  MdCheckBoxOutlineBlank,
  MdStop,
  MdFileDownload,
  MdArrowBack,
  MdArrowForward,
} from "react-icons/md";
import { toast } from "sonner";
import styles from "./AdminAiBatchPage.module.css";

type BatchType = "products" | "brands" | "categories";

type CatalogItem = {
  id: string;
  name: string;
  aiDescription: string | null;
  aiTags: string[];
  seoTitle: string | null;
  seoDescription: string | null;
};

type BatchResultItem = {
  id: string;
  name: string;
  status: "pending" | "processing" | "success" | "error";
  message?: string;
};

type FieldKey = "aiDescription" | "aiTags" | "seoTitle" | "seoDescription";

const FIELD_LABELS: Record<FieldKey, string> = {
  aiDescription: "AI Description",
  aiTags: "AI Tags",
  seoTitle: "SEO Title",
  seoDescription: "SEO Description",
};

const BATCH_STEP_LABELS = ["Chọn loại", "Chọn mục", "Cấu hình & Chạy"];

const DELAY_OPTIONS = [
  { label: "Nhanh (500ms)", value: 500 },
  { label: "Vừa (1s)", value: 1000 },
  { label: "Chậm (2s)", value: 2000 },
];

const AdminAiBatchPage: React.FC = () => {
  const [step, setStep] = useState(0);
  const [batchType, setBatchType] = useState<BatchType>("products");
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [filterNoAi, setFilterNoAi] = useState(false);

  // Step 3
  const [selectedFields, setSelectedFields] = useState<Set<FieldKey>>(new Set(["aiDescription", "aiTags", "seoTitle", "seoDescription"]));
  const [delayMs, setDelayMs] = useState(1000);
  const [results, setResults] = useState<BatchResultItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const loadItems = useCallback(async () => {
    setIsLoadingItems(true);
    const endpointMap: Record<BatchType, string> = {
      products: "/api/admin/products",
      brands: "/api/admin/brands",
      categories: "/api/admin/categories",
    };
    const params = new URLSearchParams({ limit: "200" });
    if (filterNoAi) params.set("noAiContent", "true");
    try {
      const res = await fetch(`${endpointMap[batchType]}?${params.toString()}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const raw: CatalogItem[] = data.data ?? data.brands ?? data.categories ?? data.items ?? [];
      setItems(raw);
      setSelectedIds(new Set());
    } catch {
      toast.error("Không thể tải danh sách.");
    } finally {
      setIsLoadingItems(false);
    }
  }, [batchType, filterNoAi]);

  useEffect(() => {
    if (step === 1) {
      loadItems();
    }
  }, [step, loadItems]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  };

  const toggleField = (field: FieldKey) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      next.has(field) ? next.delete(field) : next.add(field);
      return next;
    });
  };

  const handleRun = async () => {
    const targetItems = items.filter((i) => selectedIds.has(i.id));
    if (targetItems.length === 0) {
      toast.error("Chưa chọn mục nào.");
      return;
    }
    if (selectedFields.size === 0) {
      toast.error("Chưa chọn field nào để sinh.");
      return;
    }

    abortRef.current = new AbortController();
    setIsRunning(true);
    setProgress(0);
    setResults(targetItems.map((i) => ({ id: i.id, name: i.name, status: "pending" })));

    const endpointMap: Record<BatchType, { ai: string; update: (id: string) => string; method: string }> = {
      products:   { ai: "/api/admin/products/ai",   update: (id) => `/api/admin/products/${id}`,   method: "PATCH" },
      brands:     { ai: "/api/admin/brands/ai",     update: (id) => `/api/admin/brands/${id}`,     method: "PATCH" },
      categories: { ai: "/api/admin/categories/ai", update: (id) => `/api/admin/categories/${id}`, method: "PUT"   },
    };

    for (let i = 0; i < targetItems.length; i++) {
      if (abortRef.current.signal.aborted) break;

      const item = targetItems[i];

      setResults((prev) =>
        prev.map((r) => (r.id === item.id ? { ...r, status: "processing" } : r)),
      );

      try {
        const aiRes = await fetch(endpointMap[batchType].ai, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: item.name, id: item.id }),
          signal: abortRef.current.signal,
        });
        if (!aiRes.ok) throw new Error("AI sinh thất bại");
        const aiData = await aiRes.json();
        const generated = aiData.data ?? aiData;

        const updatePayload: Record<string, unknown> = {};
        if (selectedFields.has("aiDescription") && generated.aiDescription) updatePayload.aiDescription = generated.aiDescription;
        if (selectedFields.has("aiTags") && generated.aiTags) updatePayload.aiTags = generated.aiTags;
        if (selectedFields.has("seoTitle") && generated.seoTitle) updatePayload.seoTitle = generated.seoTitle;
        if (selectedFields.has("seoDescription") && generated.seoDescription) updatePayload.seoDescription = generated.seoDescription;

        const updateRes = await fetch(endpointMap[batchType].update(item.id), {
          method: endpointMap[batchType].method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatePayload),
          signal: abortRef.current.signal,
        });
        if (!updateRes.ok) throw new Error("Lưu thất bại");

        setResults((prev) =>
          prev.map((r) => (r.id === item.id ? { ...r, status: "success" } : r)),
        );
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") break;
        setResults((prev) =>
          prev.map((r) =>
            r.id === item.id ? { ...r, status: "error", message: err instanceof Error ? err.message : "Lỗi" } : r,
          ),
        );
      }

      setProgress(Math.round(((i + 1) / targetItems.length) * 100));

      if (i < targetItems.length - 1 && !abortRef.current.signal.aborted) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    setIsRunning(false);
    const successCount = results.filter((r) => r.status === "success").length;
    toast.success(`Hoàn thành: ${successCount} thành công.`);
  };

  const handleStop = () => {
    if (abortRef.current) abortRef.current.abort();
    setIsRunning(false);
    toast.info("Đã dừng tiến trình.");
  };

  const exportCSV = () => {
    const rows = [
      ["ID", "Tên", "Trạng thái", "Ghi chú"].join(","),
      ...results.map((r) => [r.id, `"${r.name}"`, r.status, r.message ?? ""].join(",")),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `batch-ai-${batchType}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const successCount = results.filter((r) => r.status === "success").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  return (
    <div className={styles["admin-ai-batch-page"]}>
      <div className={styles["admin-ai-batch-page__header"]}>
        <div>
          <h1 className={styles["admin-ai-batch-page__title"]}>Sinh AI Nội dung Hàng loạt</h1>
          <p className={styles["admin-ai-batch-page__subtitle"]}>
            Tự động sinh AI content cho sản phẩm, thương hiệu, danh mục
          </p>
        </div>
      </div>

      <nav className={styles["admin-ai-batch-page__subnav"]}>
        <Link href="/admin/ai" className={styles["admin-ai-batch-page__subnav-link"]}>Tổng quan</Link>
        <Link href="/admin/ai/sessions" className={styles["admin-ai-batch-page__subnav-link"]}>Lịch sử phiên</Link>
        <Link href="/admin/ai/content" className={styles["admin-ai-batch-page__subnav-link"]}>Nội dung AI</Link>
        <Link href="/admin/ai/settings" className={styles["admin-ai-batch-page__subnav-link"]}>Cài đặt</Link>
        <Link href="/admin/ai/prompts" className={styles["admin-ai-batch-page__subnav-link"]}>Prompt</Link>
        <Link href="/admin/ai/batch" className={`${styles["admin-ai-batch-page__subnav-link"]} ${styles["admin-ai-batch-page__subnav-link--active"]}`}>Sinh hàng loạt</Link>
        <Link href="/admin/ai/demo-products" className={styles["admin-ai-batch-page__subnav-link"]}>Sản phẩm mẫu</Link>
      </nav>

      {/* Stepper */}
      <div className={styles["admin-ai-batch-page__stepper"]}>
        {BATCH_STEP_LABELS.map((label, idx) => (
          <React.Fragment key={label}>
            <div className={`${styles["admin-ai-batch-page__step"]} ${idx <= step ? styles["admin-ai-batch-page__step--active"] : ""} ${idx < step ? styles["admin-ai-batch-page__step--done"] : ""}`}>
              <div className={styles["admin-ai-batch-page__step-num"]}>{idx + 1}</div>
              <span className={styles["admin-ai-batch-page__step-label"]}>{label}</span>
            </div>
            {idx < BATCH_STEP_LABELS.length - 1 && (
              <div className={`${styles["admin-ai-batch-page__step-line"]} ${idx < step ? styles["admin-ai-batch-page__step-line--done"] : ""}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step 0: Chọn loại */}
      {step === 0 && (
        <div className={styles["admin-ai-batch-page__step-content"]}>
          <h2 className={styles["admin-ai-batch-page__step-title"]}>Chọn loại nội dung</h2>
          <div className={styles["admin-ai-batch-page__type-grid"]}>
            {(["products", "brands", "categories"] as BatchType[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`${styles["admin-ai-batch-page__type-card"]} ${batchType === t ? styles["admin-ai-batch-page__type-card--active"] : ""}`}
                onClick={() => setBatchType(t)}
              >
                <span className={styles["admin-ai-batch-page__type-icon"]}>
                  {{ products: "📦", brands: "🏷️", categories: "📁" }[t]}
                </span>
                <span>{{ products: "Sản phẩm", brands: "Thương hiệu", categories: "Danh mục" }[t]}</span>
              </button>
            ))}
          </div>
          <div className={styles["admin-ai-batch-page__step-actions"]}>
            <button type="button" className={styles["admin-ai-batch-page__btn-primary"]} onClick={() => setStep(1)}>
              Tiếp theo <MdArrowForward />
            </button>
          </div>
        </div>
      )}

      {/* Step 1: Chọn mục */}
      {step === 1 && (
        <div className={styles["admin-ai-batch-page__step-content"]}>
          <div className={styles["admin-ai-batch-page__step1-header"]}>
            <h2 className={styles["admin-ai-batch-page__step-title"]}>
              Chọn {{ products: "sản phẩm", brands: "thương hiệu", categories: "danh mục" }[batchType]}
            </h2>
            <label className={styles["admin-ai-batch-page__filter-label"]}>
              <input
                type="checkbox"
                checked={filterNoAi}
                onChange={(e) => setFilterNoAi(e.target.checked)}
              />
              Chỉ hiện mục chưa có AI content
            </label>
          </div>

          {isLoadingItems ? (
            <div className={styles["admin-ai-batch-page__loading"]}>Đang tải...</div>
          ) : (
            <>
              <div className={styles["admin-ai-batch-page__select-all-row"]}>
                <button type="button" className={styles["admin-ai-batch-page__btn-select-all"]} onClick={toggleAll}>
                  {selectedIds.size === items.length ? <MdCheckBox /> : <MdCheckBoxOutlineBlank />}
                  {selectedIds.size === items.length ? "Bỏ chọn tất cả" : `Chọn tất cả (${items.length})`}
                </button>
                <span className={styles["admin-ai-batch-page__selected-count"]}>
                  Đã chọn: <strong>{selectedIds.size}</strong>
                </span>
              </div>

              <div className={styles["admin-ai-batch-page__item-list"]}>
                {items.map((item) => {
                  const hasAll = !!(item.aiDescription && item.aiTags.length && item.seoTitle && item.seoDescription);
                  return (
                    <div
                      key={item.id}
                      className={`${styles["admin-ai-batch-page__item-row"]} ${selectedIds.has(item.id) ? styles["admin-ai-batch-page__item-row--selected"] : ""}`}
                      onClick={() => toggleSelect(item.id)}
                    >
                      <div className={styles["admin-ai-batch-page__item-check"]}>
                        {selectedIds.has(item.id) ? <MdCheckBox /> : <MdCheckBoxOutlineBlank />}
                      </div>
                      <div className={styles["admin-ai-batch-page__item-name"]}>{item.name}</div>
                      <div className={styles["admin-ai-batch-page__item-status"]}>
                        {hasAll ? (
                          <span className={styles["admin-ai-batch-page__badge-ok"]}>Đủ AI</span>
                        ) : (
                          <span className={styles["admin-ai-batch-page__badge-missing"]}>Thiếu</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {items.length === 0 && (
                  <div className={styles["admin-ai-batch-page__empty"]}>Không có mục nào.</div>
                )}
              </div>
            </>
          )}

          <div className={styles["admin-ai-batch-page__step-actions"]}>
            <button type="button" className={styles["admin-ai-batch-page__btn-secondary"]} onClick={() => setStep(0)}>
              <MdArrowBack /> Quay lại
            </button>
            <button
              type="button"
              className={styles["admin-ai-batch-page__btn-primary"]}
              onClick={() => {
                if (selectedIds.size === 0) { toast.error("Chưa chọn mục nào."); return; }
                setStep(2);
                setResults([]);
                setProgress(0);
              }}
            >
              Tiếp theo ({selectedIds.size} mục) <MdArrowForward />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Cấu hình & Chạy */}
      {step === 2 && (
        <div className={styles["admin-ai-batch-page__step-content"]}>
          <h2 className={styles["admin-ai-batch-page__step-title"]}>Cấu hình & Chạy</h2>

          <div className={styles["admin-ai-batch-page__config-row"]}>
            <div className={styles["admin-ai-batch-page__config-section"]}>
              <h3 className={styles["admin-ai-batch-page__config-title"]}>Fields cần sinh</h3>
              <div className={styles["admin-ai-batch-page__fields-grid"]}>
                {(Object.keys(FIELD_LABELS) as FieldKey[]).map((field) => (
                  <label key={field} className={styles["admin-ai-batch-page__field-label"]}>
                    <input
                      type="checkbox"
                      checked={selectedFields.has(field)}
                      onChange={() => toggleField(field)}
                    />
                    {FIELD_LABELS[field]}
                  </label>
                ))}
              </div>
            </div>
            <div className={styles["admin-ai-batch-page__config-section"]}>
              <h3 className={styles["admin-ai-batch-page__config-title"]}>Tốc độ xử lý</h3>
              <div className={styles["admin-ai-batch-page__delay-group"]}>
                {DELAY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`${styles["admin-ai-batch-page__delay-btn"]} ${delayMs === opt.value ? styles["admin-ai-batch-page__delay-btn--active"] : ""}`}
                    onClick={() => setDelayMs(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className={styles["admin-ai-batch-page__config-hint"]}>
                Delay giữa các mục để tránh rate limit Groq API.
              </p>
            </div>
          </div>

          {/* Progress */}
          {results.length > 0 && (
            <div className={styles["admin-ai-batch-page__progress-section"]}>
              <div className={styles["admin-ai-batch-page__progress-header"]}>
                <span>Tiến độ: {progress}% ({successCount} thành công, {errorCount} lỗi)</span>
                {results.filter((r) => r.status !== "pending").length > 0 && (
                  <button
                    type="button"
                    className={styles["admin-ai-batch-page__btn-export"]}
                    onClick={exportCSV}
                  >
                    <MdFileDownload /> Xuất CSV
                  </button>
                )}
              </div>
              <div className={styles["admin-ai-batch-page__progress-bar-wrapper"]}>
                <div
                  className={styles["admin-ai-batch-page__progress-bar"]}
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className={styles["admin-ai-batch-page__results-list"]}>
                {results.map((r) => (
                  <div key={r.id} className={`${styles["admin-ai-batch-page__result-row"]} ${styles[`admin-ai-batch-page__result-row--${r.status}`]}`}>
                    <div className={styles["admin-ai-batch-page__result-dot"]} />
                    <span className={styles["admin-ai-batch-page__result-name"]}>{r.name}</span>
                    <span className={styles["admin-ai-batch-page__result-status"]}>
                      {{ pending: "Chờ", processing: "Đang xử lý...", success: "Thành công", error: r.message ?? "Lỗi" }[r.status]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={styles["admin-ai-batch-page__step-actions"]}>
            {!isRunning ? (
              <>
                <button type="button" className={styles["admin-ai-batch-page__btn-secondary"]} onClick={() => setStep(1)}>
                  <MdArrowBack /> Quay lại
                </button>
                <button
                  type="button"
                  className={styles["admin-ai-batch-page__btn-run"]}
                  onClick={handleRun}
                >
                  <MdAutoAwesome /> Bắt đầu sinh ({selectedIds.size} mục)
                </button>
              </>
            ) : (
              <button type="button" className={styles["admin-ai-batch-page__btn-stop"]} onClick={handleStop}>
                <MdStop /> Dừng
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAiBatchPage;
