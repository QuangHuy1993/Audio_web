/**
 * POST /api/admin/ai/prompts/[key]/test
 * Chạy thử prompt với input mẫu, dùng model cấu hình hiện tại.
 * Body: { systemPrompt: string; userInput: string }
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { callGroqChat } from "@/lib/groq-chat";
import { getAiConfig } from "@/lib/ai-config";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { key } = await params;

  let body: { systemPrompt?: string; userInput?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const systemPrompt = body.systemPrompt?.trim();
  const userInput = body.userInput?.trim();

  if (!systemPrompt || !userInput) {
    return NextResponse.json({ error: "systemPrompt và userInput không được để trống." }, { status: 400 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Groq API key chưa được cấu hình." }, { status: 503 });
  }

  try {
    const config = await getAiConfig();
    const start = Date.now();

    const output = await callGroqChat({
      apiKey,
      model: config.ai_model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userInput },
      ],
      maxTokens: Math.min(config.ai_max_tokens, 1024),
      temperature: config.ai_temperature,
      timeoutMs: config.ai_timeout_ms,
    });

    const latencyMs = Date.now() - start;

    return NextResponse.json({
      output: output ?? "(Không có kết quả)",
      latencyMs,
      model: config.ai_model,
      promptKey: key,
    });
  } catch (error) {
    console.error("[Admin AI Prompt Test Error]", error);
    return NextResponse.json({ error: "Lỗi chạy thử prompt." }, { status: 500 });
  }
}
