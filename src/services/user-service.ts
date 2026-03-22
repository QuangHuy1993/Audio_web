import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export type UpdateProfileDto = {
    name?: string;
    image?: string | null;
};

/**
 * Lấy thông tin cơ bản của người dùng
 */
export async function getUserProfile(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
            createdAt: true,
            passwordHash: true,
            addresses: {
                where: { isDefault: true },
                take: 1,
            },
        },
    });

    if (!user) return null;

    const { passwordHash, ...rest } = user;
    return {
        ...rest,
        hasPassword: !!passwordHash,
    };
}

/**
 * Cập nhật thông tin người dùng
 */
export async function updateUserProfile(userId: string, data: UpdateProfileDto) {
    return prisma.user.update({
        where: { id: userId },
        data: {
            name: data.name,
            image: data.image,
        },
    });
}

/**
 * Đổi mật khẩu người dùng
 */
export async function changeUserPassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true },
    });

    if (!user) {
        throw new Error("Người dùng không tồn tại.");
    }

    // Nếu người dùng đăng ký qua OAuth và chưa có mật khẩu, chúng ta có thể cho phép thiết lập mật khẩu mới
    // hoặc yêu cầu họ thực hiện qua luồng quên mật khẩu/thiết lập mật khẩu lần đầu.
    // Ở đây, nếu có passwordHash, chúng ta kiểm tra nó.
    if (user.passwordHash) {
        const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isMatch) {
            throw new Error("Mật khẩu hiện tại không chính xác.");
        }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    return prisma.user.update({
        where: { id: userId },
        data: {
            passwordHash: hashedPassword,
        },
    });
}
