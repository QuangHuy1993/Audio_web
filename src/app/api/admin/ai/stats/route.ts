/**
 * GET /api/admin/ai/stats
 *
 * Thống kê tổng quan hoạt động AI cho admin dashboard.
 * Trả về: stat cards (today/month), chart 7 ngày theo type,
 * PieChart phân bổ type, avgLatency, flaggedRate, 10 phiên gần nhất.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AiSessionType } from "@prisma/client";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const now = new Date();

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(todayStart.getDate() - 1);

    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      todayCount,
      yesterdayCount,
      monthCount,
      lastMonthCount,
      flaggedCount,
      allSessionsForStats,
      recentSessions,
    ] = await Promise.all([
      prisma.aiSession.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.aiSession.count({
        where: { createdAt: { gte: yesterdayStart, lt: todayStart } },
      }),
      prisma.aiSession.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.aiSession.count({
        where: { createdAt: { gte: lastMonthStart, lt: lastMonthEnd } },
      }),
      prisma.aiSession.count({ where: { flagged: true } }),
      prisma.aiSession.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: {
          createdAt: true,
          type: true,
          metadata: true,
          flagged: true,
        },
      }),
      prisma.aiSession.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          type: true,
          input: true,
          model: true,
          flagged: true,
          metadata: true,
          user: { select: { email: true } },
        },
      }),
    ]);

    // Chart 7 ngày
    const chartMap: Record<string, Record<AiSessionType, number>> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(sevenDaysAgo.getDate() + i);
      const key = d.toISOString().split("T")[0];
      chartMap[key] = { ADVICE: 0, RECOMMENDATION: 0, COMPARISON: 0, SEARCH: 0 };
    }

    let totalLatencyMs = 0;
    let latencyCount = 0;
    let suggestedCount = 0;

    for (const s of allSessionsForStats) {
      const dateKey = s.createdAt.toISOString().split("T")[0];
      if (chartMap[dateKey]) {
        chartMap[dateKey][s.type]++;
      }
      const meta = s.metadata as Record<string, unknown> | null;
      if (meta) {
        if (typeof meta.latencyMs === "number") {
          totalLatencyMs += meta.latencyMs;
          latencyCount++;
        }
        const sp = meta.suggestedProductsCount ?? meta.suggestedCount ?? meta.recommendedCount;
        if (typeof sp === "number" && sp > 0) {
          suggestedCount++;
        }
      }
    }

    const chartData = Object.entries(chartMap).map(([date, counts]) => ({
      date,
      ...counts,
    }));

    // Type breakdown for PieChart
    const typeBreakdown: Record<AiSessionType, number> = {
      ADVICE: 0,
      RECOMMENDATION: 0,
      COMPARISON: 0,
      SEARCH: 0,
    };
    for (const s of allSessionsForStats) {
      typeBreakdown[s.type]++;
    }

    const totalIn7Days = allSessionsForStats.length;
    const avgLatencyMs = latencyCount > 0 ? Math.round(totalLatencyMs / latencyCount) : 0;
    const suggestedProductsRate =
      totalIn7Days > 0 ? Math.round((suggestedCount / totalIn7Days) * 100) / 100 : 0;
    const flaggedRate =
      monthCount > 0 ? Math.round((flaggedCount / monthCount) * 10000) / 10000 : 0;

    return NextResponse.json({
      todayCount,
      yesterdayCount,
      monthCount,
      lastMonthCount,
      flaggedCount,
      avgLatencyMs,
      suggestedProductsRate,
      flaggedRate,
      chartData,
      typeBreakdown,
      recentSessions: recentSessions.map((s) => {
        const meta = s.metadata as Record<string, unknown> | null;
        return {
          id: s.id,
          createdAt: s.createdAt.toISOString(),
          type: s.type,
          userEmail: s.user?.email ?? null,
          inputPreview: s.input.slice(0, 100),
          model: s.model ?? null,
          latencyMs: typeof meta?.latencyMs === "number" ? meta.latencyMs : null,
          flagged: s.flagged,
        };
      }),
    });
  } catch (error) {
    console.error("[Admin AI Stats Error]", error);
    return NextResponse.json({ error: "Lỗi tải thống kê AI." }, { status: 500 });
  }
}
