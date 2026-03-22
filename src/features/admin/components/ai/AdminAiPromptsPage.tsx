"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { MdEdit, MdRestartAlt, MdCheckCircle } from "react-icons/md";
import { toast } from "sonner";
import styles from "./AdminAiPromptsPage.module.css";

type PromptItem = {
  key: string;
  label: string;
  description: string | null;
  content: string;
  defaultContent: string;
  isCustomized: boolean;
  updatedAt: string | null;
  updatedByEmail: string | null;
};

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const AdminAiPromptsPage: React.FC = () => {
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPrompts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/ai/prompts");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPrompts(data.prompts);
    } catch {
      toast.error("Không thể tải danh sách prompts.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPrompts();
  }, []);

  const handleReset = async (key: string) => {
    if (!confirm("Reset về nội dung gốc?")) return;
    try {
      const res = await fetch(`/api/admin/ai/prompts/${key}/reset`, { method: "POST" });
      if (!res.ok) throw new Error();
      toast.success("Đã reset prompt về mặc định.");
      setPrompts((prev) =>
        prev.map((p) =>
          p.key === key
            ? { ...p, content: p.defaultContent, isCustomized: false }
            : p,
        ),
      );
    } catch {
      toast.error("Reset thất bại.");
    }
  };

  return (
    <div className={styles["admin-ai-prompts-page"]}>
      <div className={styles["admin-ai-prompts-page__header"]}>
        <div>
          <h1 className={styles["admin-ai-prompts-page__title"]}>Quản lý Prompt AI</h1>
          <p className={styles["admin-ai-prompts-page__subtitle"]}>
            Xem và chỉnh sửa system prompt cho các tính năng AI
          </p>
        </div>
      </div>

      <nav className={styles["admin-ai-prompts-page__subnav"]}>
        <Link href="/admin/ai" className={styles["admin-ai-prompts-page__subnav-link"]}>Tổng quan</Link>
        <Link href="/admin/ai/sessions" className={styles["admin-ai-prompts-page__subnav-link"]}>Lịch sử phiên</Link>
        <Link href="/admin/ai/content" className={styles["admin-ai-prompts-page__subnav-link"]}>Nội dung AI</Link>
        <Link href="/admin/ai/settings" className={styles["admin-ai-prompts-page__subnav-link"]}>Cài đặt</Link>
        <Link href="/admin/ai/prompts" className={`${styles["admin-ai-prompts-page__subnav-link"]} ${styles["admin-ai-prompts-page__subnav-link--active"]}`}>Prompt</Link>
        <Link href="/admin/ai/batch" className={styles["admin-ai-prompts-page__subnav-link"]}>Sinh hàng loạt</Link>
        <Link href="/admin/ai/demo-products" className={styles["admin-ai-prompts-page__subnav-link"]}>Sản phẩm mẫu</Link>
      </nav>

      {isLoading ? (
        <div className={styles["admin-ai-prompts-page__loading"]}>Đang tải...</div>
      ) : (
        <div className={styles["admin-ai-prompts-page__grid"]}>
          {prompts.map((p) => (
            <div key={p.key} className={`${styles["admin-ai-prompts-page__card"]} ${p.isCustomized ? styles["admin-ai-prompts-page__card--customized"] : ""}`}>
              <div className={styles["admin-ai-prompts-page__card-header"]}>
                <div>
                  <div className={styles["admin-ai-prompts-page__card-title-row"]}>
                    <h3 className={styles["admin-ai-prompts-page__card-title"]}>{p.label}</h3>
                    {p.isCustomized && (
                      <span className={styles["admin-ai-prompts-page__badge-custom"]}>
                        <MdCheckCircle /> Đã tùy chỉnh
                      </span>
                    )}
                  </div>
                  <p className={styles["admin-ai-prompts-page__card-key"]}><code>{p.key}</code></p>
                  {p.description && (
                    <p className={styles["admin-ai-prompts-page__card-desc"]}>{p.description}</p>
                  )}
                </div>
              </div>

              <pre className={styles["admin-ai-prompts-page__card-preview"]}>
                {p.content.slice(0, 200)}{p.content.length > 200 ? "\n..." : ""}
              </pre>

              <div className={styles["admin-ai-prompts-page__card-footer"]}>
                <div className={styles["admin-ai-prompts-page__card-meta"]}>
                  {p.updatedAt && (
                    <span className={styles["admin-ai-prompts-page__card-updated"]}>
                      Cập nhật: {formatDateTime(p.updatedAt)} bởi {p.updatedByEmail ?? "—"}
                    </span>
                  )}
                </div>
                <div className={styles["admin-ai-prompts-page__card-actions"]}>
                  {p.isCustomized && (
                    <button
                      type="button"
                      className={styles["admin-ai-prompts-page__btn-reset"]}
                      onClick={() => handleReset(p.key)}
                    >
                      <MdRestartAlt /> Reset
                    </button>
                  )}
                  <Link
                    href={`/admin/ai/prompts/${p.key}`}
                    className={styles["admin-ai-prompts-page__btn-edit"]}
                  >
                    <MdEdit /> Chỉnh sửa
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminAiPromptsPage;
