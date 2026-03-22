"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MdAddCircleOutline,
  MdCheckCircleOutline,
  MdClose,
  MdErrorOutline,
  MdFilterList,
  MdImage,
  MdInventory2,
  MdRemoveCircleOutline,
  MdSearch,
  MdVisibility,
  MdWarningAmber,
} from "react-icons/md";
import clsx from "clsx";
import { toast } from "sonner";
import DataLoadingOverlay from "@/components/shared/DataLoadingOverlay";
import styles from "./AdminInventoryDashboardPage.module.css";

type StockStatusFilter = "all" | "out" | "low" | "ok";

type LogSourceFilter =
  | "all"
  | "ADMIN_CREATE_PRODUCT"
  | "ADMIN_STOCK_IMPORT"
  | "ADMIN_STOCK_ADJUST"
  | "ORDER_PLACED"
  | "ORDER_CANCELLED";

type InventoryModalProduct = {
  id: string;
  name: string;
  currentStock: number;
};

type InventoryListItem = {
  id: string;
  name: string;
  slug: string;
  brandName?: string | null;
  categoryName?: string | null;
  stock: number;
  primaryImageUrl?: string | null;
};

type InventoryListResponse = {
  data: InventoryListItem[];
  total: number;
  page: number;
  pageSize: number;
};

type InventorySummary = {
  totalProducts: number;
  outOfStock: number;
  lowStock: number;
  okStock: number;
};

type InventoryLogListItem = {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  change: number;
  reason: string | null;
  source: string | null;
  referenceId: string | null;
  createdAt: string;
};

type InventoryLogListResponse = {
  data: InventoryLogListItem[];
  total: number;
  page: number;
  pageSize: number;
};

const PAGE_SIZE = 10;
const LOGS_PAGE_SIZE = 10;

