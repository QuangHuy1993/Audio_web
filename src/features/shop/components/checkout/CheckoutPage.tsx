"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import CheckoutStepper from "@/features/shop/components/checkout/CheckoutStepper";
import CheckoutAddressSection from "@/features/shop/components/checkout/CheckoutAddressSection";
import CheckoutShippingSection from "@/features/shop/components/checkout/CheckoutShippingSection";
import CheckoutPaymentSection from "@/features/shop/components/checkout/CheckoutPaymentSection";
import CheckoutCouponAndNoteSection from "@/features/shop/components/checkout/CheckoutCouponAndNoteSection";
import CheckoutCouponWalletModal, {
  type WalletCouponView,
} from "@/features/shop/components/checkout/CheckoutCouponWalletModal";
import CheckoutSummarySidebar from "@/features/shop/components/checkout/CheckoutSummarySidebar";
import PageTransitionOverlay from "@/components/shared/PageTransitionOverlay";
import ConfirmActionDialog from "@/components/shared/ConfirmActionDialog";
import { VietQRPaymentScreen } from "@/features/shop/components/checkout/VietQRPaymentScreen";
import type { CartItemDto, CartResponseDto } from "@/types/shop";
import type { CreatePaymentSessionResponseDto } from "@/types/payment";
import type { AddressDto, CreateOrderResponseDto } from "@/types/order";
import styles from "./CheckoutPage.module.css";

const CHECKOUT_CURRENT_STEP = 2;

const shippingBaseFee = 30_000;

