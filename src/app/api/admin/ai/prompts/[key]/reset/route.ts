/**
 * POST /api/admin/ai/prompts/[key]/reset
 * Reset nội dung prompt về defaultContent.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PROMPTS, invalidatePromptCache } from "@/lib/ai-prompt";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { key } = await params;

  if (!DEFAULT_PROMPTS[key]) {
    return NextResponse.json({ error: "Prompt không tồn tại." }, { status: 404 });
  }

  try {
    const defaultContent = DEFAULT_PROMPTS[key].content;

    await prisma.aiPrompt.upsert({
      where: { key },
      create: {
        key,
        label: DEFAULT_PROMPTS[key].label,
        description: DEFAULT_PROMPTS[key].description,
        content: defaultContent,
        defaultContent,
        updatedByEmail: session.user.email ?? null,
      },
      update: {
        content: defaultContent,
        updatedByEmail: session.user.email ?? null,
      },
    });

    invalidatePromptCache(key);

    return NextResponse.json({ success: true, content: defaultContent });
  } catch (error) {
    console.error("[Admin AI Prompt Reset Error]", error);
    return NextResponse.json({ error: "Lỗi reset prompt." }, { status: 500 });
  }
}
