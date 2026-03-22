"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MdAutoAwesome, MdEdit, MdRefresh, MdSearch } from "react-icons/md";
import { toast } from "sonner";
import DataLoadingOverlay from "@/components/shared/DataLoadingOverlay";
import AiContentEditDrawer from "./AiContentEditDrawer";
import styles from "./AdminAiContentPage.module.css";

type TabType = "products" | "brands" | "categories";

type ContentItem = {
  id: string;
  name: string;
  aiDescription: string | null;
  aiTags: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  brandName?: string | null;
  categoryName?: string | null;
  slug?: string;
};

type ContentStat = {
  total: number;
  hasAll: number;
  hasPartial: number;
  hasNone: number;
};

function getStatus(item: ContentItem): "all" | "partial" | "none" {
  const filled = [!!item.aiDescription, item.aiTags.length > 0, !!item.seoTitle, !!item.seoDescription].filter(Boolean).length;
  if (filled === 4) return "all";
  if (filled === 0) return "none";
  return "partial";
}

const AdminAiContentPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>("products");
  const [items, setItems] = useState<ContentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [showOverlay, setShowOverlay] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "hasNone" | "hasAll">("all");
  const [stats, setStats] = useState<{ products: ContentStat; brands: ContentStat; categories: ContentStat } | null>(null);
  const [editItem, setEditItem] = useState<ContentItem | null>(null);
  const [editItemType, setEditItemType] = useState<TabType>("products");
  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/admin/ai/content/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => null);
  }, [activeTab]);

  const fetchItems = useCallback(async () => {
    const start = performance.now();
    setIsLoading(true);
    setShowOverlay(true);

    const endpointMap: Record<TabType, string> = {
      products: "/api/admin/products",
      brands: "/api/admin/brands",
      categories: "/api/admin/categories",
    };

    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (search) params.set("search", search);
    if (filterStatus === "hasNone") params.set("noAiContent", "true");
    if (filterStatus === "hasAll") params.set("hasAiContent", "true");

    try {
      const res = await fetch(`${endpointMap[activeTab]}?${params.toString()}`);
      if (!res.ok) throw new Error();
      const data = await res.json();

      const raw = (data.data ?? data.brands ?? data.categories ?? data.items ?? []) as ContentItem[];
      setItems(raw);
      setTotal(data.total ?? raw.length);
      setTotalPages(Math.ceil((data.total ?? raw.length) / 20));
    } catch {
      toast.error("Không thể tải danh sách.");
    } finally {
      const elapsed = performance.now() - start;
      if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
      loadTimerRef.current = setTimeout(() => {
        setIsLoading(false);
        setShowOverlay(false);
      }, Math.max(0, 1200 - elapsed));
    }
  }, [activeTab, page, search, filterStatus]);

  useEffect(() => {
    fetchItems();
    return () => { if (loadTimerRef.current) clearTimeout(loadTimerRef.current); };
  }, [fetchItems]);

  const handleSingleAiGenerate = async (item: ContentItem) => {
    toast.info(`Đang sinh AI content cho "${item.name}"...`);
    const endpointMap: Record<TabType, string> = {
      products: `/api/admin/products/ai`,
      brands: `/api/admin/brands/ai`,
      categories: `/api/admin/categories/ai`,
    };
    try {
      const res = await fetch(endpointMap[activeTab], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: item.name, id: item.id }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const generated = data.data ?? data;

      const updateEndpointMap: Record<TabType, { url: string; method: string }> = {
        products:   { url: `/api/admin/products/${item.id}`,   method: "PATCH" },
        brands:     { url: `/api/admin/brands/${item.id}`,     method: "PATCH" },
        categories: { url: `/api/admin/categories/${item.id}`, method: "PUT" },
      };
      const updateRes = await fetch(updateEndpointMap[activeTab].url, {
        method: updateEndpointMap[activeTab].method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(generated),
      });
      if (!updateRes.ok) throw new Error();

      setItems((prev) =>
        prev.map((s) =>
          s.id === item.id
            ? {
                ...s,
                aiDescription: generated.aiDescription ?? s.aiDescription,
                aiTags: generated.aiTags ?? s.aiTags,
                seoTitle: generated.seoTitle ?? s.seoTitle,
                seoDescription: generated.seoDescription ?? s.seoDescription,
              }
            : s,
        ),
      );
      toast.success(`Đã sinh AI content cho "${item.name}".`);
    } catch {
      toast.error(`Sinh AI thất bại cho "${item.name}".`);
    }
  };

  const handleSaveDrawer = async (updated: ContentItem) => {
    const endpointMap: Record<TabType, { url: string; method: string }> = {
      products:   { url: `/api/admin/products/${updated.id}`,   method: "PATCH" },
      brands:     { url: `/api/admin/brands/${updated.id}`,     method: "PATCH" },
      categories: { url: `/api/admin/categories/${updated.id}`, method: "PUT" },
    };
    try {
      const res = await fetch(endpointMap[editItemType].url, {
        method: endpointMap[editItemType].method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiDescription: updated.aiDescription,
          aiTags: updated.aiTags,
          seoTitle: updated.seoTitle,
          seoDescription: updated.seoDescription,
        }),
      });
      if (!res.ok) throw new Error();
      setItems((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
      toast.success("Đã lưu AI content.");
      setEditItem(null);
    } catch {
      toast.error("Lưu thất bại.");
    }
  };

  const currentStat = stats ? stats[activeTab] : null;

  return (
    <div className={styles["admin-ai-content-page"]}>
      <div className={styles["admin-ai-content-page__header"]}>
        <div>
          <h1 className={styles["admin-ai-content-page__title"]}>Nội dung AI trên Catalog</h1>
          <p className={styles["admin-ai-content-page__subtitle"]}>Quản lý và chỉnh sửa AI content cho sản phẩm, thương hiệu, danh mục</p>
        </div>
        <button type="button" className={styles["admin-ai-content-page__btn-secondary"]} onClick={fetchItems}>
          <MdRefresh /> Làm mới
        </button>
      </div>

      <nav className={styles["admin-ai-content-page__subnav"]}>
        <Link href="/admin/ai" className={styles["admin-ai-content-page__subnav-link"]}>Tổng quan</Link>
        <Link href="/admin/ai/sessions" className={styles["admin-ai-content-page__subnav-link"]}>Lịch sử phiên</Link>
        <Link href="/admin/ai/content" className={`${styles["admin-ai-content-page__subnav-link"]} ${styles["admin-ai-content-page__subnav-link--active"]}`}>Nội dung AI</Link>
        <Link href="/admin/ai/settings" className={styles["admin-ai-content-page__subnav-link"]}>Cài đặt</Link>
        <Link href="/admin/ai/prompts" className={styles["admin-ai-content-page__subnav-link"]}>Prompt</Link>
        <Link href="/admin/ai/batch" className={styles["admin-ai-content-page__subnav-link"]}>Sinh hàng loạt</Link>
        <Link href="/admin/ai/demo-products" className={styles["admin-ai-content-page__subnav-link"]}>Sản phẩm mẫu</Link>
      </nav>

      {/* Stats summary */}
      {currentStat && (
        <div className={styles["admin-ai-content-page__stat-bar"]}>
          <span>Tổng: <strong>{currentStat.total}</strong></span>
          <span className={styles["admin-ai-content-page__stat-ok"]}>Đủ: <strong>{currentStat.hasAll}</strong></span>
          <span className={styles["admin-ai-content-page__stat-partial"]}>Thiếu một số: <strong>{currentStat.hasPartial}</strong></span>
          <span className={styles["admin-ai-content-page__stat-none"]}>Chưa có: <strong>{currentStat.hasNone}</strong></span>
        </div>
      )}

      {/* Tabs */}
      <div className={styles["admin-ai-content-page__tabs"]}>
        {(["products", "brands", "categories"] as TabType[]).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`${styles["admin-ai-content-page__tab"]} ${activeTab === tab ? styles["admin-ai-content-page__tab--active"] : ""}`}
            onClick={() => { setActiveTab(tab); setPage(1); }}
          >
            {{ products: "Sản phẩm", brands: "Thương hiệu", categories: "Danh mục" }[tab]}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className={styles["admin-ai-content-page__toolbar"]}>
        <form
          className={styles["admin-ai-content-page__search-form"]}
          onSubmit={(e) => { e.preventDefault(); setSearch(searchInput.trim()); setPage(1); }}
        >
          <div className={styles["admin-ai-content-page__search-wrapper"]}>
            <MdSearch className={styles["admin-ai-content-page__search-icon"]} />
            <input
              type="text"
              placeholder="Tìm theo tên..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className={styles["admin-ai-content-page__search-input"]}
            />
          </div>
          <button type="submit" className={styles["admin-ai-content-page__btn-primary"]}>Tìm</button>
        </form>
        <div className={styles["admin-ai-content-page__filter-group"]}>
          {(["all", "hasNone", "hasAll"] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={`${styles["admin-ai-content-page__filter-btn"]} ${filterStatus === f ? styles["admin-ai-content-page__filter-btn--active"] : ""}`}
              onClick={() => { setFilterStatus(f); setPage(1); }}
            >
              {{ all: "Tất cả", hasNone: "Chưa có AI", hasAll: "Đủ AI" }[f]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className={styles["admin-ai-content-page__table-wrapper"]}>
        <DataLoadingOverlay
          isActive={showOverlay}
          title="Đức Uy Audio"
          subtitle="Đang tải nội dung AI..."
          bottomText="Đang đồng bộ dữ liệu catalog..."
        />
        {!isLoading && (
          <table className={styles["admin-ai-content-page__table"]}>
            <thead>
              <tr>
                <th>Tên</th>
                {activeTab === "products" && <><th>Danh mục</th><th>Thương hiệu</th></>}
                <th>AI Description</th>
                <th>AI Tags</th>
                <th>SEO Title</th>
                <th>SEO Desc</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const status = getStatus(item);
                return (
                  <tr key={item.id} className={status === "none" ? styles["admin-ai-content-page__row--none"] : ""}>
                    <td className={styles["admin-ai-content-page__td-name"]}>
                      <div className={styles["admin-ai-content-page__name-cell"]}>
                        <span
                          className={`${styles["admin-ai-content-page__status-dot"]} ${styles[`admin-ai-content-page__status-dot--${status}`]}`}
                          title={{ all: "Đủ", partial: "Thiếu một số", none: "Chưa có" }[status]}
                        />
                        {item.name}
                      </div>
                    </td>
                    {activeTab === "products" && (
                      <>
                        <td className={styles["admin-ai-content-page__td-meta"]}>{item.categoryName ?? "—"}</td>
                        <td className={styles["admin-ai-content-page__td-meta"]}>{item.brandName ?? "—"}</td>
                      </>
                    )}
                    <td>
                      {item.aiDescription ? (
                        <span className={styles["admin-ai-content-page__badge-ok"]} title={item.aiDescription}>
                          Có
                        </span>
                      ) : (
                        <span className={styles["admin-ai-content-page__badge-missing"]}>Chưa có</span>
                      )}
                    </td>
                    <td>
                      {item.aiTags.length > 0 ? (
                        <span className={styles["admin-ai-content-page__badge-ok"]}>{item.aiTags.length} tags</span>
                      ) : (
                        <span className={styles["admin-ai-content-page__badge-missing"]}>Chưa có</span>
                      )}
                    </td>
                    <td>
                      {item.seoTitle ? (
                        <span className={styles["admin-ai-content-page__badge-ok"]} title={item.seoTitle}>Có</span>
                      ) : (
                        <span className={styles["admin-ai-content-page__badge-missing"]}>Chưa có</span>
                      )}
                    </td>
                    <td>
                      {item.seoDescription ? (
                        <span className={styles["admin-ai-content-page__badge-ok"]}>Có</span>
                      ) : (
                        <span className={styles["admin-ai-content-page__badge-missing"]}>Chưa có</span>
                      )}
                    </td>
                    <td>
                      <div className={styles["admin-ai-content-page__actions"]}>
                        <button
                          type="button"
                          className={styles["admin-ai-content-page__btn-ai"]}
                          onClick={() => handleSingleAiGenerate(item)}
                          title="Sinh AI"
                        >
                          <MdAutoAwesome /> Sinh AI
                        </button>
                        <button
                          type="button"
                          className={styles["admin-ai-content-page__btn-edit"]}
                          onClick={() => { setEditItem(item); setEditItemType(activeTab); }}
                        >
                          <MdEdit />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && items.length === 0 && (
                <tr>
                  <td colSpan={8} className={styles["admin-ai-content-page__empty"]}>
                    Không có mục nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles["admin-ai-content-page__pagination"]}>
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className={styles["admin-ai-content-page__btn-page"]}>
            &lsaquo;
          </button>
          <span className={styles["admin-ai-content-page__page-info"]}>Trang {page} / {totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className={styles["admin-ai-content-page__btn-page"]}>
            &rsaquo;
          </button>
        </div>
      )}

      {/* Edit Drawer */}
      {editItem && (
        <AiContentEditDrawer
          item={editItem}
          itemType={editItemType}
          onClose={() => setEditItem(null)}
          onSave={handleSaveDrawer}
        />
      )}
    </div>
  );
};

export default AdminAiContentPage;
