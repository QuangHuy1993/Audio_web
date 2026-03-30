// Order & Address DTOs for shop checkout and order flows

export type OrderStatus =
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "CANCELLED"
  | "SHIPPED"
  | "COMPLETED";

export type PaymentStatus = "PENDING" | "PAID" | "REFUNDED";

export type PaymentMethod = "COD" | "VNPAY" | "QR_TRANSFER";

// ----- Request DTOs -----

export type ShippingAddressInput = {
  addressId?: string;
  fullName?: string;
  phone?: string;
  line1?: string;
  line2?: string;
  ward?: string;
  district?: string;
  province?: string;
  postalCode?: string;
};

export type CreateOrderRequestDto = {
  shippingAddress: ShippingAddressInput;
  paymentMethod: PaymentMethod;
  /** GHN service_type_id (2=tiet kiem, 5=nhanh). */
  shippingServiceTypeId?: number;
  /** Backward compatible: 1 mã duy nhất (sẽ được map sang discount hoặc freeship). */
  couponCode?: string;
  /** Mã giảm giá tiền/% (PERCENTAGE/FIXED). */
  discountCouponCode?: string;
  /** Mã freeship (FREE_SHIPPING). */
  shippingCouponCode?: string;
  note?: string;
  isBuyNow?: boolean;
  buyNowProductId?: string;
  buyNowQuantity?: number;
};

export type CancelOrderRequestDto = {
  reason?: string;
};

// ----- Response DTOs -----

export type BankTransferInfo = {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  transferNote: string;
};

export type CreateOrderResponseDto = {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  shippingFee: number;
  couponDiscount: number;
  paymentMethod: PaymentMethod;
  bankTransferInfo?: BankTransferInfo;
  vnpayUrl?: string;
  qrImageUrl?: string;
  qrExpiresAt?: string;
};

export type OrderItemSummaryDto = {
  productId: string;
  productName: string;
  productImageUrl: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

export type OrderDetailDto = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentProvider: string | null;
  totalAmount: number;
  shippingFee: number;
  couponDiscount: number;
  currency: string;
  note: string | null;
  items: OrderItemSummaryDto[];
  shippingAddress: {
    fullName: string;
    phone: string;
    line1: string;
    line2: string | null;
    ward: string | null;
    district: string;
    province: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  cancelDeadlineAt: string | null;
};

export type OrderListItemDto = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  itemCount: number;
  createdAt: string;
};

export type OrderListResponseDto = {
  data: OrderListItemDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

// ----- Address DTOs -----

export type AddressDto = {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  ward: string | null;
  district: string;
  province: string;
  country: string;
  postalCode: string | null;
  isDefault: boolean;
  // Mã GHN (nếu đã được enrich trên server); dùng cho tính phí vận chuyển
  ghnDistrictId?: number | null;
  ghnWardCode?: string | null;
};

export type UpsertAddressRequestDto = {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  ward?: string;
  district: string;
  province: string;
  postalCode?: string;
  isDefault?: boolean;
};

