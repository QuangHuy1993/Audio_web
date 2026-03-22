/**
 * Helper đọc cấu hình AI từ AdminSetting (category = "ai").
 * Fallback về env var hoặc giá trị mặc định khi key chưa có trong DB.
 *
 * Các key được hỗ trợ:
 *   ai_enabled            - "true" | "false"
 *   ai_model              - tên model Groq
 *   ai_temperature        - số thực 0.0–1.0
 *   ai_max_tokens         - số nguyên
 *   ai_timeout_ms         - số nguyên ms
 *   ai_chat_enabled       - "true" | "false"
 *   ai_chat_catalog_limit - số nguyên
 *   ai_chat_suggested_enabled - "true" | "false"
 *   ai_chat_suggested_limit   - số nguyên
 *   ai_chat_fallback_message  - string
 *   ai_rate_limit_enabled            - "true" | "false"
 *   ai_rate_limit_per_user_per_day   - số nguyên
 *   ai_rate_limit_anonymous_per_ip   - số nguyên
 *   ai_seo_model          - tên model Groq cho sinh SEO
 *   ai_seo_language       - "vi" | "en" | "bilingual"
 *   ai_seo_auto_generate  - "true" | "false"
 */

import { prisma } from "@/lib/prisma";

export type AiConfig = {
  ai_enabled: boolean;
  ai_model: string;
  ai_temperature: number;
  ai_max_tokens: number;
  ai_timeout_ms: number;
  ai_chat_enabled: boolean;
  ai_chat_catalog_limit: number;
  ai_chat_suggested_enabled: boolean;
  ai_chat_suggested_limit: number;
  ai_chat_fallback_message: string;
  ai_rate_limit_enabled: boolean;
  ai_rate_limit_per_user_per_day: number;
  ai_rate_limit_anonymous_per_ip: number;
  ai_seo_model: string;
  ai_seo_language: string;
  ai_seo_auto_generate: boolean;
};

const AI_CONFIG_DEFAULTS: AiConfig = {
  ai_enabled: true,
  ai_model: "llama-3.1-8b-instant",
  ai_temperature: 0.7,
  ai_max_tokens: 512,
  ai_timeout_ms: 10000,
  ai_chat_enabled: true,
  ai_chat_catalog_limit: 30,
  ai_chat_suggested_enabled: true,
  ai_chat_suggested_limit: 3,
  ai_chat_fallback_message: "Tính năng tư vấn AI tạm thời không khả dụng. Vui lòng liên hệ hotline 1900889900 để được hỗ trợ.",
  ai_rate_limit_enabled: false,
  ai_rate_limit_per_user_per_day: 50,
  ai_rate_limit_anonymous_per_ip: 10,
  ai_seo_model: "llama-3.1-8b-instant",
  ai_seo_language: "vi",
  ai_seo_auto_generate: false,
};

/**
 * Đọc tất cả AI settings từ DB.
 * Trả về object với fallback về defaults cho key chưa có.
 * Không cache – dùng cho server actions hoặc API handlers.
 */
export async function getAiConfig(): Promise<AiConfig> {
  try {
    const settings = await prisma.adminSetting.findMany({
      where: { category: "ai" },
      select: { key: true, value: true },
    });

    const map: Record<string, string> = {};
    for (const s of settings) {
      map[s.key] = s.value;
    }

    return {
      ai_enabled: parseBoolean(map.ai_enabled, AI_CONFIG_DEFAULTS.ai_enabled),
      ai_model: map.ai_model ?? process.env.GROQ_MODEL_NAME ?? AI_CONFIG_DEFAULTS.ai_model,
      ai_temperature: parseFloat(map.ai_temperature ?? "") || AI_CONFIG_DEFAULTS.ai_temperature,
      ai_max_tokens: parseInt(map.ai_max_tokens ?? "", 10) || AI_CONFIG_DEFAULTS.ai_max_tokens,
      ai_timeout_ms: parseInt(map.ai_timeout_ms ?? "", 10) || AI_CONFIG_DEFAULTS.ai_timeout_ms,
      ai_chat_enabled: parseBoolean(map.ai_chat_enabled, AI_CONFIG_DEFAULTS.ai_chat_enabled),
      ai_chat_catalog_limit: parseInt(map.ai_chat_catalog_limit ?? "", 10) || AI_CONFIG_DEFAULTS.ai_chat_catalog_limit,
      ai_chat_suggested_enabled: parseBoolean(map.ai_chat_suggested_enabled, AI_CONFIG_DEFAULTS.ai_chat_suggested_enabled),
      ai_chat_suggested_limit: parseInt(map.ai_chat_suggested_limit ?? "", 10) || AI_CONFIG_DEFAULTS.ai_chat_suggested_limit,
      ai_chat_fallback_message: map.ai_chat_fallback_message ?? AI_CONFIG_DEFAULTS.ai_chat_fallback_message,
      ai_rate_limit_enabled: parseBoolean(map.ai_rate_limit_enabled, AI_CONFIG_DEFAULTS.ai_rate_limit_enabled),
      ai_rate_limit_per_user_per_day: parseInt(map.ai_rate_limit_per_user_per_day ?? "", 10) || AI_CONFIG_DEFAULTS.ai_rate_limit_per_user_per_day,
      ai_rate_limit_anonymous_per_ip: parseInt(map.ai_rate_limit_anonymous_per_ip ?? "", 10) || AI_CONFIG_DEFAULTS.ai_rate_limit_anonymous_per_ip,
      ai_seo_model: map.ai_seo_model ?? AI_CONFIG_DEFAULTS.ai_seo_model,
      ai_seo_language: map.ai_seo_language ?? AI_CONFIG_DEFAULTS.ai_seo_language,
      ai_seo_auto_generate: parseBoolean(map.ai_seo_auto_generate, AI_CONFIG_DEFAULTS.ai_seo_auto_generate),
    };
  } catch {
    return { ...AI_CONFIG_DEFAULTS };
  }
}

/**
 * Trả về raw string map cho UI form (không parse thành typed values).
 */
export async function getAiConfigRaw(): Promise<Record<string, string>> {
  try {
    const settings = await prisma.adminSetting.findMany({
      where: { category: "ai" },
      select: { key: true, value: true },
    });
    const map: Record<string, string> = {};
    for (const s of settings) {
      map[s.key] = s.value;
    }
    return map;
  } catch {
    return {};
  }
}

export { AI_CONFIG_DEFAULTS };

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value === "true";
}
