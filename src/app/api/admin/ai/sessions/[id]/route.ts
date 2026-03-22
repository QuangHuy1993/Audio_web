/**
 * GET /api/admin/ai/sessions/[id]
 * Chi tiết đầy đủ một phiên AI: input, output, metadata không cắt.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const aiSession = await prisma.aiSession.findUnique({
      where: { id },
      include: { user: { select: { email: true, name: true } } },
    });

    if (!aiSession) {
      return NextResponse.json({ error: "Không tìm thấy phiên AI." }, { status: 404 });
    }

    const meta = aiSession.metadata as Record<string, unknown> | null;

    return NextResponse.json({
      id: aiSession.id,
      createdAt: aiSession.createdAt.toISOString(),
      type: aiSession.type,
      userId: aiSession.userId,
      userEmail: aiSession.user?.email ?? null,
      userName: aiSession.user?.name ?? null,
      inputFull: aiSession.input,
      outputFull: aiSession.output,
      model: aiSession.model ?? null,
      flagged: aiSession.flagged,
      flagReason: aiSession.flagReason ?? null,
      metadata: meta,
      latencyMs: typeof meta?.latencyMs === "number" ? meta.latencyMs : null,
    });
  } catch (error) {
    console.error("[Admin AI Session Detail Error]", error);
    return NextResponse.json({ error: "Lỗi tải chi tiết phiên AI." }, { status: 500 });
  }
}
