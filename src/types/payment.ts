// Payment-related DTOs for VNPAY CheckoutSession flow
// Tách riêng để không làm phình to order types.

import type { PaymentMethod, ShippingAddressInput } from "./order";

export type CheckoutProvider = "VNPAY" | "VIETQR";

export type CheckoutStatus =
  | "PENDING"
  | "SUCCEEDED"
  | "FAILED"
  | "EXPIRED"
  | "CANCELLED";

export type CreatePaymentSessionRequestDto = {
  provider: CheckoutProvider;
  paymentMethod: Extract<PaymentMethod, "VNPAY" | "QR_TRANSFER">;
  shippingAddress: ShippingAddressInput;
  shippingServiceTypeId?: number;
  discountCouponCode?: string;
  shippingCouponCode?: string;
  note?: string;
  isBuyNow?: boolean;
  buyNowProductId?: string;
  buyNowQuantity?: number;
};

export type CreatePaymentSessionResponseDto = {
  sessionId: string;
  provider: CheckoutProvider;
  status: CheckoutStatus;
  expiresAt: string;
  amount: number;
  currency: string;
  paymentUrl?: string;
  // VIETQR specific
  providerRef?: string;           // mã nội dung chuyển khoản (DUA...)
  bankInfo?: {
    bankId: string;               // mã ngân hàng từ AdminSetting
    bankName: string;             // tên hiển thị
    accountNo: string;
    accountName: string;
  };
};

export type CheckoutSessionStatusDto = {
  sessionId: string;
  provider: CheckoutProvider;
  status: CheckoutStatus;
  expiresAt: string;
  amount: number;
  currency: string;
  orderId?: string;
  paymentProviderCode?: string | null;
};