const CheckoutPage: React.FC = () => {
  const router = useRouter();
  const { status: sessionStatus } = useSession();

  const [isRedirectingToSuccess, setIsRedirectingToSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartResponseDto | null>(null);
  const [addresses, setAddresses] = useState<AddressDto[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    null,
  );
  const [isNewAddressOpen, setIsNewAddressOpen] = useState(false);

  const [shippingMethod, setShippingMethod] = useState<"economy" | "express">(
    "economy",
  );
  const [paymentMethod, setPaymentMethod] = useState<
    "COD" | "VNPAY" | "QR_TRANSFER"
  >("COD");

  const [couponCode, setCouponCode] = useState("");
  const [appliedDiscountCouponCode, setAppliedDiscountCouponCode] = useState<
    string | null
  >(null);
  const [appliedShippingCouponCode, setAppliedShippingCouponCode] = useState<
    string | null
  >(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [shippingDiscount, setShippingDiscount] = useState(0);
  const [isCouponApplying, setIsCouponApplying] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  const [note, setNote] = useState("");
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [vietQrData, setVietQrData] = useState<{
    sessionId: string;        // cho polling
    orderNumber: string;
    amount: number;
    qrImageUrl: string;
    bankInfo: {
      bankName: string;
      accountNumber: string;
      accountHolder: string;
      transferNote: string;
    };
    expiresAt: string;
    orderSummary: {
      items: { id: string; name: string; quantity: number; price: number; imageUrl: string }[];
      subtotal: number;
      shippingFee: number;
      discountAmount: number;
      shippingDiscount: number;
      total: number;
    };
  } | null>(null);
  const [activePendingSession, setActivePendingSession] = useState<{
    id: string;
    provider: string;
    expiresAt: string;
    amount: number;
  } | null>(null);
  const submitInFlightRef = useRef(false);

  const [shippingOptions, setShippingOptions] = useState<
    {
      type: "economy" | "express";
      label: string;
      fee: number;
      estimatedDays: string;
      fallback: boolean;
    }[]
  >([]);
  const [isShippingFeeLoading, setIsShippingFeeLoading] = useState(false);
  const [, setShippingFeeError] = useState<string | null>(null);

  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [walletCoupons, setWalletCoupons] = useState<WalletCouponView[]>([]);
  const [isWalletLoading, setIsWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [isCancellingSession, setIsCancellingSession] = useState(false);


  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      router.push("/login?callbackUrl=/checkout");
    }
  }, [router, sessionStatus]);

  useEffect(() => {
    if (sessionStatus !== "authenticated") {
      return;
    }

    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [cartRes, addressRes, sessionRes] = await Promise.all([
          fetch("/api/shop/cart"),
          fetch("/api/shop/addresses"),
          fetch("/api/shop/payments/sessions/active"),
        ]);

        if (!cartRes.ok) {
          if (cartRes.status === 401) {
            router.push("/login?callbackUrl=/checkout");
            return;
          }
          if (cartRes.status === 400 || cartRes.status === 404) {
            router.push("/cart");
            return;
          }
          const errorJson = (await cartRes.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(
            errorJson?.error ??
            "Không thể tải giỏ hàng. Vui lòng thử lại sau.",
          );
        }

        const cartJson = (await cartRes.json()) as CartResponseDto;

        if (!cartJson.items || cartJson.items.length === 0) {
          router.push("/cart");
          return;
        }

        if (sessionRes.ok) {
          const activeSess = await sessionRes.json();
          if (activeSess) {
            setActivePendingSession(activeSess);
          }
        }

        setCart(cartJson);

        if (addressRes.ok) {
          const addressesJson = (await addressRes.json()) as AddressDto[];
          setAddresses(addressesJson);
          const defaultAddress =
            addressesJson.find((a) => a.isDefault) ?? addressesJson[0] ?? null;
          setSelectedAddressId(defaultAddress ? defaultAddress.id : null);
        }
      } catch (err) {
        const anyError = err as { message?: string };
        setError(
          anyError?.message ??
          "Không thể tải dữ liệu checkout. Vui lòng thử lại sau.",
        );
      } finally {
        setIsLoading(false);
      }
    };

    void loadData();
  }, [router, sessionStatus]);

  useEffect(() => {
    if (isLoading || !cart || !selectedAddressId) {
      setShippingOptions([]);
      setShippingFeeError(null);
      return;
    }

    const address = addresses.find((item) => item.id === selectedAddressId);

    if (!address) {
      setShippingOptions([]);
      setShippingFeeError(null);
      return;
    }

    if (!address.ghnDistrictId || !address.ghnWardCode) {
      setShippingOptions([]);
      setShippingFeeError(
        address.ghnDistrictId && !address.ghnWardCode
          ? "Vui lòng chọn phường/xã cho địa chỉ này để tính phí GHN chính xác, hiện đang dùng phí ước tính."
          : "Không tìm thấy mã GHN cho địa chỉ này, sử dụng phí vận chuyển ước tính.",
      );
      return;
    }

    const totalWeight =
      cart.totalQuantity > 0 ? Math.max(500, cart.totalQuantity * 1000) : 500;

    const calculate = async () => {
      try {
        setIsShippingFeeLoading(true);
        setShippingFeeError(null);

        const [economyRes, expressRes] = await Promise.all([
          fetch("/api/shop/shipping/calculate-fee", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              toDistrictId: address.ghnDistrictId,
              toWardCode: address.ghnWardCode,
              weight: totalWeight,
              serviceTypeId: 2,
            }),
          }),
          fetch("/api/shop/shipping/calculate-fee", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              toDistrictId: address.ghnDistrictId,
              toWardCode: address.ghnWardCode,
              weight: totalWeight,
              serviceTypeId: 5,
            }),
          }),
        ]);

        const economyJson = (await economyRes.json().catch(() => null)) as
          | {
            fee?: number;
            serviceName?: string;
            estimatedDays?: string;
            fallback?: boolean;
          }
          | null;

        const expressJson = (await expressRes.json().catch(() => null)) as
          | {
            fee?: number;
            serviceName?: string;
            estimatedDays?: string;
            fallback?: boolean;
          }
          | null;

        if (!economyRes.ok || !expressRes.ok) {
          setShippingOptions([]);
          setShippingFeeError(
            "Không thể tính phí vận chuyển GHN, sử dụng phí ước tính.",
          );
          return;
        }

        const rawOptions = [
          {
            type: "economy" as const,
            label: "GHN Tiết kiệm",
            fee: economyJson?.fee ?? shippingBaseFee,
            estimatedDays: economyJson?.estimatedDays ?? "3-5 ngày",
            fallback: economyJson?.fallback ?? false,
          },
          {
            type: "express" as const,
            label: "GHN Nhanh (Hoả tốc)",
            fee: expressJson?.fee ?? shippingBaseFee * 2,
            estimatedDays: expressJson?.estimatedDays ?? "1-2 ngày",
            fallback: expressJson?.fallback ?? false,
          },
        ];
        setShippingOptions(rawOptions);

        const hasExpress =
          rawOptions.find(
            (option) => option.type === "express" && !option.fallback,
          ) != null;

        if (!hasExpress && shippingMethod === "express") {
          setShippingMethod("economy");
        }
      } catch {
        setShippingOptions([]);
        setShippingFeeError(
          "Không thể tính phí vận chuyển GHN, sử dụng phí ước tính.",
        );
      } finally {
        setIsShippingFeeLoading(false);
      }
    };

    void calculate();
  }, [addresses, cart, isLoading, selectedAddressId, shippingMethod]);

  const summaryItems = useMemo(
    () =>
      (cart?.items ?? []).map((item: CartItemDto) => ({
        id: item.id,
        name: item.productName,
        quantity: item.quantity,
        price: item.unitPrice,
        imageUrl: item.productImageUrl ?? "",
      })),
    [cart],
  );

  const subtotal = cart?.subtotal ?? 0;

  const effectiveShippingOptions = useMemo(() => {
    if (shippingOptions.length > 0) {
      return shippingOptions;
    }

    const baseFee = subtotal === 0 ? 0 : shippingBaseFee;

    return [
      {
        type: "economy" as const,
        label: "GHN Tiết kiệm",
        fee: baseFee,
        estimatedDays: "3-5 ngày",
        fallback: true,
      },
      {
        type: "express" as const,
        label: "GHN Nhanh (Hoả tốc)",
        fee:
          subtotal === 0
            ? 0
            : shippingBaseFee * 2,
        estimatedDays: "1-2 ngày",
        fallback: true,
      },
    ];
  }, [shippingOptions, subtotal]);

  const selectedShippingOption = useMemo(
    () =>
      effectiveShippingOptions.find(
        (option) => option.type === shippingMethod,
      ) ?? effectiveShippingOptions[0],
    [effectiveShippingOptions, shippingMethod],
  );

  const shippingFee = selectedShippingOption?.fee ?? 0;
  const totalSavings = discountAmount + shippingDiscount;
  const total = subtotal - discountAmount + Math.max(shippingFee - shippingDiscount, 0);

  const canAddMoreAddresses = addresses.length < 4;

  if (isLoading) {
    return (
      <div className={styles["checkout-page-layout"]}>
        <CheckoutStepper currentStep={CHECKOUT_CURRENT_STEP} />
        <div className={styles["checkout-page-layout__grid"]}>
          <div className={styles["checkout-page-layout__main"]}>
            <div className={styles["checkout-page-layout__skeleton-block"]} />
            <div className={styles["checkout-page-layout__skeleton-block"]} />
            <div className={styles["checkout-page-layout__skeleton-block"]} />
          </div>
          <div className={styles["checkout-page-layout__aside"]}>
            <div className={styles["checkout-page-layout__skeleton-summary"]} />
          </div>
        </div>
      </div>
    );
  }

  const canSubmit =
    !!cart &&
    cart.items.length > 0 &&
    (!!selectedAddressId || addresses.length === 0) &&
    !isSubmittingOrder &&
    !isRedirectingToSuccess &&
    !isShippingFeeLoading;

  const handleAddressCreated = (address: AddressDto) => {
    setAddresses((previous) => {
      const next = [...previous, address];
      return next;
    });
    setSelectedAddressId(address.id);
    setIsNewAddressOpen(false);
  };

  const applyCouponByCode = async (rawCode: string) => {
    if (!cart) return;

    try {
      setIsCouponApplying(true);
      setCouponError(null);

      const res = await fetch("/api/shop/coupons/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: rawCode,
          orderSubtotal: subtotal,
          shippingFee,
        }),
      });

      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setCouponError(
          json?.error ?? "Không thể kiểm tra mã giảm giá. Vui lòng thử lại.",
        );
        // Không xoá các mã đang áp dụng nếu user nhập một mã sai.
        return;
      }

      const data = (await res.json()) as {
        isValid: boolean;
        normalizedCode?: string;
        type?: "PERCENTAGE" | "FIXED" | "FREE_SHIPPING";
        discountAmount?: number;
        appliedShippingDiscount?: number;
        reason?: string;
      };

      if (!data.isValid || !data.normalizedCode) {
        setCouponError(
          data.reason ??
          "Mã giảm giá không hợp lệ hoặc đã hết lượt sử dụng.",
        );
        // Không xoá các mã đang áp dụng nếu user nhập một mã sai.
        return;
      }

      const nextCode = data.normalizedCode;
      const nextType = data.type;

      const nextDiscountAmount = data.discountAmount ?? 0;
      const nextShippingDiscount = Math.min(
        data.appliedShippingDiscount ?? 0,
        shippingFee,
      );

      if (nextType === "FREE_SHIPPING") {
        setAppliedShippingCouponCode(nextCode);
        setShippingDiscount(nextShippingDiscount);
        toast.success("Đã áp dụng mã miễn phí vận chuyển!");
      } else {
        setAppliedDiscountCouponCode(nextCode);
        setDiscountAmount(nextDiscountAmount);
        toast.success("Đã áp dụng mã giảm giá thành công!");
      }
      setCouponCode("");
    } catch {
      setCouponError(
        "Không thể kiểm tra mã giảm giá. Vui lòng thử lại sau.",
      );
      setAppliedDiscountCouponCode(null);
      setAppliedShippingCouponCode(null);
      setDiscountAmount(0);
      setShippingDiscount(0);
    } finally {
      setIsCouponApplying(false);
    }
  };

  const handleApplyCoupon = async () => {
    if (!cart) return;

    const raw = couponCode.trim();
    if (!raw) {
      setCouponError("Vui lòng nhập mã giảm giá.");
      return;
    }

    await applyCouponByCode(raw);
  };

  const handleRemoveCoupon = () => {
    setAppliedDiscountCouponCode(null);
    setAppliedShippingCouponCode(null);
    setDiscountAmount(0);
    setShippingDiscount(0);
    setCouponError(null);
    toast.info("Đã gỡ bỏ mã giảm giá.");
  };

  const handleResumeSession = async () => {
    if (!activePendingSession) return;
    const { id } = activePendingSession;

    try {
      setIsSubmittingOrder(true);
      const res = await fetch(`/api/shop/payments/sessions/${id}/status`);
      if (!res.ok) throw new Error("Could not fetch session info");

      // Re-trigger the same logic as if order was just created
      // But we need the FULL SESSION details for VietQR.
      // For now, let's just trigger a re-prepare if they Resume
      // but if the amount mismatch is fixed, re-prepare might be safer.
      // Wait, let's just use the current session ID and re-fetch if it's VietQR.

      // Optimization: We could have a /api/shop/payments/sessions/[id] detail route
      const detailRes = await fetch(`/api/shop/payments/sessions/${id}/details`);
      if (detailRes.ok) {
        const qrData = await detailRes.json();
        // same mapping logic as handleOrderSubmission
        setVietQrData({
          sessionId: qrData.sessionId,
          orderNumber: qrData.providerRef ?? qrData.sessionId,
          amount: qrData.amount,
          qrImageUrl: qrData.paymentUrl ?? "",
          bankInfo: {
            bankName: qrData.bankInfo?.bankName ?? qrData.bankInfo?.bankId ?? "MB",
            accountNumber: qrData.bankInfo?.accountNo ?? "",
            accountHolder: qrData.bankInfo?.accountName ?? "",
            transferNote: qrData.providerRef ?? "",
          },
          expiresAt: qrData.expiresAt,
          orderSummary: {
            items: summaryItems,
            subtotal,
            shippingFee,
            discountAmount,
            shippingDiscount,
            total,
          },
        });
      } else {
        // fallback: cancel and let them start over
        await handleCancelSession();
      }
    } catch {
      toast.error("Không thể khôi phục giao dịch.");
    } finally {
      setIsSubmittingOrder(false);
      setActivePendingSession(null);
    }
  };

  const handleCancelSession = async () => {
    if (!activePendingSession) return;
    try {
      setIsCancellingSession(true);
      await fetch(`/api/shop/payments/sessions/${activePendingSession.id}/cancel`, {
        method: "POST",
      });
      toast.success("Đã huỷ giao dịch cũ.");
    } finally {
      setIsCancellingSession(false);
      setActivePendingSession(null);
    }
  };

  const handleOpenWallet = async () => {
    if (!cart) return;

    try {
      setIsWalletOpen(true);
      setIsWalletLoading(true);
      setWalletError(null);

      const res = await fetch(
        `/api/shop/coupons/wallet?orderSubtotal=${subtotal}&shippingFee=${shippingFee}`,
      );

      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setWalletError(
          json?.error ??
          "Không thể tải ví voucher của bạn. Vui lòng thử lại sau.",
        );
        setWalletCoupons([]);
        return;
      }

      const data = (await res.json()) as { coupons?: WalletCouponView[] };
      setWalletCoupons(data.coupons ?? []);
    } catch {
      setWalletError(
        "Không thể tải ví voucher của bạn. Vui lòng thử lại sau.",
      );
      setWalletCoupons([]);
    } finally {
      setIsWalletLoading(false);
    }
  };

  const handleConfirmWalletCoupon = async (payload: {
    discountCode: string | null;
    shippingCode: string | null;
  }) => {
    setIsWalletOpen(false);

    const { discountCode, shippingCode } = payload;

    if (!discountCode) {
      setAppliedDiscountCouponCode(null);
      setDiscountAmount(0);
    }

    if (!shippingCode) {
      setAppliedShippingCouponCode(null);
      setShippingDiscount(0);
    }

    if (discountCode) {
      await applyCouponByCode(discountCode);
    }

    if (shippingCode) {
      await applyCouponByCode(shippingCode);
    }
  };

  const handleSubmitOrder = async () => {
    if (submitInFlightRef.current) return;
    if (isRedirectingToSuccess) return;
    if (!cart || cart.items.length === 0) return;

    const addressIdToUse = selectedAddressId ?? null;
    let keepLockedUntilNavigate = false;

    if (!addressIdToUse && addresses.length > 0) {
      setSubmitError("Vui lòng chọn địa chỉ giao hàng.");
      toast.error("Vui lòng chọn địa chỉ giao hàng.");
      return;
    }

    try {
      submitInFlightRef.current = true;
      setIsSubmittingOrder(true);
      setSubmitError(null);

      const shippingServiceTypeId = shippingMethod === "express" ? 5 : 2;

      if (paymentMethod === "VNPAY") {
        const res = await fetch("/api/shop/payments/sessions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            provider: "VNPAY",
            paymentMethod: "VNPAY",
            shippingAddress: {
              addressId: addressIdToUse ?? undefined,
            },
            shippingServiceTypeId,
            discountCouponCode: appliedDiscountCouponCode ?? undefined,
            shippingCouponCode: appliedShippingCouponCode ?? undefined,
            note: note || undefined,
          }),
        });

        if (!res.ok) {
          const json = (await res.json().catch(() => null)) as
            | { error?: string; code?: string }
            | null;
          const message =
            json?.error ??
            "Không thể khởi tạo phiên thanh toán VNPAY. Vui lòng thử lại sau.";
          setSubmitError(message);
          toast.error(message);
          return;
        }

        const data = (await res.json()) as CreatePaymentSessionResponseDto;
        if (!data.sessionId || !data.paymentUrl) {
          const message =
            "Không thể khởi tạo phiên thanh toán VNPAY. Vui lòng thử lại sau.";
          setSubmitError(message);
          toast.error(message);
          return;
        }

        keepLockedUntilNavigate = true;
        setIsRedirectingToSuccess(true);
        toast.success(
          "Đang chuyển đến VNPAY để hoàn tất thanh toán cho đơn hàng của bạn.",
        );
        window.setTimeout(() => {
          window.location.href = data.paymentUrl!;
        }, 2000);
        return;
      }

      // ── QR_TRANSFER: T\u1ea1o CheckoutSession (VIETQR) ──
      if (paymentMethod === "QR_TRANSFER") {
        const qrRes = await fetch("/api/shop/payments/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: "VIETQR",
            paymentMethod: "QR_TRANSFER",
            shippingAddress: { addressId: addressIdToUse ?? undefined },
            shippingServiceTypeId,
            discountCouponCode: appliedDiscountCouponCode ?? undefined,
            shippingCouponCode: appliedShippingCouponCode ?? undefined,
            note: note || undefined,
          }),
        });

        if (!qrRes.ok) {
          const json = (await qrRes.json().catch(() => null)) as { error?: string } | null;
          const message = json?.error ?? "Kh\u00f4ng th\u1ec3 kh\u1edfi t\u1ea1o thanh to\u00e1n QR. Vui l\u00f2ng th\u1eed l\u1ea1i.";
          setSubmitError(message);
          toast.error(message);
          return;
        }

        const qrData = (await qrRes.json()) as CreatePaymentSessionResponseDto;

        try {
          sessionStorage.setItem("checkout:sessionId", qrData.sessionId);
        } catch { /* ignore */ }

        setVietQrData({
          sessionId: qrData.sessionId,
          orderNumber: qrData.providerRef ?? qrData.sessionId,
          amount: qrData.amount,
          qrImageUrl: qrData.paymentUrl ?? "",
          bankInfo: {
            bankName: qrData.bankInfo?.bankName ?? qrData.bankInfo?.bankId ?? "MB",
            accountNumber: qrData.bankInfo?.accountNo ?? "",
            accountHolder: qrData.bankInfo?.accountName ?? "",
            transferNote: qrData.providerRef ?? "",
          },
          expiresAt: qrData.expiresAt,
          orderSummary: {
            items: summaryItems,
            subtotal,
            shippingFee,
            discountAmount,
            shippingDiscount,
            total,
          },
        });

        setIsSubmittingOrder(false);
        submitInFlightRef.current = false;
        return;
      }

      // ── COD: T\u1ea1o Order ngay ──
      const res = await fetch("/api/shop/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shippingAddress: {
            addressId: addressIdToUse ?? undefined,
          },
          shippingServiceTypeId,
          paymentMethod,
          discountCouponCode: appliedDiscountCouponCode ?? undefined,
          shippingCouponCode: appliedShippingCouponCode ?? undefined,
          note: note || undefined,
        }),
      });

      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as
          | { error?: string; code?: string }
          | null;
        const message =
          json?.error ?? "Kh\u00f4ng th\u1ec3 t\u1ea1o \u0111\u01a1n h\u00e0ng. Vui l\u00f2ng th\u1eed l\u1ea1i sau.";
        setSubmitError(message);
        toast.error(message);
        return;
      }

      const data = (await res.json()) as CreateOrderResponseDto;
      if (data.orderId) {
        try {
          sessionStorage.setItem("checkout:successToast", "1");
          sessionStorage.setItem("checkout:lastOrderId", data.orderId);
        } catch {
          // ignore storage failures
        }

        toast.success("Đặt hàng thành công. Đức Uy Audio đang chuẩn bị biên nhận.");
        keepLockedUntilNavigate = true;
        setIsRedirectingToSuccess(true);
        window.setTimeout(() => {
          router.push(`/checkout/success?orderId=${data.orderId}`);
        }, 2000);
      } else {
        toast.success("Đặt hàng thành công. Đức Uy Audio đang chuẩn bị biên nhận.");
        keepLockedUntilNavigate = true;
        setIsRedirectingToSuccess(true);
        window.setTimeout(() => {
          router.push("/checkout/success");
        }, 2000);
      }
    } catch {
      const message = "Không thể tạo đơn hàng. Vui lòng thử lại sau.";
      setSubmitError(message);
      toast.error(message);
    } finally {
      setIsSubmittingOrder(false);
      if (!keepLockedUntilNavigate) {
        submitInFlightRef.current = false;
      }
    }
  };

  if (error && !submitError) {
    return (
      <div className={styles["checkout-page-layout"]}>
        <CheckoutStepper currentStep={CHECKOUT_CURRENT_STEP} />
        <div className={styles["checkout-page-layout__error"]}>
          <h2 className={styles["checkout-page-layout__error-title"]}>
            Không thể tải trang thanh toán
          </h2>
          <p className={styles["checkout-page-layout__error-desc"]}>{error}</p>
          <button
            type="button"
            className={styles["checkout-page-layout__error-button"]}
            onClick={() => router.push("/cart")}
          >
            Quay lại giỏ hàng
          </button>
        </div>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return null;
  }

  return (
    <div className={styles["checkout-page-layout"]}>
      <PageTransitionOverlay
        isActive={isRedirectingToSuccess}
        subtitle="Đang chuyển đến trang cảm ơn của bạn..."
        bottomText="Đức Uy Audio đang tạo biên nhận và chuẩn bị xác nhận đơn hàng."
      />

      <CheckoutStepper currentStep={CHECKOUT_CURRENT_STEP} />

      <AnimatePresence>
        {vietQrData && (
          <VietQRPaymentScreen
            sessionId={vietQrData.sessionId}
            orderNumber={vietQrData.orderNumber}
            amount={vietQrData.amount}
            qrImageUrl={vietQrData.qrImageUrl}
            bankInfo={vietQrData.bankInfo}
            expiresAt={vietQrData.expiresAt}
            orderSummary={vietQrData.orderSummary}
            onPaymentSuccess={(orderId) => {
              try { sessionStorage.setItem("checkout:lastOrderId", orderId); } catch { /* ignore */ }
              router.push(`/checkout/success?orderId=${orderId}`);
            }}
            onCancel={() => setVietQrData(null)}
          />
        )}
      </AnimatePresence>

      <div className={styles["checkout-page-layout__grid"]}>
        <div className={styles["checkout-page-layout__main"]}>
          <CheckoutAddressSection
            addresses={addresses}
            selectedAddressId={selectedAddressId}
            canAddMore={canAddMoreAddresses}
            onSelectAddress={setSelectedAddressId}
            onToggleNewForm={() =>
              setIsNewAddressOpen((previous) => !previous)
            }
            isNewFormOpen={isNewAddressOpen || addresses.length === 0}
            onAddressCreated={handleAddressCreated}
          />
          <CheckoutShippingSection
            selectedType={shippingMethod}
            options={effectiveShippingOptions}
            onChange={setShippingMethod}
          />
          <CheckoutPaymentSection
            value={paymentMethod}
            onChange={setPaymentMethod}
          />
          <CheckoutCouponAndNoteSection
            couponCode={couponCode}
            appliedDiscountCouponCode={appliedDiscountCouponCode}
            appliedShippingCouponCode={appliedShippingCouponCode}
            totalSavings={totalSavings}
            isApplying={isCouponApplying}
            error={couponError}
            note={note}
            onCouponCodeChange={setCouponCode}
            onApplyCoupon={handleApplyCoupon}
            onRemoveCoupon={handleRemoveCoupon}
            onNoteChange={setNote}
            onOpenWallet={handleOpenWallet}
          />
          {submitError && (
            <p className={styles["checkout-page-layout__submit-error"]}>
              {submitError}
            </p>
          )}
        </div>

        <div className={styles["checkout-page-layout__aside"]}>
          <CheckoutSummarySidebar
            items={summaryItems}
            subtotal={subtotal}
            discountAmount={discountAmount}
            shippingDiscount={shippingDiscount}
            shippingFee={shippingFee}
            total={total}
            canSubmit={canSubmit}
            isSubmitting={isSubmittingOrder}
            onSubmitOrder={handleSubmitOrder}
          />
        </div>
      </div>

      <CheckoutCouponWalletModal
        isOpen={isWalletOpen}
        coupons={walletCoupons}
        isLoading={isWalletLoading}
        error={walletError}
        orderSubtotal={subtotal}
        shippingFee={shippingFee}
        appliedDiscountCouponCode={appliedDiscountCouponCode}
        appliedShippingCouponCode={appliedShippingCouponCode}
        totalSavings={totalSavings}
        onClose={() => setIsWalletOpen(false)}
        onConfirm={handleConfirmWalletCoupon}
      />

      <ConfirmActionDialog
        isOpen={!!activePendingSession}
        title="Bạn có một giao dịch chưa hoàn tất"
        description={`Hệ thống ghi nhận bạn có một yêu cầu thanh toán ${activePendingSession?.provider === "VIETQR" ? "VietQR" : "VNPAY"} (${new Intl.NumberFormat("vi-VN").format(activePendingSession?.amount ?? 0)}đ) đang chờ. Bạn có muốn tiếp tục thanh toán không?`}
        confirmLabel="Tiếp tục thanh toán"
        cancelLabel="Huỷ và tạo đơn mới"
        isConfirmLoading={isSubmittingOrder}
        onConfirm={handleResumeSession}
        onCancel={handleCancelSession}
      />
    </div>
  );
};

export default CheckoutPage;