const AdminInventoryDashboardPage: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialPageParam = searchParams?.get("page");
  const initialPage = initialPageParam ? Number(initialPageParam) || 1 : 1;
  const initialSearch = searchParams?.get("search") ?? "";
  const initialStockStatus =
    (searchParams?.get("stockStatus") as StockStatusFilter | null) ?? "all";

  const [searchInput, setSearchInput] = useState(initialSearch);
  const [stockStatusInput, setStockStatusInput] =
    useState<StockStatusFilter>(initialStockStatus || "all");

  const [search, setSearch] = useState(initialSearch);
  const [stockStatus, setStockStatus] =
    useState<StockStatusFilter>(initialStockStatus || "all");
  const [page, setPage] = useState(initialPage);

  const [items, setItems] = useState<InventoryListItem[]>([]);
  const [total, setTotal] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"products" | "logs">("products");

  const [logSearchInput, setLogSearchInput] = useState("");
  const [logSearch, setLogSearch] = useState("");
  const [logSourceFilter, setLogSourceFilter] =
    useState<LogSourceFilter>("all");
  const [logPage, setLogPage] = useState(1);
  const [logItems, setLogItems] = useState<InventoryLogListItem[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const [showLogsLoadingOverlay, setShowLogsLoadingOverlay] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);

  const [importModalProduct, setImportModalProduct] =
    useState<InventoryModalProduct | null>(null);
  const [importQuantity, setImportQuantity] = useState("");
  const [importReason, setImportReason] = useState("");
  const [importReferenceId, setImportReferenceId] = useState("");

  const [adjustModalProduct, setAdjustModalProduct] =
    useState<InventoryModalProduct | null>(null);
  const [adjustMode, setAdjustMode] = useState<"decreaseBy" | "setTo">(
    "decreaseBy",
  );
  const [adjustValue, setAdjustValue] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustReferenceId, setAdjustReferenceId] = useState("");

  const [isImportSubmitting, setIsImportSubmitting] = useState(false);
  const [isAdjustSubmitting, setIsAdjustSubmitting] = useState(false);

  const getStockBucket = (stock: number): "out" | "low" | "ok" => {
    if (stock === 0) return "out";
    if (stock > 0 && stock <= 3) return "low";
    return "ok";
  };

  const applyStockChangeToSummary = (
    prev: InventorySummary | null,
    previousStock: number,
    newStock: number,
  ): InventorySummary | null => {
    if (!prev) return prev;

    const prevBucket = getStockBucket(previousStock);
    const nextBucket = getStockBucket(newStock);

    if (prevBucket === nextBucket) {
      return { ...prev };
    }

    const updated: InventorySummary = { ...prev };

    if (prevBucket === "out") {
      updated.outOfStock = Math.max(0, updated.outOfStock - 1);
    } else if (prevBucket === "low") {
      updated.lowStock = Math.max(0, updated.lowStock - 1);
    } else if (prevBucket === "ok") {
      updated.okStock = Math.max(0, updated.okStock - 1);
    }

    if (nextBucket === "out") {
      updated.outOfStock += 1;
    } else if (nextBucket === "low") {
      updated.lowStock += 1;
    } else if (nextBucket === "ok") {
      updated.okStock += 1;
    }

    return updated;
  };

  const fetchInventory = async (controller?: AbortController) => {
    setIsLoading(true);
    setError(null);
    setShowLoadingOverlay(true);
    const startedAt = performance.now();

    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      if (search.trim()) params.set("search", search.trim());
      if (stockStatus && stockStatus !== "all") {
        params.set("stockStatus", stockStatus);
      }

      const response = await fetch(`/api/admin/products?${params.toString()}`, {
        signal: controller?.signal,
      });

      if (!response.ok) {
        if (response.status === 404) {
          setItems([]);
          setTotal(0);
          return;
        }
        throw new Error("Không thể tải danh sách kho hàng.");
      }

      const json = (await response.json()) as InventoryListResponse;
      setItems(json.data);
      setTotal(json.total);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError("Đã xảy ra lỗi khi tải danh sách kho hàng.");
    } finally {
      const elapsed = performance.now() - startedAt;
      const minimum = 1100;
      const remaining = minimum - elapsed;
      const done = () => {
        setIsLoading(false);
        setShowLoadingOverlay(false);
      };
      if (remaining > 0) setTimeout(done, remaining);
      else done();
    }
  };

  const fetchSummary = async () => {
    setIsSummaryLoading(true);
    setSummaryError(null);
    try {
      const res = await fetch("/api/admin/inventory/summary");
      if (!res.ok) {
        throw new Error("Không thể tải thống kê kho hàng.");
      }
      const json = (await res.json()) as { data?: InventorySummary };
      setSummary(json.data ?? null);
    } catch (err) {
      console.error(err);
      setSummaryError("Không thể tải thống kê kho hàng.");
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const fetchLogs = async (controller?: AbortController) => {
    setIsLogsLoading(true);
    setLogsError(null);
    setShowLogsLoadingOverlay(true);
    const startedAt = performance.now();

    try {
      const params = new URLSearchParams();
      params.set("page", String(logPage));
      params.set("pageSize", String(LOGS_PAGE_SIZE));
      if (logSearch.trim()) params.set("search", logSearch.trim());
      if (logSourceFilter && logSourceFilter !== "all") {
        params.set("source", logSourceFilter);
      }

      const res = await fetch(
        `/api/admin/inventory/logs?${params.toString()}`,
        {
          signal: controller?.signal,
        },
      );

      if (!res.ok) {
        throw new Error("Không thể tải lịch sử tồn kho.");
      }

      const json = (await res.json()) as InventoryLogListResponse;
      setLogItems(json.data);
      setLogTotal(json.total);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error(err);
      setLogsError("Đã xảy ra lỗi khi tải lịch sử tồn kho.");
    } finally {
      const elapsed = performance.now() - startedAt;
      const minimum = 1100;
      const remaining = minimum - elapsed;
      const done = () => {
        setIsLogsLoading(false);
        setShowLogsLoadingOverlay(false);
      };
      if (remaining > 0) setTimeout(done, remaining);
      else done();
    }
  };

  useEffect(() => {
    const ctrl = new AbortController();
    void fetchInventory(ctrl);
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ refetch khi page/search/stockStatus đổi
  }, [page, search, stockStatus]);

  useEffect(() => {
    void fetchSummary();
  }, []);

  useEffect(() => {
    if (activeTab !== "logs") return;
    const ctrl = new AbortController();
    void fetchLogs(ctrl);
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ refetch khi logPage/logSearch đổi khi tab logs đang active
  }, [activeTab, logPage, logSearch, logSourceFilter]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = total === 0 ? 0 : Math.min(page * PAGE_SIZE, total);
  const logsTotalPages = Math.max(
    1,
    Math.ceil(logTotal / LOGS_PAGE_SIZE || 1),
  );
  const logsFrom = logTotal === 0 ? 0 : (logPage - 1) * LOGS_PAGE_SIZE + 1;
  const logsTo =
    logTotal === 0 ? 0 : Math.min(logPage * LOGS_PAGE_SIZE, logTotal);

  const handleApplyFilters = () => {
    const nextSearch = searchInput.trim();
    const nextStockStatus = stockStatusInput || "all";

    setSearch(nextSearch);
    setStockStatus(nextStockStatus);

    const nextPage = 1;
    setPage(nextPage);

    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    params.set("pageSize", String(PAGE_SIZE));
    if (nextSearch) params.set("search", nextSearch);
    if (nextStockStatus !== "all") params.set("stockStatus", nextStockStatus);
    router.push(`/admin/inventory?${params.toString()}`);
  };

  const handleResetFilters = () => {
    setSearchInput("");
    setStockStatusInput("all");
    setSearch("");
    setStockStatus("all");

    const nextPage = 1;
    setPage(nextPage);
    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    params.set("pageSize", String(PAGE_SIZE));
    router.push(`/admin/inventory?${params.toString()}`);
  };

  const handleLogsApplySearch = () => {
    const next = logSearchInput.trim();
    setLogSearch(next);
    setLogPage(1);
  };

  const handleLogsReset = () => {
    setLogSearchInput("");
    setLogSearch("");
    setLogSourceFilter("all");
    setLogPage(1);
  };

  const handlePageChange = (p: number) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
    const params = new URLSearchParams();
    params.set("page", String(p));
    params.set("pageSize", String(PAGE_SIZE));
    if (search.trim()) params.set("search", search.trim());
    if (stockStatus && stockStatus !== "all") {
      params.set("stockStatus", stockStatus);
    }
    router.push(`/admin/inventory?${params.toString()}`);
  };

  const handleLogsPageChange = (p: number) => {
    if (p < 1 || p > logsTotalPages) return;
    setLogPage(p);
  };

  const goToProductDetail = (productId: string) => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    if (search.trim()) params.set("search", search.trim());
    if (stockStatus && stockStatus !== "all") {
      params.set("stockStatus", stockStatus);
    }
    const query = params.toString();
    router.push(`/admin/products/${productId}${query ? `?${query}` : ""}`);
  };

  const generateReferenceId = (prefix: string) => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const h = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    const s = String(now.getSeconds()).padStart(2, "0");
    const r = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${prefix}-${y}${m}${d}-${h}${min}${s}-${r}`;
  };

  const openImportModal = (product: InventoryModalProduct) => {
    setImportModalProduct(product);
    setImportQuantity("");
    setImportReason("");
    setImportReferenceId("");
  };

  const closeImportModal = () => setImportModalProduct(null);

  const submitImport = async () => {
    if (!importModalProduct) return;
    const q = Math.trunc(Number(importQuantity) || 0);
    if (!q || q <= 0) {
      toast.error("Số lượng nhập kho phải là số nguyên dương.");
      return;
    }
    if (isImportSubmitting) return;
    setIsImportSubmitting(true);
    try {
      const res = await fetch(
        `/api/admin/products/${importModalProduct.id}/inventory/import`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quantity: q,
            reason: importReason.trim() || undefined,
            referenceId: importReferenceId.trim() || undefined,
          }),
        },
      );
      const json = (await res.json()) as {
        error?: string;
        data?: { previousStock: number; newStock: number };
      };
      if (!res.ok) {
        toast.error(json.error ?? "Không thể nhập kho.");
        return;
      }
      const previousStock =
        json.data?.previousStock ?? importModalProduct.currentStock;
      const newStock =
        json.data?.newStock ?? previousStock + q;
      toast.success(`Đã nhập thêm ${q} đơn vị vào kho.`);
      closeImportModal();
      setItems((prev) =>
        prev.map((p) =>
          p.id === importModalProduct.id
            ? { ...p, stock: newStock }
            : p,
        ),
      );
      setSummary((prev) =>
        applyStockChangeToSummary(prev, previousStock, newStock),
      );
    } finally {
      setIsImportSubmitting(false);
    }
  };

  const openAdjustModal = (product: InventoryModalProduct) => {
    setAdjustModalProduct(product);
    setAdjustMode("decreaseBy");
    setAdjustValue("");
    setAdjustReason("");
    setAdjustReferenceId("");
  };

  const closeAdjustModal = () => setAdjustModalProduct(null);

  const submitAdjust = async () => {
    if (!adjustModalProduct) return;
    const reasonTrim = adjustReason.trim();
    if (!reasonTrim) {
      toast.error("Lý do điều chỉnh tồn kho là bắt buộc.");
      return;
    }
    const num = Math.trunc(Number(adjustValue) || 0);
    const { currentStock } = adjustModalProduct;
    if (adjustMode === "decreaseBy" && (num <= 0 || num > currentStock)) {
      toast.error(
        "Số lượng giảm phải là số nguyên dương và không vượt quá tồn kho hiện tại.",
      );
      return;
    }
    if (adjustMode === "setTo" && num < 0) {
      toast.error("Tồn kho mới không được âm.");
      return;
    }
    if (isAdjustSubmitting) return;
    setIsAdjustSubmitting(true);
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
      const res = await fetch(
        `/api/admin/products/${adjustModalProduct.id}/inventory/adjust`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const json = (await res.json()) as {
        error?: string;
        data?: { previousStock: number; newStock: number };
      };
      if (!res.ok) {
        toast.error(json.error ?? "Không thể điều chỉnh tồn kho.");
        return;
      }
      const previousStock =
        json.data?.previousStock ?? currentStock;
      const newStock = json.data?.newStock ?? previousStock;
      toast.success(
        previousStock !== newStock
          ? `Đã điều chỉnh tồn kho từ ${previousStock} xuống ${newStock}.`
          : "Tồn kho không thay đổi.",
      );
      closeAdjustModal();
      setItems((prev) =>
        prev.map((p) =>
          p.id === adjustModalProduct.id ? { ...p, stock: newStock } : p,
        ),
      );
      setSummary((prev) =>
        applyStockChangeToSummary(prev, previousStock, newStock),
      );
    } finally {
      setIsAdjustSubmitting(false);
    }
  };

  const stockBadge = (stock: number) => {
    if (stock === 0) {
      return (
        <span
          className={clsx(
            styles["admin-inventory-page__stock-badge"],
            styles["admin-inventory-page__stock-badge--out"],
          )}
        >
          Hết hàng
        </span>
      );
    }
    if (stock > 0 && stock <= 3) {
      return (
        <span
          className={clsx(
            styles["admin-inventory-page__stock-badge"],
            styles["admin-inventory-page__stock-badge--low"],
          )}
        >
          Sắp hết
        </span>
      );
    }
    return (
      <span
        className={clsx(
          styles["admin-inventory-page__stock-badge"],
          styles["admin-inventory-page__stock-badge--ok"],
        )}
      >
        Còn hàng
      </span>
    );
  };

  return (
    <div className={styles["admin-inventory-page"]}>
      <header className={styles["admin-inventory-page__header"]}>
        <div className={styles["admin-inventory-page__header-inner"]}>
          <h1 className={styles["admin-inventory-page__header-title"]}>
            Quản lý kho hàng
          </h1>
          <p className={styles["admin-inventory-page__header-subtitle"]}>
            Theo dõi tồn kho sản phẩm, nhập hàng và báo cáo trạng thái kho.
          </p>
        </div>
        <div className={styles["admin-inventory-page__header-actions"]}>
          {/* Dự phòng cho nút báo cáo hoặc export sau này */}
        </div>
      </header>

      <main className={styles["admin-inventory-page__content"]}>
        <section className={styles["admin-inventory-page__tabs"]}>
          <button
            type="button"
            className={clsx(
              styles["admin-inventory-page__tab"],
              activeTab === "products" &&
                styles["admin-inventory-page__tab--active"],
            )}
            onClick={() => setActiveTab("products")}
          >
            Sản phẩm theo tồn kho
          </button>
          <button
            type="button"
            className={clsx(
              styles["admin-inventory-page__tab"],
              activeTab === "logs" &&
                styles["admin-inventory-page__tab--active"],
            )}
            onClick={() => setActiveTab("logs")}
          >
            Lịch sử nhập / xuất kho
          </button>
        </section>

        <section className={styles["admin-inventory-page__stats"]}>
          <div
            className={clsx(
              styles["admin-inventory-page__stat-card"],
              styles["admin-inventory-page__stat-card--total"],
            )}
          >
            <div className={styles["admin-inventory-page__stat-top"]}>
              <div className={styles["admin-inventory-page__stat-inner"]}>
                <span className={styles["admin-inventory-page__stat-label"]}>
                  Tổng sản phẩm trong kho
                </span>
                <span className={styles["admin-inventory-page__stat-value"]}>
                  {summary?.totalProducts ??
                    (isSummaryLoading ? "..." : "0")}
                </span>
              </div>
              <div className={styles["admin-inventory-page__stat-icon"]}>
                <MdInventory2 />
              </div>
            </div>
          </div>
          <div
            className={clsx(
              styles["admin-inventory-page__stat-card"],
              styles["admin-inventory-page__stat-card--out"],
            )}
          >
            <div className={styles["admin-inventory-page__stat-top"]}>
              <div className={styles["admin-inventory-page__stat-inner"]}>
                <span className={styles["admin-inventory-page__stat-label"]}>
                  Sản phẩm hết hàng
                </span>
                <span className={styles["admin-inventory-page__stat-value"]}>
                  {summary?.outOfStock ??
                    (isSummaryLoading ? "..." : "0")}
                </span>
              </div>
              <div className={styles["admin-inventory-page__stat-icon"]}>
                <MdErrorOutline />
              </div>
            </div>
          </div>
          <div
            className={clsx(
              styles["admin-inventory-page__stat-card"],
              styles["admin-inventory-page__stat-card--low"],
            )}
          >
            <div className={styles["admin-inventory-page__stat-top"]}>
              <div className={styles["admin-inventory-page__stat-inner"]}>
                <span className={styles["admin-inventory-page__stat-label"]}>
                  Sản phẩm sắp hết (≤ 3)
                </span>
                <span className={styles["admin-inventory-page__stat-value"]}>
                  {summary?.lowStock ??
                    (isSummaryLoading ? "..." : "0")}
                </span>
              </div>
              <div className={styles["admin-inventory-page__stat-icon"]}>
                <MdWarningAmber />
              </div>
            </div>
          </div>
          <div
            className={clsx(
              styles["admin-inventory-page__stat-card"],
              styles["admin-inventory-page__stat-card--ok"],
            )}
          >
            <div className={styles["admin-inventory-page__stat-top"]}>
              <div className={styles["admin-inventory-page__stat-inner"]}>
                <span className={styles["admin-inventory-page__stat-label"]}>
                  Sản phẩm còn hàng tốt (&gt; 3)
                </span>
                <span className={styles["admin-inventory-page__stat-value"]}>
                  {summary?.okStock ?? (isSummaryLoading ? "..." : "0")}
                </span>
              </div>
              <div className={styles["admin-inventory-page__stat-icon"]}>
                <MdCheckCircleOutline />
              </div>
            </div>
          </div>
        </section>

        {summaryError && (
          <p className={styles["admin-inventory-page__stats-error"]}>
            {summaryError}
          </p>
        )}

        {activeTab === "products" && (
          <>
            <section className={styles["admin-inventory-page__filter-card"]}>
          <div className={styles["admin-inventory-page__filter-left"]}>
            <div className={styles["admin-inventory-page__search-wrapper"]}>
              <MdSearch
                className={styles["admin-inventory-page__search-icon"]}
              />
              <input
                type="text"
                className={styles["admin-inventory-page__search-input"]}
                placeholder="Tìm theo tên sản phẩm hoặc slug..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <select
              className={styles["admin-inventory-page__select"]}
              value={stockStatusInput}
              onChange={(e) =>
                setStockStatusInput(e.target.value as StockStatusFilter)
              }
            >
              <option value="all">Tất cả tồn kho</option>
              <option value="out">Hết hàng</option>
              <option value="low">Sắp hết (≤ 3)</option>
              <option value="ok">Còn nhiều (&gt; 3)</option>
            </select>
          </div>
          <div className={styles["admin-inventory-page__filter-right"]}>
            <button
              type="button"
              className={styles["admin-inventory-page__filter-button"]}
              onClick={handleApplyFilters}
            >
              <MdFilterList />
              Lọc
            </button>
            <button
              type="button"
              className={styles["admin-inventory-page__filter-button"]}
              onClick={handleResetFilters}
            >
              Đặt lại
            </button>
          </div>
            </section>

            <section className={styles["admin-inventory-page__table-card"]}>
          <div className={styles["admin-inventory-page__table-wrapper"]}>
            {showLoadingOverlay && (
              <DataLoadingOverlay
                isActive
                subtitle="Đang tải dữ liệu kho hàng..."
                bottomText="Đang đồng bộ dữ liệu sản phẩm từ hệ thống..."
              />
            )}
            {error && !isLoading ? (
              <div className={styles["admin-inventory-page__empty"]}>
                {error}
              </div>
            ) : items.length === 0 && !isLoading ? (
              <div className={styles["admin-inventory-page__empty"]}>
                Không tìm thấy sản phẩm nào trong kho.
              </div>
            ) : (
              <table className={styles["admin-inventory-page__table"]}>
                <thead>
                  <tr className={styles["admin-inventory-page__table-head-row"]}>
                    <th
                      className={clsx(
                        styles["admin-inventory-page__table-head-cell"],
                        styles["admin-inventory-page__table-head-cell--center"],
                      )}
                    >
                      Ảnh
                    </th>
                    <th className={styles["admin-inventory-page__table-head-cell"]}>
                      Sản phẩm
                    </th>
                    <th
                      className={clsx(
                        styles["admin-inventory-page__table-head-cell"],
                        styles["admin-inventory-page__table-head-cell--center"],
                      )}
                    >
                      Trạng thái
                    </th>
                    <th
                      className={clsx(
                        styles["admin-inventory-page__table-head-cell"],
                        styles["admin-inventory-page__table-head-cell--center"],
                      )}
                    >
                      Tồn kho
                    </th>
                    <th
                      className={clsx(
                        styles["admin-inventory-page__table-head-cell"],
                        styles["admin-inventory-page__table-head-cell--right"],
                      )}
                    >
                      Hành động
                    </th>
                  </tr>
                </thead>
                <tbody className={styles["admin-inventory-page__table-body"]}>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className={styles["admin-inventory-page__table-row"]}
                    >
                      <td
                        className={clsx(
                          styles["admin-inventory-page__table-cell"],
                          styles["admin-inventory-page__image-cell"],
                        )}
                      >
                        <div
                          className={
                            styles["admin-inventory-page__image-thumb"]
                          }
                        >
                          {item.primaryImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.primaryImageUrl} alt="" />
                          ) : (
                            <MdImage
                              style={{ fontSize: 20, color: "var(--text-tertiary)" }}
                            />
                          )}
                        </div>
                      </td>
                      <td className={styles["admin-inventory-page__table-cell"]}>
                        <div
                          className={
                            styles["admin-inventory-page__name-cell-inner"]
                          }
                        >
                          <span
                            className={styles["admin-inventory-page__name"]}
                          >
                            {item.name}
                          </span>
                          <span
                            className={styles["admin-inventory-page__meta"]}
                          >
                            {item.brandName ?? "Không thương hiệu"} ·{" "}
                            {item.categoryName ?? "Không danh mục"}
                          </span>
                          <span
                            className={styles["admin-inventory-page__meta"]}
                          >
                            Slug: {item.slug}
                          </span>
                        </div>
                      </td>
                      <td
                        className={clsx(
                          styles["admin-inventory-page__table-cell"],
                          styles["admin-inventory-page__status-cell"],
                        )}
                      >
                        {stockBadge(item.stock)}
                      </td>
                      <td
                        className={clsx(
                          styles["admin-inventory-page__table-cell"],
                          styles["admin-inventory-page__stock-cell"],
                        )}
                      >
                        <span
                          className={
                            styles["admin-inventory-page__stock-value"]
                          }
                        >
                          {item.stock}
                        </span>
                      </td>
                      <td
                        className={clsx(
                          styles["admin-inventory-page__table-cell"],
                          styles["admin-inventory-page__actions-cell"],
                        )}
                      >
                        <button
                          type="button"
                          className={styles["admin-inventory-page__action-icon-btn"]}
                          onClick={() => goToProductDetail(item.id)}
                          title="Xem chi tiết"
                          aria-label="Xem chi tiết"
                        >
                          <MdVisibility />
                        </button>
                        <button
                          type="button"
                          className={styles["admin-inventory-page__action-icon-btn"]}
                          onClick={() => openImportModal({ id: item.id, name: item.name, currentStock: item.stock })}
                          title="Nhập kho"
                          aria-label="Nhập kho"
                        >
                          <MdAddCircleOutline />
                        </button>
                        <button
                          type="button"
                          className={styles["admin-inventory-page__action-icon-btn"]}
                          onClick={() => openAdjustModal({ id: item.id, name: item.name, currentStock: item.stock })}
                          title="Xuất kho / Điều chỉnh"
                          aria-label="Xuất kho"
                        >
                          <MdRemoveCircleOutline />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className={styles["admin-inventory-page__pagination"]}>
            <span className={styles["admin-inventory-page__pagination-info"]}>
              {total === 0
                ? "Không có dữ liệu"
                : `Hiển thị ${from}–${to} trong tổng ${total} sản phẩm`}
            </span>
            <div
              className={styles["admin-inventory-page__pagination-buttons"]}
            >
              <button
                type="button"
                className={styles["admin-inventory-page__pagination-button"]}
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
              >
                Trước
              </button>
              <button
                type="button"
                className={styles["admin-inventory-page__pagination-button"]}
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
              >
                Sau
              </button>
            </div>
          </div>
            </section>
          </>
        )}

        {activeTab === "logs" && (
          <section className={styles["admin-inventory-page__table-card"]}>
            <div className={styles["admin-inventory-page__logs-header"]}>
              <div
                className={styles["admin-inventory-page__logs-header-left"]}
              >
                <h2
                  className={styles["admin-inventory-page__logs-header-title"]}
                >
                  Lịch sử nhập / xuất kho
                </h2>
                <p
                  className={
                    styles["admin-inventory-page__logs-header-subtitle"]
                  }
                >
                  Theo dõi chi tiết các lần điều chỉnh tồn kho, nhập hàng, xuất
                  kho theo thời gian.
                </p>
              </div>
              <div
                className={styles["admin-inventory-page__logs-header-right"]}
              >
                <select
                  className={styles["admin-inventory-page__select"]}
                  value={logSourceFilter}
                  onChange={(e) =>
                    setLogSourceFilter(e.target.value as LogSourceFilter)
                  }
                >
                  <option value="all">Tất cả loại giao dịch</option>
                  <option value="ADMIN_STOCK_IMPORT">Nhập kho thủ công</option>
                  <option value="ADMIN_STOCK_ADJUST">
                    Điều chỉnh tồn kho
                  </option>
                  <option value="ORDER_PLACED">Đơn hàng đặt mua</option>
                  <option value="ORDER_CANCELLED">Huỷ đơn / hoàn kho</option>
                  <option value="ADMIN_CREATE_PRODUCT">
                    Tạo sản phẩm ban đầu
                  </option>
                </select>
                <div
                  className={
                    styles["admin-inventory-page__search-wrapper"]
                  }
                >
                  <MdSearch
                    className={styles["admin-inventory-page__search-icon"]}
                  />
                  <input
                    type="text"
                    className={styles["admin-inventory-page__search-input"]}
                    placeholder="Tìm theo tên sản phẩm hoặc slug..."
                    value={logSearchInput}
                    onChange={(e) => setLogSearchInput(e.target.value)}
                  />
                </div>
                <div
                  className={styles["admin-inventory-page__logs-actions-right"]}
                >
                  <button
                    type="button"
                    className={styles["admin-inventory-page__filter-button"]}
                    onClick={handleLogsApplySearch}
                  >
                    <MdFilterList />
                    Lọc
                  </button>
                  <button
                    type="button"
                    className={styles["admin-inventory-page__filter-button"]}
                    onClick={handleLogsReset}
                  >
                    Đặt lại
                  </button>
                </div>
              </div>
            </div>

            <div className={styles["admin-inventory-page__table-wrapper"]}>
              {showLogsLoadingOverlay && (
                <DataLoadingOverlay
                  isActive
                  subtitle="Đang tải lịch sử tồn kho..."
                  bottomText="Đang đồng bộ dữ liệu nhập / xuất kho từ hệ thống..."
                />
              )}
              {logsError && !isLogsLoading ? (
                <div className={styles["admin-inventory-page__empty"]}>
                  {logsError}
                </div>
              ) : logItems.length === 0 && !isLogsLoading ? (
                <div className={styles["admin-inventory-page__empty"]}>
                  Chưa có lịch sử nhập / xuất kho nào.
                </div>
              ) : (
                <table className={styles["admin-inventory-page__table"]}>
                  <thead>
                    <tr
                      className={styles["admin-inventory-page__table-head-row"]}
                    >
                      <th
                        className={styles["admin-inventory-page__table-head-cell"]}
                      >
                        Thời gian
                      </th>
                      <th
                        className={styles["admin-inventory-page__table-head-cell"]}
                      >
                        Sản phẩm
                      </th>
                      <th
                        className={clsx(
                          styles["admin-inventory-page__table-head-cell"],
                          styles["admin-inventory-page__table-head-cell--center"],
                        )}
                      >
                        Thay đổi
                      </th>
                      <th
                        className={styles["admin-inventory-page__table-head-cell"]}
                      >
                        Lý do / nguồn
                      </th>
                    </tr>
                  </thead>
                  <tbody className={styles["admin-inventory-page__table-body"]}>
                    {logItems.map((log) => (
                      <tr
                        key={log.id}
                        className={styles["admin-inventory-page__table-row"]}
                      >
                        <td
                          className={styles["admin-inventory-page__table-cell"]}
                        >
                          {new Date(log.createdAt).toLocaleString("vi-VN")}
                        </td>
                        <td
                          className={styles["admin-inventory-page__table-cell"]}
                        >
                          <div
                            className={
                              styles["admin-inventory-page__name-cell-inner"]
                            }
                          >
                            <span
                              className={styles["admin-inventory-page__name"]}
                            >
                              {log.productName}
                            </span>
                            {log.productSlug && (
                              <span
                                className={styles["admin-inventory-page__meta"]}
                              >
                                Slug: {log.productSlug}
                              </span>
                            )}
                          </div>
                        </td>
                        <td
                          className={clsx(
                            styles["admin-inventory-page__table-cell"],
                            styles["admin-inventory-page__change-cell"],
                          )}
                        >
                          <span
                            className={clsx(
                              styles[
                                "admin-inventory-page__change-value"
                              ],
                              log.change >= 0
                                ? styles[
                                    "admin-inventory-page__change-value--positive"
                                  ]
                                : styles[
                                    "admin-inventory-page__change-value--negative"
                                  ],
                            )}
                          >
                            {log.change > 0 ? `+${log.change}` : log.change}
                          </span>
                        </td>
                        <td
                          className={styles["admin-inventory-page__table-cell"]}
                        >
                          <div
                            className={
                              styles["admin-inventory-page__logs-reason"]
                            }
                          >
                            {log.reason && (
                              <span
                                className={
                                  styles[
                                    "admin-inventory-page__logs-reason-main"
                                  ]
                                }
                              >
                                {log.reason}
                              </span>
                            )}
                            {(log.source || log.referenceId) && (
                              <span
                                className={
                                  styles[
                                    "admin-inventory-page__logs-reason-meta"
                                  ]
                                }
                              >
                                {log.source && `Nguồn: ${log.source}`}
                                {log.source && log.referenceId && " · "}
                                {log.referenceId &&
                                  `Mã tham chiếu: ${log.referenceId}`}
                              </span>
                            )}
                            {!log.reason &&
                              !log.source &&
                              !log.referenceId && (
                                <span
                                  className={
                                    styles[
                                      "admin-inventory-page__logs-reason-meta"
                                    ]
                                  }
                                >
                                  Không có ghi chú.
                                </span>
                              )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className={styles["admin-inventory-page__pagination"]}>
              <span
                className={styles["admin-inventory-page__pagination-info"]}
              >
                {logTotal === 0
                  ? "Không có dữ liệu"
                  : `Hiển thị ${logsFrom}–${logsTo} trong tổng ${logTotal} lần ghi log`}
              </span>
              <div
                className={styles["admin-inventory-page__pagination-buttons"]}
              >
                <button
                  type="button"
                  className={styles["admin-inventory-page__pagination-button"]}
                  onClick={() => handleLogsPageChange(logPage - 1)}
                  disabled={logPage <= 1}
                >
                  Trước
                </button>
                <button
                  type="button"
                  className={styles["admin-inventory-page__pagination-button"]}
                  onClick={() => handleLogsPageChange(logPage + 1)}
                  disabled={logPage >= logsTotalPages}
                >
                  Sau
                </button>
              </div>
            </div>
          </section>
        )}

        {importModalProduct && (
          <div
            className={styles["admin-inventory-page__inventory-modal"]}
            role="dialog"
            aria-modal="true"
            aria-labelledby="inventory-import-title-dashboard"
          >
            <div
              className={
                styles["admin-inventory-page__inventory-modal-backdrop"]
              }
              onClick={closeImportModal}
            />
            <div
              className={styles["admin-inventory-page__inventory-modal-panel"]}
            >
              <div
                className={
                  styles["admin-inventory-page__inventory-modal-header"]
                }
              >
                <div>
                  <h3
                    id="inventory-import-title-dashboard"
                    className={
                      styles["admin-inventory-page__inventory-modal-title"]
                    }
                  >
                    Nhập kho
                  </h3>
                  <p
                    className={
                      styles["admin-inventory-page__inventory-modal-subtitle"]
                    }
                  >
                    {importModalProduct.name} · Tồn kho hiện tại:{" "}
                    <strong>{importModalProduct.currentStock}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  className={
                    styles["admin-inventory-page__inventory-modal-close"]
                  }
                  onClick={closeImportModal}
                  aria-label="Đóng"
                >
                  <MdClose />
                </button>
              </div>
              <div
                className={styles["admin-inventory-page__inventory-modal-body"]}
              >
                <div
                  className={
                    styles["admin-inventory-page__inventory-modal-field"]
                  }
                >
                  <label
                    className={
                      styles["admin-inventory-page__inventory-modal-label"]
                    }
                  >
                    Số lượng nhập
                  </label>
                  <input
                    type="number"
                    min={1}
                    className={
                      styles["admin-inventory-page__inventory-modal-input"]
                    }
                    value={importQuantity}
                    onChange={(e) => setImportQuantity(e.target.value)}
                    placeholder="Ví dụ: 20"
                  />
                </div>
                <div
                  className={
                    styles["admin-inventory-page__inventory-modal-field"]
                  }
                >
                  <label
                    className={
                      styles["admin-inventory-page__inventory-modal-label"]
                    }
                  >
                    Ghi chú (tuỳ chọn)
                  </label>
                  <textarea
                    className={
                      styles["admin-inventory-page__inventory-modal-textarea"]
                    }
                    value={importReason}
                    onChange={(e) => setImportReason(e.target.value)}
                    placeholder="Ví dụ: Nhập hàng đợt 10/2026"
                    rows={2}
                  />
                </div>
                <div
                  className={
                    styles["admin-inventory-page__inventory-modal-field"]
                  }
                >
                  <label
                    className={
                      styles["admin-inventory-page__inventory-modal-label"]
                    }
                  >
                    Mã tham chiếu (tuỳ chọn)
                  </label>
                  <div
                    className={
                      styles["admin-inventory-page__inventory-modal-ref-row"]
                    }
                  >
                    <input
                      type="text"
                      className={
                        styles["admin-inventory-page__inventory-modal-input"]
                      }
                      value={importReferenceId}
                      onChange={(e) => setImportReferenceId(e.target.value)}
                      placeholder="Ví dụ: PO-2026-10-001, mã phiếu nhập..."
                    />
                    <button
                      type="button"
                      className={
                        styles["admin-inventory-page__inventory-modal-ref-btn"]
                      }
                      onClick={() =>
                        setImportReferenceId(generateReferenceId("NH"))
                      }
                    >
                      Tự sinh
                    </button>
                  </div>
                </div>
              </div>
              <div
                className={
                  styles["admin-inventory-page__inventory-modal-footer"]
                }
              >
                <button
                  type="button"
                  className={
                    styles[
                      "admin-inventory-page__inventory-modal-btn--secondary"
                    ]
                  }
                  onClick={closeImportModal}
                  disabled={isImportSubmitting}
                >
                  Huỷ
                </button>
                <button
                  type="button"
                  className={
                    styles[
                      "admin-inventory-page__inventory-modal-btn--primary"
                    ]
                  }
                  onClick={submitImport}
                  disabled={isImportSubmitting}
                >
                  {isImportSubmitting ? "Đang xử lý..." : "Xác nhận nhập kho"}
                </button>
              </div>
            </div>
          </div>
        )}

        {adjustModalProduct && (
          <div
            className={styles["admin-inventory-page__inventory-modal"]}
            role="dialog"
            aria-modal="true"
            aria-labelledby="inventory-adjust-title-dashboard"
          >
            <div
              className={
                styles["admin-inventory-page__inventory-modal-backdrop"]
              }
              onClick={closeAdjustModal}
            />
            <div
              className={styles["admin-inventory-page__inventory-modal-panel"]}
            >
              <div
                className={
                  styles["admin-inventory-page__inventory-modal-header"]
                }
              >
                <div>
                  <h3
                    id="inventory-adjust-title-dashboard"
                    className={
                      styles["admin-inventory-page__inventory-modal-title"]
                    }
                  >
                    Điều chỉnh tồn kho
                  </h3>
                  <p
                    className={
                      styles["admin-inventory-page__inventory-modal-subtitle"]
                    }
                  >
                    {adjustModalProduct.name} · Tồn kho hiện tại:{" "}
                    <strong>{adjustModalProduct.currentStock}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  className={
                    styles["admin-inventory-page__inventory-modal-close"]
                  }
                  onClick={closeAdjustModal}
                  aria-label="Đóng"
                >
                  <MdClose />
                </button>
              </div>
              <div
                className={styles["admin-inventory-page__inventory-modal-body"]}
              >
                <div
                  className={
                    styles["admin-inventory-page__inventory-modal-field"]
                  }
                >
                  <span
                    className={
                      styles["admin-inventory-page__inventory-modal-label"]
                    }
                  >
                    Cách điều chỉnh
                  </span>
                  <div
                    className={
                      styles["admin-inventory-page__inventory-modal-mode-row"]
                    }
                  >
                    <label
                      className={
                        styles[
                          "admin-inventory-page__inventory-modal-radio-wrap"
                        ]
                      }
                    >
                      <input
                        type="radio"
                        name="adjustModeDashboard"
                        checked={adjustMode === "decreaseBy"}
                        onChange={() => setAdjustMode("decreaseBy")}
                      />
                      Giảm theo số lượng
                    </label>
                    <label
                      className={
                        styles[
                          "admin-inventory-page__inventory-modal-radio-wrap"
                        ]
                      }
                    >
                      <input
                        type="radio"
                        name="adjustModeDashboard"
                        checked={adjustMode === "setTo"}
                        onChange={() => setAdjustMode("setTo")}
                      />
                      Đặt tồn kho tuyệt đối
                    </label>
                  </div>
                </div>
                <div
                  className={
                    styles["admin-inventory-page__inventory-modal-field"]
                  }
                >
                  <label
                    className={
                      styles["admin-inventory-page__inventory-modal-label"]
                    }
                  >
                    {adjustMode === "decreaseBy"
                      ? "Số lượng giảm"
                      : "Tồn kho mới"}
                  </label>
                  <input
                    type="number"
                    min={adjustMode === "setTo" ? 0 : 1}
                    max={
                      adjustMode === "decreaseBy"
                        ? adjustModalProduct.currentStock
                        : undefined
                    }
                    className={
                      styles["admin-inventory-page__inventory-modal-input"]
                    }
                    value={adjustValue}
                    onChange={(e) => setAdjustValue(e.target.value)}
                    placeholder={
                      adjustMode === "decreaseBy"
                        ? "Ví dụ: 3"
                        : "Ví dụ: 47"
                    }
                  />
                </div>
                <div
                  className={
                    styles["admin-inventory-page__inventory-modal-field"]
                  }
                >
                  <label
                    className={
                      styles["admin-inventory-page__inventory-modal-label"]
                    }
                  >
                    Lý do (bắt buộc)
                  </label>
                  <textarea
                    className={
                      styles["admin-inventory-page__inventory-modal-textarea"]
                    }
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder="Ví dụ: Kiểm kê kho tháng 10, Hàng lỗi"
                    rows={2}
                  />
                </div>
                <div
                  className={
                    styles["admin-inventory-page__inventory-modal-field"]
                  }
                >
                  <label
                    className={
                      styles["admin-inventory-page__inventory-modal-label"]
                    }
                  >
                    Mã tham chiếu (tuỳ chọn)
                  </label>
                  <div
                    className={
                      styles["admin-inventory-page__inventory-modal-ref-row"]
                    }
                  >
                    <input
                      type="text"
                      className={
                        styles["admin-inventory-page__inventory-modal-input"]
                      }
                      value={adjustReferenceId}
                      onChange={(e) => setAdjustReferenceId(e.target.value)}
                      placeholder="Ví dụ: KK-2026-10-001, mã biên bản kiểm kê..."
                    />
                    <button
                      type="button"
                      className={
                        styles["admin-inventory-page__inventory-modal-ref-btn"]
                      }
                      onClick={() =>
                        setAdjustReferenceId(generateReferenceId("DC"))
                      }
                    >
                      Tự sinh
                    </button>
                  </div>
                </div>
              </div>
              <div
                className={
                  styles["admin-inventory-page__inventory-modal-footer"]
                }
              >
                <button
                  type="button"
                  className={
                    styles[
                      "admin-inventory-page__inventory-modal-btn--secondary"
                    ]
                  }
                  onClick={closeAdjustModal}
                  disabled={isAdjustSubmitting}
                >
                  Huỷ
                </button>
                <button
                  type="button"
                  className={
                    styles[
                      "admin-inventory-page__inventory-modal-btn--primary"
                    ]
                  }
                  onClick={submitAdjust}
                  disabled={isAdjustSubmitting}
                >
                  {isAdjustSubmitting
                    ? "Đang xử lý..."
                    : "Xác nhận điều chỉnh"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminInventoryDashboardPage;

