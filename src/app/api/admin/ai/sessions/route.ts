/**
 * GET /api/admin/ai/sessions
 *
 * Danh sách AiSession với filter: type, dateFrom/dateTo, search (input ILIKE),
 * flagged, page/limit. Sort mặc định createdAt DESC.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AiSessionType, Prisma } from "@prisma/client";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 20;

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);

  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? String(DEFAULT_LIMIT))));
  const skip = (page - 1) * limit;

  const typeParam = searchParams.get("type");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const search = searchParams.get("search")?.trim() ?? "";
  const flaggedParam = searchParams.get("flagged");
  const modelParam = searchParams.get("model")?.trim() ?? "";

  const typeFilter: AiSessionType[] = [];
  if (typeParam) {
    for (const t of typeParam.split(",")) {
      const trimmed = t.trim().toUpperCase();
      if (["ADVICE", "RECOMMENDATION", "COMPARISON", "SEARCH"].includes(trimmed)) {
        typeFilter.push(trimmed as AiSessionType);
      }
    }
  }

  const where: Prisma.AiSessionWhereInput = {};

  if (typeFilter.length > 0) {
    where.type = { in: typeFilter };
  }
  if (dateFrom) {
    where.createdAt = { ...((where.createdAt as object) ?? {}), gte: new Date(dateFrom) };
  }
  if (dateTo) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    where.createdAt = { ...((where.createdAt as object) ?? {}), lte: end };
  }
  if (search) {
    where.input = { contains: search, mode: "insensitive" };
  }
  if (flaggedParam === "true") {
    where.flagged = true;
  }
  if (modelParam) {
    where.model = { contains: modelParam, mode: "insensitive" };
  }

  try {
    const [items, total] = await Promise.all([
      prisma.aiSession.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          createdAt: true,
          type: true,
          input: true,
          model: true,
          flagged: true,
          flagReason: true,
          metadata: true,
          user: { select: { email: true } },
          userId: true,
        },
      }),
      prisma.aiSession.count({ where }),
    ]);

    return NextResponse.json({
      items: items.map((s) => {
        const meta = s.metadata as Record<string, unknown> | null;
        return {
          id: s.id,
          createdAt: s.createdAt.toISOString(),
          type: s.type,
          userId: s.userId,
          userEmail: s.user?.email ?? null,
          inputPreview: s.input.slice(0, 120),
          model: s.model ?? null,
          latencyMs: typeof meta?.latencyMs === "number" ? meta.latencyMs : null,
          flagged: s.flagged,
          flagReason: s.flagReason ?? null,
          hasSuggestedProducts: (() => {
            const sp =
              (meta?.suggestedProductsCount as number | undefined) ??
              (meta?.suggestedCount as number | undefined) ??
              (meta?.recommendedCount as number | undefined);
            return typeof sp === "number" && sp > 0;
          })(),
        };
      }),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("[Admin AI Sessions List Error]", error);
    return NextResponse.json({ error: "Lỗi tải danh sách phiên AI." }, { status: 500 });
  }
}
