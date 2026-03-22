/**
 * PUT /api/admin/ai/sessions/[id]/flag
 * Đánh dấu (flag) hoặc bỏ flag một phiên AI.
 * Body: { flagged: boolean; flagReason?: string }
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: { flagged?: boolean; flagReason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const flagged = typeof body.flagged === "boolean" ? body.flagged : true;
  const flagReason = flagged ? (body.flagReason?.trim() ?? null) : null;

  try {
    const updated = await prisma.aiSession.update({
      where: { id },
      data: { flagged, flagReason },
      select: { id: true, flagged: true, flagReason: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[Admin AI Flag Error]", error);
    return NextResponse.json({ error: "Lỗi cập nhật flag." }, { status: 500 });
  }
}
