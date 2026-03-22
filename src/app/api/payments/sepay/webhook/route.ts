import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { commitOrderFromSession } from "@/services/checkout-session-service";

export const runtime = "nodejs";

// Kiểu dữ liệu SePay webhook gửi về
interface SePayWebhookPayload {
    id: number;             // ID giao dịch SePay – dùng chống duplicate
    gateway: string;        // Tên ngân hàng
    transactionDate: string;// Thời gian giao dịch
    accountNumber: string;  // STK nhận
    code: string | null;    // Mã SePay tự nhận diện
    content: string;        // Toàn bộ nội dung chuyển khoản
    transferType: string;   // "in" | "out"
    transferAmount: number; // Số tiền
    accumulated: number;    // Số dư lũy kế
    subAccount: string | null;
    referenceCode: string;  // Mã tham chiếu SMS ngân hàng
    description: string;
}

export async function POST(request: NextRequest) {
    // ── BƯỚC 1: Parse payload ──
    let payload: SePayWebhookPayload;
    try {
        payload = (await request.json()) as SePayWebhookPayload;
    } catch {
        // Không parse được → trả 200 để SePay không retry vô ích
        return NextResponse.json({ success: false, message: "Invalid JSON" }, { status: 200 });
    }

    // ── BƯỚC 2: Validate các field bắt buộc ──
    if (
        typeof payload.id !== "number" ||
        !payload.id ||
        typeof payload.transferAmount !== "number" ||
        payload.transferAmount <= 0 ||
        !payload.transferType ||
        !payload.accountNumber
    ) {
        console.warn("[SePay Webhook] Payload thiếu field bắt buộc:", JSON.stringify(payload).slice(0, 200));
        return NextResponse.json({ success: true, message: "Invalid payload – ignored" }, { status: 200 });
    }

    // ── BƯỚC 3: Chỉ xử lý giao dịch tiền VÀO ──
    if (payload.transferType !== "in") {
        return NextResponse.json({ success: true, message: "Outgoing transaction – ignored" }, { status: 200 });
    }

    // ── BƯỚC 4: Validate đúng STK của shop ──
    // Thông qua bảng AdminSetting
    const qrAccountSetting = await prisma.adminSetting.findUnique({
        where: { key: "qr_account_no" }
    });
    const expectedAccountNo = qrAccountSetting?.value?.trim() || process.env.QR_ACCOUNT_NO?.trim();

    if (expectedAccountNo && payload.accountNumber !== expectedAccountNo) {
        // Không phải STK của shop – bỏ qua, không cần retry
        return NextResponse.json({ success: true, message: "Account not monitored" }, { status: 200 });
    }

    // ── BƯỚC 5: Tìm mã providerRef trong nội dung chuyển khoản ──
    // Ưu tiên field "code" (SePay đã nhận diện tự động từ content)
    let matchRef: string | null = payload.code?.trim()?.toUpperCase() ?? null;

    // Fallback: dùng regex tìm trong "content" nếu code null/empty
    if (!matchRef && payload.content) {
        // DUA + 14 chữ số (yyyyMMddHHmmss) + 4 ký tự [A-Z0-9] = 22 ký tự
        const found = payload.content.match(/\bDUA[0-9]{14}[A-Z0-9]{4}\b/i);
        matchRef = found?.[0]?.toUpperCase() ?? null;
    }

    if (!matchRef) {
        // Không phải giao dịch của hệ thống này – bỏ qua yên lặng
        console.log("[SePay Webhook] Bỏ qua: không tìm thấy mã DUA trong content:", payload.content?.slice(0, 100));
        return NextResponse.json({ success: true, message: "No matching payment code" }, { status: 200 });
    }

    // ── BƯỚC 6: Tìm CheckoutSession theo providerRef ──
    // findUnique vì providerRef có @unique index → O(1)
    const session = await prisma.checkoutSession.findUnique({
        where: { providerRef: matchRef },
        select: {
            id: true,
            status: true,
            amount: true,
            expiresAt: true,
            userId: true,
            orderId: true,
            providerPayload: true,
        },
    });

    if (!session) {
        // Mã DUA tìm thấy nhưng không có session tương ứng – bỏ qua
        console.log(`[SePay Webhook] Không tìm thấy session với providerRef=${matchRef}`);
        return NextResponse.json({ success: true, message: "Session not found" }, { status: 200 });
    }

    // ── BƯỚC 7: Idempotency – tránh xử lý 2 lần ──
    if (session.status === "SUCCEEDED") {
        console.log(`[SePay Webhook] Session ${session.id} đã SUCCEEDED, bỏ qua.`);
        return NextResponse.json({ success: true, message: "Already processed" }, { status: 200 });
    }

    if (session.status === "FAILED" || session.status === "CANCELLED") {
        console.log(`[SePay Webhook] Session ${session.id} status=${session.status}, bỏ qua.`);
        return NextResponse.json({ success: true, message: "Session not active" }, { status: 200 });
    }

    // Chống duplicate: kiểm tra sePayId đã được lưu trong providerPayload chưa
    const existingPayload = session.providerPayload as { sePayId?: number } | null;
    if (existingPayload?.sePayId === payload.id) {
        console.log(`[SePay Webhook] Duplicate sePayId=${payload.id} cho session ${session.id}`);
        return NextResponse.json({ success: true, message: "Duplicate transaction" }, { status: 200 });
    }

    // ── BƯỚC 8: Validate số tiền khớp ──
    // Cho phép sai lệch ≤ 1500 VND (do làm tròn/phí nhỏ)
    const expectedAmount = Number(session.amount);
    const receivedAmount = payload.transferAmount;
    const amountDiff = Math.abs(expectedAmount - receivedAmount);

    if (amountDiff > 1500) {
        console.warn(
            `[SePay Webhook] Amount mismatch: expected=${expectedAmount}, received=${receivedAmount}`,
            { sessionId: session.id, sePayId: payload.id }
        );
        // Ghi nhận để admin review, không retry SePay
        await prisma.checkoutSession.update({
            where: { id: session.id },
            data: {
                providerPayload: {
                    sePayId: payload.id,
                    receivedAmount,
                    expectedAmount,
                    error: "AMOUNT_MISMATCH",
                    content: payload.content,
                    referenceCode: payload.referenceCode,
                    raw: payload as any,
                },
            },
        });
        return NextResponse.json({ success: true, message: "Amount mismatch – pending manual review" }, { status: 200 });
    }

    // ── BƯỚC 9: Xử lý trường hợp session EXPIRED nhưng tiền đã về ──
    const now = new Date();
    const isExpired = session.expiresAt < now;
    if (isExpired) {
        console.warn(`[SePay Webhook] Late payment: session ${session.id} đã hết hạn nhưng tiền vẫn về – sẽ commit.`);
    }

    // ── BƯỚC 10: Lưu raw payload vào DB (audit trail) trước khi commit ──
    await prisma.checkoutSession.update({
        where: { id: session.id },
        data: {
            providerPayload: {
                sePayId: payload.id,
                gateway: payload.gateway,
                transactionDate: payload.transactionDate,
                transferAmount: payload.transferAmount,
                referenceCode: payload.referenceCode,
                content: payload.content,
                ...(isExpired ? { latePayment: true } : {}),
            },
        },
    });

    // ── BƯỚC 11: Commit Order từ CheckoutSession ──
    let result: { orderId: string } | null = null;
    try {
        result = await commitOrderFromSession(session.id);
    } catch (err) {
        console.error("[SePay Webhook] commitOrderFromSession thất bại:", err, { sessionId: session.id });
        // Trả 500 → SePay sẽ retry (lỗi server, không phải lỗi logic)
        return NextResponse.json(
            { success: false, message: "Server error during order commit" },
            { status: 500 }
        );
    }

    if (!result) {
        // Session đã FAILED (ví dụ hết stock) – trả 200 để SePay không retry
        console.warn(`[SePay Webhook] commitOrderFromSession null cho session ${session.id} – có thể hết stock`);
        return NextResponse.json({ success: true, message: "Commit failed – see session status" }, { status: 200 });
    }

    console.log(`[SePay Webhook] ✅ Thành công: Order ${result.orderId} từ session ${session.id}`);
    return NextResponse.json({ success: true }, { status: 200 });
}
