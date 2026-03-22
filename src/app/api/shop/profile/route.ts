import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserProfile, updateUserProfile } from "@/services/user-service";
import { updateAllUserPhones } from "@/services/address-service";

export async function GET() {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const profile = await getUserProfile(session.user.id);
        return NextResponse.json(profile);
    } catch (error) {
        console.error("[Profile API][GET] Error:", error);
        return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();

        const updateData: { name?: string; image?: string | null } = {};
        if (typeof body.name === "string") {
            updateData.name = body.name;
        }
        if (typeof body.image === "string" || body.image === null) {
            updateData.image = body.image ?? null;
        }

        const updated = await updateUserProfile(session.user.id, updateData);

        if (body.phone) {
            await updateAllUserPhones(session.user.id, body.phone);
        }

        return NextResponse.json(updated);
    } catch (error) {
        console.error("[Profile API][PATCH] Error:", error);
        return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }
}
