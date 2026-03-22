"use client";

import React from "react";
import { VietQRPaymentScreen } from "@/features/shop/components/checkout/VietQRPaymentScreen";

export default function VietQRDebugPage() {
    // Mock data for previewing the UI
    const mockData = {
        sessionId: "debug-session-id",
        orderNumber: "DUA-20260310-DEBUG",
        amount: 2500000,
        qrImageUrl: "https://img.vietqr.io/image/MB-0362600321-compact2.png?amount=2500000&addInfo=DUA+DEBUG&accountName=DAO+QUANG+HUY",
        bankInfo: {
            bankName: "Ngân hàng Quân đội (MB)",
            accountNumber: "0362600321",
            accountHolder: "DAO QUANG HUY",
            transferNote: "DUA DEBUG TEST",
        },
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        orderSummary: {
            items: [
                {
                    id: "debug-item-1",
                    name: "Sản phẩm demo",
                    quantity: 1,
                    price: 2500000,
                    imageUrl: "",
                },
            ],
            subtotal: 2500000,
            shippingFee: 0,
            discountAmount: 0,
            shippingDiscount: 0,
            total: 2500000,
        },
    };

    return (
        <div style={{ backgroundColor: "var(--background-homepage)", minHeight: "100vh" }}>
            <VietQRPaymentScreen
                sessionId={mockData.sessionId}
                orderNumber={mockData.orderNumber}
                amount={mockData.amount}
                qrImageUrl={mockData.qrImageUrl}
                bankInfo={mockData.bankInfo}
                expiresAt={mockData.expiresAt}
                orderSummary={mockData.orderSummary}
                onPaymentSuccess={(orderId) => {
                    alert(`Payment success! orderId: ${orderId}`);
                }}
                onCancel={() => {
                    alert("Bạn đã nhấn: Quay lại");
                }}
            />

            {/* Floating Debug Info */}
            <div style={{
                position: "fixed",
                bottom: "20px",
                right: "20px",
                padding: "12px",
                background: "rgba(0,0,0,0.8)",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#fff",
                zIndex: 2000,
                border: "1px solid var(--primary)"
            }}>
                DEBUG MODE: VietQR Preview
            </div>
        </div>
    );
}
