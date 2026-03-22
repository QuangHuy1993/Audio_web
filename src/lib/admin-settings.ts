/**
 * Helper functions để đọc AdminSetting từ DB.
 * Fallback về env var nếu DB không có giá trị.
 */

import { prisma } from "@/lib/prisma";

/**
 * Lấy 1 setting theo key. Fallback về envFallback nếu không có trong DB.
 */
export async function getAdminSetting(
    key: string,
    envFallback?: string,
): Promise<string | null> {
    try {
        const setting = await prisma.adminSetting.findUnique({
            where: { key },
            select: { value: true },
        });
        return setting?.value ?? envFallback ?? null;
    } catch {
        return envFallback ?? null;
    }
}
/**
 * Lấy nhiều settings theo danh sách key.
 * Returns Record<key, value>.
 */
export async function getAdminSettings(
    keys: string[],
): Promise<Record<string, string>> {
    try {
        const settings = await prisma.adminSetting.findMany({
            where: { key: { in: keys } },
            select: { key: true, value: true },
        });
        return Object.fromEntries(settings.map((s) => [s.key, s.value]));
    } catch {
        return {};
    }
}

/**
 * Lấy cấu hình ngân hàng VietQR của admin.
 * Ưu tiên DB, fallback về env var.
 */
export async function getBankConfig(): Promise<{
    bankId: string;
    accountNo: string;
    accountName: string;
}> {
    const keys = ["qr_bank_id", "qr_account_no", "qr_account_name"];
    const map = await getAdminSettings(keys);

    return {
        bankId: map["qr_bank_id"] ?? process.env.QR_BANK_ID ?? "MB",
        accountNo: map["qr_account_no"] ?? process.env.QR_ACCOUNT_NO ?? "",
        accountName: map["qr_account_name"] ?? process.env.QR_ACCOUNT_NAME ?? "",
    };
}
