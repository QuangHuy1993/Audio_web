/**
 * GET /api/admin/ai/prompts
 * Danh sách tất cả prompts – từ DB (nếu có) merged với DEFAULT_PROMPTS.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PROMPTS } from "@/lib/ai-prompt";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const dbPrompts = await prisma.aiPrompt.findMany({
      select: { key: true, label: true, description: true, content: true, defaultContent: true, updatedAt: true, updatedByEmail: true },
    });

    const dbMap = new Map(dbPrompts.map((p) => [p.key, p]));

    const prompts = Object.entries(DEFAULT_PROMPTS).map(([key, def]) => {
      const db = dbMap.get(key);
      return {
        key,
        label: db?.label ?? def.label,
        description: db?.description ?? def.description,
        content: db?.content ?? def.content,
        defaultContent: db?.defaultContent ?? def.content,
        isCustomized: !!db && db.content !== db.defaultContent,
        updatedAt: db?.updatedAt?.toISOString() ?? null,
        updatedByEmail: db?.updatedByEmail ?? null,
      };
    });

    return NextResponse.json({ prompts });
  } catch (error) {
    console.error("[Admin AI Prompts List Error]", error);
    return NextResponse.json({ error: "Lỗi tải danh sách prompts." }, { status: 500 });
  }
}
