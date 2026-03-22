import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** GET /api/admin/settings?category=payment – Lấy tất cả settings, có thể lọc theo category */
export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    const settings = await prisma.adminSetting.findMany({
        where: category ? { category } : undefined,
        orderBy: [{ category: "asc" }, { key: "asc" }],
    });

    return NextResponse.json(settings);
}

/** POST /api/admin/settings – Tạo hoặc cập nhật (upsert) setting */
export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: {
        key: string;
        value: string;
        label?: string;
        description?: string;
        category?: string;
    };

    try {
        body = (await request.json()) as typeof body;
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!body.key || !body.value) {
        return NextResponse.json(
            { error: "key và value là bắt buộc" },
            { status: 400 },
        );
    }

    const updated = await prisma.adminSetting.upsert({
        where: { key: body.key },
        update: {
            value: body.value,
            label: body.label,
            description: body.description,
            category: body.category ?? "general",
        },
        create: {
            key: body.key,
            value: body.value,
            label: body.label,
            description: body.description,
            category: body.category ?? "general",
        },
    });

    return NextResponse.json(updated, { status: 201 });
}
