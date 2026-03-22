"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MdArrowBack, MdRestartAlt, MdSave, MdPlayArrow } from "react-icons/md";
import { toast } from "sonner";
import styles from "./AdminAiPromptEditPage.module.css";

type PromptDetail = {
  key: string;
  label: string;
  description: string | null;
  content: string;
  defaultContent: string;
  isCustomized: boolean;
  updatedAt: string | null;
  updatedByEmail: string | null;
};

type Props = { promptKey: string };

const AdminAiPromptEditPage: React.FC<Props> = ({ promptKey }) => {
  const [prompt, setPrompt] = useState<PromptDetail | null>(null);
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Test panel
  const [userInput, setUserInput] = useState("");
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [testLatency, setTestLatency] = useState<number | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/ai/prompts/${promptKey}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setPrompt(data);
        setContent(data.content);
      } catch {
        toast.error("Không thể tải prompt.");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [promptKey]);

  const handleSave = async () => {
    if (!content.trim()) {
      toast.error("Nội dung prompt không được để trống.");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/ai/prompts/${promptKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPrompt((prev) => prev ? { ...prev, content: data.content, isCustomized: true, updatedAt: data.updatedAt, updatedByEmail: data.updatedByEmail } : prev);
      toast.success("Đã lưu prompt.");
    } catch {
      toast.error("Lưu prompt thất bại.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Reset về nội dung gốc?")) return;
    try {
      const res = await fetch(`/api/admin/ai/prompts/${promptKey}/reset`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setContent(data.content);
      setPrompt((prev) => prev ? { ...prev, content: data.content, isCustomized: false } : prev);
      toast.success("Đã reset về mặc định.");
    } catch {
      toast.error("Reset thất bại.");
    }
  };

  const handleTest = async () => {
    if (!userInput.trim()) {
      toast.error("Nhập câu hỏi test trước.");
      return;
    }
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setIsTesting(true);
    setTestOutput(null);
    setTestLatency(null);
    try {
      const res = await fetch(`/api/admin/ai/prompts/${promptKey}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt: content, userInput }),
        signal: abortRef.current.signal,
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      setTestOutput(data.output);
      setTestLatency(data.latencyMs);
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        toast.error(`Test thất bại: ${err.message}`);
      }
    } finally {
      setIsTesting(false);
    }
  };

  const isDirty = prompt && content !== prompt.content;

  return (
    <div className={styles["admin-ai-prompt-edit-page"]}>
      <div className={styles["admin-ai-prompt-edit-page__header"]}>
        <Link href="/admin/ai/prompts" className={styles["admin-ai-prompt-edit-page__back"]}>
          <MdArrowBack /> Quay lại
        </Link>
        <div className={styles["admin-ai-prompt-edit-page__header-center"]}>
          {prompt && (
            <>
              <h1 className={styles["admin-ai-prompt-edit-page__title"]}>{prompt.label}</h1>
              <code className={styles["admin-ai-prompt-edit-page__key"]}>{prompt.key}</code>
            </>
          )}
        </div>
        <div className={styles["admin-ai-prompt-edit-page__header-actions"]}>
          {prompt?.isCustomized && (
            <button type="button" className={styles["admin-ai-prompt-edit-page__btn-reset"]} onClick={handleReset}>
              <MdRestartAlt /> Reset
            </button>
          )}
          <button
            type="button"
            className={styles["admin-ai-prompt-edit-page__btn-save"]}
            onClick={handleSave}
            disabled={isSaving || !isDirty}
          >
            <MdSave /> {isSaving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className={styles["admin-ai-prompt-edit-page__loading"]}>Đang tải...</div>
      ) : (
        <div className={styles["admin-ai-prompt-edit-page__body"]}>
          {/* Editor */}
          <div className={styles["admin-ai-prompt-edit-page__editor-section"]}>
            <div className={styles["admin-ai-prompt-edit-page__section-header"]}>
              <h2 className={styles["admin-ai-prompt-edit-page__section-title"]}>Nội dung Prompt</h2>
              <div className={styles["admin-ai-prompt-edit-page__section-meta"]}>
                <span className={styles["admin-ai-prompt-edit-page__char-count"]}>
                  {content.length} ký tự
                </span>
                {isDirty && <span className={styles["admin-ai-prompt-edit-page__unsaved"]}>Chưa lưu</span>}
              </div>
            </div>
            <textarea
              className={styles["admin-ai-prompt-edit-page__editor"]}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={20}
              spellCheck={false}
            />
            {prompt?.description && (
              <p className={styles["admin-ai-prompt-edit-page__desc"]}>{prompt.description}</p>
            )}
          </div>

          {/* Test panel */}
          <div className={styles["admin-ai-prompt-edit-page__test-section"]}>
            <h2 className={styles["admin-ai-prompt-edit-page__section-title"]}>Chạy thử Prompt</h2>
            <div className={styles["admin-ai-prompt-edit-page__test-input-area"]}>
              <label className={styles["admin-ai-prompt-edit-page__test-label"]}>
                Câu hỏi thử nghiệm
              </label>
              <textarea
                className={styles["admin-ai-prompt-edit-page__test-input"]}
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                rows={4}
                placeholder="Nhập câu hỏi người dùng mẫu..."
              />
              <button
                type="button"
                className={styles["admin-ai-prompt-edit-page__btn-run"]}
                onClick={handleTest}
                disabled={isTesting}
              >
                <MdPlayArrow /> {isTesting ? "Đang chạy..." : "Chạy thử"}
              </button>
            </div>

            {(testOutput !== null || isTesting) && (
              <div className={styles["admin-ai-prompt-edit-page__test-output"]}>
                <div className={styles["admin-ai-prompt-edit-page__test-output-header"]}>
                  <span className={styles["admin-ai-prompt-edit-page__test-output-label"]}>
                    Kết quả
                  </span>
                  {testLatency !== null && (
                    <span className={styles["admin-ai-prompt-edit-page__test-latency"]}>
                      {testLatency}ms
                    </span>
                  )}
                </div>
                {isTesting ? (
                  <div className={styles["admin-ai-prompt-edit-page__test-loading"]}>
                    Đang gọi AI...
                  </div>
                ) : (
                  <pre className={styles["admin-ai-prompt-edit-page__test-pre"]}>
                    {testOutput}
                  </pre>
                )}
              </div>
            )}

            {/* Compare với default */}
            {prompt?.isCustomized && (
              <details className={styles["admin-ai-prompt-edit-page__diff-details"]}>
                <summary className={styles["admin-ai-prompt-edit-page__diff-summary"]}>
                  Xem nội dung gốc (default)
                </summary>
                <pre className={styles["admin-ai-prompt-edit-page__diff-pre"]}>
                  {prompt.defaultContent}
                </pre>
              </details>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAiPromptEditPage;
