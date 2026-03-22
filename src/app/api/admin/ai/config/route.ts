/**
 * GET  /api/admin/ai/config – Lấy tất cả AI settings (category="ai")
 * PATCH /api/admin/ai/config – Upsert batch AI settings
 * Body PATCH: { settings: Record<string, string> }
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AI_CONFIG_DEFAULTS } from "@/lib/ai-config";

export const runtime = "nodejs";

const AI_SETTING_LABELS: Record<string, string> = {
  ai_enabled: "Bật/tắt AI",
  ai_model: "Model Groq",
  ai_temperature: "Temperature",
  ai_max_tokens: "Max output tokens",
  ai_timeout_ms: "Timeout (ms)",
  ai_chat_enabled: "Bật chatbot phía shop",
  ai_chat_catalog_limit: "Số SP trong context catalog",
  ai_chat_suggested_enabled: "Trả về SP gợi ý",
  ai_chat_suggested_limit: "Số SP gợi ý tối đa",
  ai_chat_fallback_message: "Tin nhắn khi AI tắt",
  ai_rate_limit_enabled: "Bật rate limiting",
  ai_rate_limit_per_user_per_day: "Giới hạn/user/ngày",
  ai_rate_limit_anonymous_per_ip: "Giới hạn ẩn danh/IP/ngày",
  ai_seo_model: "Model sinh SEO",
  ai_seo_language: "Ngôn ngữ sinh SEO content",
  ai_seo_auto_generate: "Tự động sinh khi tạo mới",
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const settings = await prisma.adminSetting.findMany({
      where: { category: "ai" },
      select: { key: true, value: true, label: true },
      orderBy: { key: "asc" },
    });

    const map: Record<string, string> = {};
    for (const s of settings) {
      map[s.key] = s.value;
    }

    // Merge defaults for keys not yet in DB
    const defaults = AI_CONFIG_DEFAULTS as unknown as Record<string, unknown>;
    for (const [key, def] of Object.entries(defaults)) {
      if (!(key in map)) {
        map[key] = String(def);
      }
    }

    return NextResponse.json({ settings: map });
  } catch (error) {
    console.error("[Admin AI Config GET Error]", error);
    return NextResponse.json({ error: "Lỗi tải cấu hình AI." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { settings?: Record<string, string> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const incoming = body.settings ?? {};
  if (Object.keys(incoming).length === 0) {
    return NextResponse.json({ error: "Không có setting nào để lưu." }, { status: 400 });
  }

  try {
    await Promise.all(
      Object.entries(incoming).map(([key, value]) =>
        prisma.adminSetting.upsert({
          where: { key },
          create: {
            key,
            value: String(value),
            label: AI_SETTING_LABELS[key] ?? key,
            category: "ai",
          },
          update: {
            value: String(value),
            label: AI_SETTING_LABELS[key] ?? key,
          },
        }),
      ),
    );

    return NextResponse.json({ success: true, updated: Object.keys(incoming).length });
  } catch (error) {
    console.error("[Admin AI Config PATCH Error]", error);
    return NextResponse.json({ error: "Lỗi lưu cấu hình AI." }, { status: 500 });
  }
}
