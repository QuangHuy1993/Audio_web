"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { MdSave, MdWarning } from "react-icons/md";
import { toast } from "sonner";
import styles from "./AdminAiSettingsPage.module.css";

type SettingsMap = Record<string, string>;

const GROQ_MODELS = [
  "llama-3.1-8b-instant",
  "llama-3.3-70b-versatile",
  "mixtral-8x7b-32768",
  "gemma2-9b-it",
];

const SEO_LANGUAGES = [
  { value: "vi", label: "Tiếng Việt" },
  { value: "en", label: "English" },
  { value: "bilingual", label: "Song ngữ" },
];

const AdminAiSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<SettingsMap>({});
  const [initial, setInitial] = useState<SettingsMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/ai/config");
        if (!res.ok) throw new Error();
        const data = await res.json();
        setSettings(data.settings);
        setInitial(data.settings);
      } catch {
        toast.error("Không thể tải cấu hình AI.");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const set = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const setBool = (key: string, checked: boolean) => {
    set(key, checked ? "true" : "false");
  };

  const isDirty = JSON.stringify(settings) !== JSON.stringify(initial);

  const handleSave = async () => {
    const changed: SettingsMap = {};
    for (const [k, v] of Object.entries(settings)) {
      if (initial[k] !== v) changed[k] = v;
    }
    if (Object.keys(changed).length === 0) {
      toast.info("Không có thay đổi nào để lưu.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/admin/ai/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: changed }),
      });
      if (!res.ok) throw new Error();
      setInitial({ ...settings });
      toast.success("Đã lưu cài đặt AI.");
    } catch {
      toast.error("Lỗi lưu cài đặt.");
    } finally {
      setIsSaving(false);
    }
  };

  const boolVal = (key: string, defaultVal = true) =>
    settings[key] !== undefined ? settings[key] === "true" : defaultVal;

  const numVal = (key: string, defaultVal: number) => {
    const v = settings[key];
    return v !== undefined ? v : String(defaultVal);
  };

  return (
    <div className={styles["admin-ai-settings-page"]}>
      <div className={styles["admin-ai-settings-page__header"]}>
        <div>
          <h1 className={styles["admin-ai-settings-page__title"]}>Cài đặt AI</h1>
          <p className={styles["admin-ai-settings-page__subtitle"]}>
            Cấu hình model, tham số, chatbot và rate limiting
          </p>
        </div>
        <button
          type="button"
          className={styles["admin-ai-settings-page__btn-save"]}
          onClick={handleSave}
          disabled={isSaving || !isDirty}
        >
          <MdSave /> {isSaving ? "Đang lưu..." : "Lưu cài đặt"}
        </button>
      </div>

      <nav className={styles["admin-ai-settings-page__subnav"]}>
        <Link href="/admin/ai" className={styles["admin-ai-settings-page__subnav-link"]}>Tổng quan</Link>
        <Link href="/admin/ai/sessions" className={styles["admin-ai-settings-page__subnav-link"]}>Lịch sử phiên</Link>
        <Link href="/admin/ai/content" className={styles["admin-ai-settings-page__subnav-link"]}>Nội dung AI</Link>
        <Link href="/admin/ai/settings" className={`${styles["admin-ai-settings-page__subnav-link"]} ${styles["admin-ai-settings-page__subnav-link--active"]}`}>Cài đặt</Link>
        <Link href="/admin/ai/prompts" className={styles["admin-ai-settings-page__subnav-link"]}>Prompt</Link>
        <Link href="/admin/ai/batch" className={styles["admin-ai-settings-page__subnav-link"]}>Sinh hàng loạt</Link>
        <Link href="/admin/ai/demo-products" className={styles["admin-ai-settings-page__subnav-link"]}>Sản phẩm mẫu</Link>
      </nav>

      {!boolVal("ai_enabled") && (
        <div className={styles["admin-ai-settings-page__warning-banner"]}>
          <MdWarning />
          AI đang bị tắt – chatbot phía shop sẽ trả về tin nhắn fallback.
        </div>
      )}

      {isLoading ? (
        <div className={styles["admin-ai-settings-page__loading"]}>Đang tải cấu hình...</div>
      ) : (
        <div className={styles["admin-ai-settings-page__form"]}>

          {/* Nhóm A: Model & tham số */}
          <section className={styles["admin-ai-settings-page__section"]}>
            <h2 className={styles["admin-ai-settings-page__section-title"]}>Model & Tham số chính</h2>

            <div className={styles["admin-ai-settings-page__field"]}>
              <label className={styles["admin-ai-settings-page__label"]}>
                Bật AI toàn bộ
              </label>
              <div className={styles["admin-ai-settings-page__toggle-row"]}>
                <input
                  type="checkbox"
                  id="ai_enabled"
                  checked={boolVal("ai_enabled")}
                  onChange={(e) => setBool("ai_enabled", e.target.checked)}
                  className={styles["admin-ai-settings-page__checkbox"]}
                />
                <label htmlFor="ai_enabled" className={styles["admin-ai-settings-page__toggle-label"]}>
                  {boolVal("ai_enabled") ? "Đang bật" : "Đang tắt"}
                </label>
              </div>
              <p className={styles["admin-ai-settings-page__hint"]}>Tắt sẽ trả fallback message cho toàn bộ AI chatbot phía shop.</p>
            </div>

            <div className={styles["admin-ai-settings-page__field"]}>
              <label htmlFor="ai_model" className={styles["admin-ai-settings-page__label"]}>Model Groq</label>
              <select
                id="ai_model"
                value={settings.ai_model ?? "llama-3.1-8b-instant"}
                onChange={(e) => set("ai_model", e.target.value)}
                className={styles["admin-ai-settings-page__select"]}
              >
                {GROQ_MODELS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <p className={styles["admin-ai-settings-page__hint"]}>Model dùng cho chatbot tư vấn phía shop.</p>
            </div>

            <div className={styles["admin-ai-settings-page__field"]}>
              <label htmlFor="ai_temperature" className={styles["admin-ai-settings-page__label"]}>
                Temperature: <strong>{settings.ai_temperature ?? "0.7"}</strong>
              </label>
              <input
                type="range"
                id="ai_temperature"
                min="0"
                max="1"
                step="0.05"
                value={settings.ai_temperature ?? "0.7"}
                onChange={(e) => set("ai_temperature", e.target.value)}
                className={styles["admin-ai-settings-page__range"]}
              />
              <div className={styles["admin-ai-settings-page__range-labels"]}>
                <span>0 (nhất quán)</span>
                <span>1 (sáng tạo)</span>
              </div>
            </div>

            <div className={styles["admin-ai-settings-page__row2"]}>
              <div className={styles["admin-ai-settings-page__field"]}>
                <label htmlFor="ai_max_tokens" className={styles["admin-ai-settings-page__label"]}>Max output tokens</label>
                <input
                  type="number"
                  id="ai_max_tokens"
                  value={numVal("ai_max_tokens", 512)}
                  min={128}
                  max={4096}
                  step={64}
                  onChange={(e) => set("ai_max_tokens", e.target.value)}
                  className={styles["admin-ai-settings-page__input"]}
                />
                <p className={styles["admin-ai-settings-page__hint"]}>Giới hạn độ dài trả lời (128–4096).</p>
              </div>
              <div className={styles["admin-ai-settings-page__field"]}>
                <label htmlFor="ai_timeout_ms" className={styles["admin-ai-settings-page__label"]}>Timeout (ms)</label>
                <input
                  type="number"
                  id="ai_timeout_ms"
                  value={numVal("ai_timeout_ms", 10000)}
                  min={3000}
                  max={60000}
                  step={1000}
                  onChange={(e) => set("ai_timeout_ms", e.target.value)}
                  className={styles["admin-ai-settings-page__input"]}
                />
                <p className={styles["admin-ai-settings-page__hint"]}>Hủy request nếu Groq không phản hồi (ms).</p>
              </div>
            </div>
          </section>

          {/* Nhóm B: Chatbot shop */}
          <section className={styles["admin-ai-settings-page__section"]}>
            <h2 className={styles["admin-ai-settings-page__section-title"]}>Cài đặt chatbot phía shop</h2>

            <div className={styles["admin-ai-settings-page__field"]}>
              <label className={styles["admin-ai-settings-page__label"]}>Bật chatbot shop</label>
              <div className={styles["admin-ai-settings-page__toggle-row"]}>
                <input
                  type="checkbox"
                  id="ai_chat_enabled"
                  checked={boolVal("ai_chat_enabled")}
                  onChange={(e) => setBool("ai_chat_enabled", e.target.checked)}
                  className={styles["admin-ai-settings-page__checkbox"]}
                />
                <label htmlFor="ai_chat_enabled" className={styles["admin-ai-settings-page__toggle-label"]}>
                  {boolVal("ai_chat_enabled") ? "Đang bật" : "Đang tắt"}
                </label>
              </div>
            </div>

            <div className={styles["admin-ai-settings-page__row2"]}>
              <div className={styles["admin-ai-settings-page__field"]}>
                <label htmlFor="ai_chat_catalog_limit" className={styles["admin-ai-settings-page__label"]}>Số SP trong context</label>
                <input
                  type="number"
                  id="ai_chat_catalog_limit"
                  value={numVal("ai_chat_catalog_limit", 30)}
                  min={5}
                  max={100}
                  onChange={(e) => set("ai_chat_catalog_limit", e.target.value)}
                  className={styles["admin-ai-settings-page__input"]}
                />
                <p className={styles["admin-ai-settings-page__hint"]}>Số sản phẩm fetch để build catalog trong system prompt.</p>
              </div>
              <div className={styles["admin-ai-settings-page__field"]}>
                <label htmlFor="ai_chat_suggested_limit" className={styles["admin-ai-settings-page__label"]}>Số SP gợi ý tối đa</label>
                <input
                  type="number"
                  id="ai_chat_suggested_limit"
                  value={numVal("ai_chat_suggested_limit", 3)}
                  min={1}
                  max={10}
                  onChange={(e) => set("ai_chat_suggested_limit", e.target.value)}
                  className={styles["admin-ai-settings-page__input"]}
                />
              </div>
            </div>

            <div className={styles["admin-ai-settings-page__field"]}>
              <label className={styles["admin-ai-settings-page__label"]}>Trả về SP gợi ý</label>
              <div className={styles["admin-ai-settings-page__toggle-row"]}>
                <input
                  type="checkbox"
                  id="ai_chat_suggested_enabled"
                  checked={boolVal("ai_chat_suggested_enabled")}
                  onChange={(e) => setBool("ai_chat_suggested_enabled", e.target.checked)}
                  className={styles["admin-ai-settings-page__checkbox"]}
                />
                <label htmlFor="ai_chat_suggested_enabled" className={styles["admin-ai-settings-page__toggle-label"]}>
                  {boolVal("ai_chat_suggested_enabled") ? "Đang bật" : "Đang tắt"}
                </label>
              </div>
              <p className={styles["admin-ai-settings-page__hint"]}>Khi bật, chatbot sẽ kèm card sản phẩm gợi ý khi phát hiện keyword phối ghép/so sánh.</p>
            </div>

            <div className={styles["admin-ai-settings-page__field"]}>
              <label htmlFor="ai_chat_fallback_message" className={styles["admin-ai-settings-page__label"]}>Tin nhắn khi AI tắt</label>
              <textarea
                id="ai_chat_fallback_message"
                value={settings.ai_chat_fallback_message ?? ""}
                onChange={(e) => set("ai_chat_fallback_message", e.target.value)}
                className={styles["admin-ai-settings-page__textarea"]}
                rows={3}
              />
              <p className={styles["admin-ai-settings-page__hint"]}>Hiển thị khi ai_enabled = false hoặc ai_chat_enabled = false.</p>
            </div>
          </section>

          {/* Nhóm C: Rate limiting */}
          <section className={styles["admin-ai-settings-page__section"]}>
            <h2 className={styles["admin-ai-settings-page__section-title"]}>Rate Limiting (bảo vệ quota Groq)</h2>

            <div className={styles["admin-ai-settings-page__field"]}>
              <label className={styles["admin-ai-settings-page__label"]}>Bật rate limiting</label>
              <div className={styles["admin-ai-settings-page__toggle-row"]}>
                <input
                  type="checkbox"
                  id="ai_rate_limit_enabled"
                  checked={boolVal("ai_rate_limit_enabled", false)}
                  onChange={(e) => setBool("ai_rate_limit_enabled", e.target.checked)}
                  className={styles["admin-ai-settings-page__checkbox"]}
                />
                <label htmlFor="ai_rate_limit_enabled" className={styles["admin-ai-settings-page__toggle-label"]}>
                  {boolVal("ai_rate_limit_enabled", false) ? "Đang bật" : "Đang tắt"}
                </label>
              </div>
            </div>

            <div className={styles["admin-ai-settings-page__row2"]}>
              <div className={styles["admin-ai-settings-page__field"]}>
                <label htmlFor="ai_rate_limit_per_user_per_day" className={styles["admin-ai-settings-page__label"]}>Giới hạn/user/ngày</label>
                <input
                  type="number"
                  id="ai_rate_limit_per_user_per_day"
                  value={numVal("ai_rate_limit_per_user_per_day", 50)}
                  min={1}
                  max={1000}
                  onChange={(e) => set("ai_rate_limit_per_user_per_day", e.target.value)}
                  className={styles["admin-ai-settings-page__input"]}
                />
              </div>
              <div className={styles["admin-ai-settings-page__field"]}>
                <label htmlFor="ai_rate_limit_anonymous_per_ip" className={styles["admin-ai-settings-page__label"]}>Giới hạn ẩn danh/IP</label>
                <input
                  type="number"
                  id="ai_rate_limit_anonymous_per_ip"
                  value={numVal("ai_rate_limit_anonymous_per_ip", 10)}
                  min={1}
                  max={200}
                  onChange={(e) => set("ai_rate_limit_anonymous_per_ip", e.target.value)}
                  className={styles["admin-ai-settings-page__input"]}
                />
              </div>
            </div>
          </section>

          {/* Nhóm D: Sinh SEO */}
          <section className={styles["admin-ai-settings-page__section"]}>
            <h2 className={styles["admin-ai-settings-page__section-title"]}>Cài đặt sinh nội dung SEO/AI</h2>

            <div className={styles["admin-ai-settings-page__row2"]}>
              <div className={styles["admin-ai-settings-page__field"]}>
                <label htmlFor="ai_seo_model" className={styles["admin-ai-settings-page__label"]}>Model sinh SEO</label>
                <select
                  id="ai_seo_model"
                  value={settings.ai_seo_model ?? "llama-3.1-8b-instant"}
                  onChange={(e) => set("ai_seo_model", e.target.value)}
                  className={styles["admin-ai-settings-page__select"]}
                >
                  {GROQ_MODELS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className={styles["admin-ai-settings-page__field"]}>
                <label htmlFor="ai_seo_language" className={styles["admin-ai-settings-page__label"]}>Ngôn ngữ sinh content</label>
                <select
                  id="ai_seo_language"
                  value={settings.ai_seo_language ?? "vi"}
                  onChange={(e) => set("ai_seo_language", e.target.value)}
                  className={styles["admin-ai-settings-page__select"]}
                >
                  {SEO_LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles["admin-ai-settings-page__field"]}>
              <label className={styles["admin-ai-settings-page__label"]}>Tự động sinh khi tạo mới</label>
              <div className={styles["admin-ai-settings-page__toggle-row"]}>
                <input
                  type="checkbox"
                  id="ai_seo_auto_generate"
                  checked={boolVal("ai_seo_auto_generate", false)}
                  onChange={(e) => setBool("ai_seo_auto_generate", e.target.checked)}
                  className={styles["admin-ai-settings-page__checkbox"]}
                />
                <label htmlFor="ai_seo_auto_generate" className={styles["admin-ai-settings-page__toggle-label"]}>
                  {boolVal("ai_seo_auto_generate", false) ? "Đang bật" : "Đang tắt"}
                </label>
              </div>
              <p className={styles["admin-ai-settings-page__hint"]}>Tự động gọi AI sinh SEO khi admin tạo Product/Brand/Category mới.</p>
            </div>
          </section>

          <div className={styles["admin-ai-settings-page__save-row"]}>
            <button
              type="button"
              className={styles["admin-ai-settings-page__btn-save"]}
              onClick={handleSave}
              disabled={isSaving || !isDirty}
            >
              <MdSave /> {isSaving ? "Đang lưu..." : "Lưu cài đặt"}
            </button>
            {isDirty && (
              <span className={styles["admin-ai-settings-page__unsaved-hint"]}>
                Có thay đổi chưa lưu
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAiSettingsPage;
