/**
 * GET /api/admin/ai/prompts/[key]  – Chi tiết 1 prompt
 * PUT /api/admin/ai/prompts/[key]  – Cập nhật content
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PROMPTS, invalidatePromptCache } from "@/lib/ai-prompt";

export const runtime = "nodejs";

export async function GET(
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
    const db = await prisma.aiPrompt.findUnique({ where: { key } });
    const def = DEFAULT_PROMPTS[key];

    return NextResponse.json({
      key,
      label: db?.label ?? def.label,
      description: db?.description ?? def.description,
      content: db?.content ?? def.content,
      defaultContent: db?.defaultContent ?? def.content,
      isCustomized: !!db && db.content !== db.defaultContent,
      updatedAt: db?.updatedAt?.toISOString() ?? null,
      updatedByEmail: db?.updatedByEmail ?? null,
    });
  } catch (error) {
    console.error("[Admin AI Prompt GET Error]", error);
    return NextResponse.json({ error: "Lỗi tải prompt." }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
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

  let body: { content?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const content = body.content?.trim();
  if (!content) {
    return NextResponse.json({ error: "Nội dung prompt không được để trống." }, { status: 400 });
  }

  try {
    const def = DEFAULT_PROMPTS[key];
    const updated = await prisma.aiPrompt.upsert({
      where: { key },
      create: {
        key,
        label: def.label,
        description: def.description,
        content,
        defaultContent: def.content,
        updatedByEmail: session.user.email ?? null,
      },
      update: {
        content,
        updatedByEmail: session.user.email ?? null,
      },
    });

    invalidatePromptCache(key);

    return NextResponse.json({
      key: updated.key,
      content: updated.content,
      updatedAt: updated.updatedAt.toISOString(),
      updatedByEmail: updated.updatedByEmail,
    });
  } catch (error) {
    console.error("[Admin AI Prompt PUT Error]", error);
    return NextResponse.json({ error: "Lỗi lưu prompt." }, { status: 500 });
  }
}
