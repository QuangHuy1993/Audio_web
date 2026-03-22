import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { changeUserPassword } from "@/services/user-service";

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { currentPassword, newPassword } = await request.json();

        if (!currentPassword || !newPassword) {
            return NextResponse.json(
                { error: "Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới." },
                { status: 400 }
            );
        }

        if (newPassword.length < 8) {
            return NextResponse.json(
                { error: "Mật khẩu mới phải có ít nhất 8 ký tự." },
                { status: 400 }
            );
        }

        await changeUserPassword(session.user.id, currentPassword, newPassword);

        return NextResponse.json({ message: "Đổi mật khẩu thành công!" });
    } catch (error: any) {
        console.error("[ChangePassword API] Error:", error);
        return NextResponse.json(
            { error: error.message || "Không thể đổi mật khẩu. Vui lòng thử lại sau." },
            { status: 400 }
        );
    }
}
