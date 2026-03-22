import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** GET /api/admin/settings/[key] – Lấy 1 setting theo key */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ key: string }> },
) {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { key } = await params;
    const setting = await prisma.adminSetting.findUnique({
        where: { key },
    });

    if (!setting) {
        return NextResponse.json({ error: "Setting not found" }, { status: 404 });
    }

    return NextResponse.json(setting);
}

/** PUT /api/admin/settings/[key] – Cập nhật value của setting */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ key: string }> },
) {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: {
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

    if (!body.value) {
        return NextResponse.json(
            { error: "value là bắt buộc" },
            { status: 400 },
        );
    }

    try {
        const { key } = await params;
        const updated = await prisma.adminSetting.update({
            where: { key },
            data: {
                value: body.value,
                ...(body.label !== undefined && { label: body.label }),
                ...(body.description !== undefined && { description: body.description }),
                ...(body.category !== undefined && { category: body.category }),
            },
        });

        return NextResponse.json(updated);
    } catch {
        return NextResponse.json({ error: "Setting not found" }, { status: 404 });
    }
}

/** DELETE /api/admin/settings/[key] – Xóa setting */
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ key: string }> },
) {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const { key } = await params;
        await prisma.adminSetting.delete({ where: { key } });
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: "Setting not found" }, { status: 404 });
    }
}
