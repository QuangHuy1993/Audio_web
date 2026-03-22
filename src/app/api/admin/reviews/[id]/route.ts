import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ReviewModerationStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null) as { status?: string } | null;
  const nextStatus = body?.status;

  const statusByKey: Record<string, ReviewModerationStatus> = {
    PENDING: ReviewModerationStatus.PENDING,
    APPROVED: ReviewModerationStatus.APPROVED,
    HIDDEN: ReviewModerationStatus.HIDDEN,
  };
  const resolvedStatus = nextStatus ? statusByKey[nextStatus] : undefined;
  if (!resolvedStatus) {
    return NextResponse.json(
      { error: "Trạng thái đánh giá không hợp lệ." },
      { status: 400 },
    );
  }

  try {
    const updated = await prisma.review.update({
      where: { id },
      data: { status: resolvedStatus },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[Admin Reviews][PATCH] Error:", error);
    return NextResponse.json(
      { error: "Không thể cập nhật trạng thái đánh giá." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    await prisma.review.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Admin Reviews][DELETE] Error:", error);
    return NextResponse.json(
      { error: "Không thể xóa đánh giá." },
      { status: 500 },
    );
  }
}

