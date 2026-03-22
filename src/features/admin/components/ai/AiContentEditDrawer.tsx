"use client";

import React, { useState } from "react";
import { MdAutoAwesome, MdClose, MdSave } from "react-icons/md";
import { toast } from "sonner";
import styles from "./AiContentEditDrawer.module.css";

type ContentItem = {
  id: string;
  name: string;
  aiDescription: string | null;
  aiTags: string[];
  seoTitle: string | null;
  seoDescription: string | null;
};

type TabType = "products" | "brands" | "categories";

type Props = {
  item: ContentItem;
  itemType: TabType;
  onClose: () => void;
  onSave: (updated: ContentItem) => Promise<void>;
};

const AiContentEditDrawer: React.FC<Props> = ({ item, itemType, onClose, onSave }) => {
  const [aiDescription, setAiDescription] = useState(item.aiDescription ?? "");
  const [aiTagsInput, setAiTagsInput] = useState(item.aiTags.join(", "));
  const [seoTitle, setSeoTitle] = useState(item.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(item.seoDescription ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const parseTags = (input: string): string[] =>
    input
      .split(",")
      .map((t) => t.trim().toLowerCase().replace(/\s+/g, "-"))
      .filter(Boolean);

  const handleGenerate = async () => {
    const endpointMap: Record<TabType, string> = {
      products: "/api/admin/products/ai",
      brands: "/api/admin/brands/ai",
      categories: "/api/admin/categories/ai",
    };
    setIsGenerating(true);
    try {
      const res = await fetch(endpointMap[itemType], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: item.name, id: item.id }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const generated = data.data ?? data;
      if (generated.aiDescription) setAiDescription(generated.aiDescription);
      if (generated.aiTags?.length) setAiTagsInput(generated.aiTags.join(", "));
      if (generated.seoTitle) setSeoTitle(generated.seoTitle);
      if (generated.seoDescription) setSeoDescription(generated.seoDescription);
      toast.success("Đã sinh AI content – kiểm tra và lưu khi sẵn sàng.");
    } catch {
      toast.error("Sinh AI thất bại.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        ...item,
        aiDescription: aiDescription || null,
        aiTags: parseTags(aiTagsInput),
        seoTitle: seoTitle || null,
        seoDescription: seoDescription || null,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className={styles["ai-content-edit-drawer__overlay"]}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={styles["ai-content-edit-drawer__panel"]}>
        <div className={styles["ai-content-edit-drawer__header"]}>
          <div>
            <h3 className={styles["ai-content-edit-drawer__title"]}>Chỉnh sửa AI Content</h3>
            <p className={styles["ai-content-edit-drawer__subtitle"]}>{item.name}</p>
          </div>
          <button type="button" className={styles["ai-content-edit-drawer__close"]} onClick={onClose}>
            <MdClose />
          </button>
        </div>

        <div className={styles["ai-content-edit-drawer__body"]}>
          <div className={styles["ai-content-edit-drawer__field"]}>
            <div className={styles["ai-content-edit-drawer__field-header"]}>
              <label className={styles["ai-content-edit-drawer__label"]}>AI Description</label>
              <button
                type="button"
                className={styles["ai-content-edit-drawer__btn-generate"]}
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                <MdAutoAwesome /> {isGenerating ? "Đang sinh..." : "Sinh lại với AI"}
              </button>
            </div>
            <textarea
              value={aiDescription}
              onChange={(e) => setAiDescription(e.target.value)}
              className={styles["ai-content-edit-drawer__textarea"]}
              rows={4}
              placeholder="Mô tả ngữ nghĩa cho chatbot AI..."
            />
          </div>

          <div className={styles["ai-content-edit-drawer__field"]}>
            <label className={styles["ai-content-edit-drawer__label"]}>
              AI Tags <span className={styles["ai-content-edit-drawer__hint"]}>(cách nhau bởi dấu phẩy, lowercase, dùng &ldquo;-&rdquo;)</span>
            </label>
            <input
              type="text"
              value={aiTagsInput}
              onChange={(e) => setAiTagsInput(e.target.value)}
              className={styles["ai-content-edit-drawer__input"]}
              placeholder="loa-bookshelf, hi-end, yamaha, phong-khach..."
            />
            <div className={styles["ai-content-edit-drawer__tags-preview"]}>
              {parseTags(aiTagsInput).map((t) => (
                <span key={t} className={styles["ai-content-edit-drawer__tag-chip"]}>{t}</span>
              ))}
            </div>
          </div>

          <div className={styles["ai-content-edit-drawer__field"]}>
            <label className={styles["ai-content-edit-drawer__label"]}>
              SEO Title <span className={styles["ai-content-edit-drawer__char-count"]}>{seoTitle.length}/60</span>
            </label>
            <input
              type="text"
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              maxLength={70}
              className={styles["ai-content-edit-drawer__input"]}
              placeholder="Tiêu đề SEO tối ưu ~50–60 ký tự..."
            />
          </div>

          <div className={styles["ai-content-edit-drawer__field"]}>
            <label className={styles["ai-content-edit-drawer__label"]}>
              SEO Description <span className={styles["ai-content-edit-drawer__char-count"]}>{seoDescription.length}/160</span>
            </label>
            <textarea
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
              maxLength={180}
              className={styles["ai-content-edit-drawer__textarea"]}
              rows={3}
              placeholder="Mô tả SEO ~155–170 ký tự..."
            />
          </div>
        </div>

        <div className={styles["ai-content-edit-drawer__footer"]}>
          <button
            type="button"
            className={styles["ai-content-edit-drawer__btn-save"]}
            onClick={handleSave}
            disabled={isSaving}
          >
            <MdSave /> {isSaving ? "Đang lưu..." : "Lưu"}
          </button>
          <button type="button" className={styles["ai-content-edit-drawer__btn-cancel"]} onClick={onClose}>
            Hủy
          </button>
        </div>
      </div>
    </div>
  );
};

export default AiContentEditDrawer;
