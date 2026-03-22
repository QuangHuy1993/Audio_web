"use client";

import React, { useState } from "react";
import {
  MdClose,
  MdAutoAwesome,
  MdSettings,
  MdVisibility,
  MdCheckCircle,
  MdInfoOutline,
  MdContentCopy,
  MdHeadphones,
} from "react-icons/md";
import type { Resolver } from "react-hook-form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import styles from "./AdminCouponUpsertModal.module.css";

type CouponType = "PERCENTAGE" | "FIXED" | "FREE_SHIPPING";

const upsertCouponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1, "Mã giảm giá là bắt buộc.")
      .max(40, "Mã quá dài."),
    description: z
      .string()
      .trim()
      .max(500, "Mô tả quá dài.")
      .optional()
      .or(z.literal("")),
    type: z.enum(["PERCENTAGE", "FIXED", "FREE_SHIPPING"]),
    value: z
      .union([z.number(), z.literal("")])
      .optional()
      .transform((v): number | undefined => {
        if (v === "" || v == null) return undefined;
        const n = typeof v === "number" ? v : Number(v);
        return Number.isFinite(n) ? n : undefined;
      }),
    maxDiscount: z
      .union([z.number(), z.literal("")])
      .optional()
      .transform((v): number | undefined => {
        if (v === "" || v == null) return undefined;
        const n = typeof v === "number" ? v : Number(v);
        return Number.isFinite(n) ? n : undefined;
      }),
    minOrderAmount: z
      .union([z.number(), z.literal("")])
      .optional()
      .transform((v): number | undefined => {
        if (v === "" || v == null) return undefined;
        const n = typeof v === "number" ? v : Number(v);
        return Number.isFinite(n) ? n : undefined;
      }),
    usageLimit: z
      .union([z.number(), z.literal("")])
      .optional()
      .transform((v): number | undefined => {
        if (v === "" || v == null) return undefined;
        const n = typeof v === "number" ? v : Number(v);
        return Number.isInteger(n) && n > 0 ? n : undefined;
      }),
    startsAt: z.string().trim().optional().or(z.literal("")),
    endsAt: z.string().trim().optional().or(z.literal("")),
    isActive: z.boolean(),
  })
  .refine(
    (data) => {
      if (data.type === "PERCENTAGE" && data.value != null) {
        return data.value > 0 && data.value <= 100;
      }
      if (
        (data.type === "FIXED" || data.type === "FREE_SHIPPING") &&
        data.value != null
      ) {
        return data.value >= 0;
      }
      return true;
    },
    {
      message:
        "PERCENTAGE: value từ 1–100; FIXED/FREE_SHIPPING: value >= 0.",
      path: ["value"],
    },
  )
  .refine(
    (data) => {
      if (!data.startsAt || !data.endsAt) return true;
      const s = new Date(data.startsAt).getTime();
      const e = new Date(data.endsAt).getTime();
      return e > s;
    },
    { message: "Ngày kết thúc phải sau ngày bắt đầu.", path: ["endsAt"] },
  );

type UpsertCouponFormValues = z.infer<typeof upsertCouponSchema>;

export type AdminCouponUpsertModalCoupon = {
  id: string;
  code: string;
  description: string | null;
  type: CouponType;
  value: number | null;
  maxDiscount: number | null;
  minOrderAmount: number | null;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

type AdminCouponUpsertModalProps = {
  isOpen: boolean;
  mode: "create" | "edit";
  coupon?: AdminCouponUpsertModalCoupon | null;
  onClose: () => void;
  onCompleted: () => void;
};

function toLocalDateTime(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${day}T${h}:${min}`;
  } catch {
    return "";
  }
}

function formatVnd(n: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(n);
}

const QUICK_TIP_TEXT =
  'Mã giảm giá có **thời hạn 24 giờ** và "Mỗi khách 1 lượt" thường có tỷ lệ chuyển đổi cao hơn khoảng 40% cho thiết bị âm thanh. Cân nhắc dùng cho flash sale.';

const AdminCouponUpsertModal: React.FC<AdminCouponUpsertModalProps> = ({
  isOpen,
  mode,
  coupon,
  onClose,
  onCompleted,
}) => {
  const isEdit = mode === "edit";
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<UpsertCouponFormValues>({
    resolver: zodResolver(upsertCouponSchema) as Resolver<UpsertCouponFormValues>,
    defaultValues: {
      code: coupon?.code ?? "",
      description: coupon?.description ?? "",
      type: coupon?.type ?? "PERCENTAGE",
      value: coupon?.value ?? undefined,
      maxDiscount: coupon?.maxDiscount ?? undefined,
      minOrderAmount: coupon?.minOrderAmount ?? undefined,
      usageLimit: coupon?.usageLimit ?? undefined,
      startsAt: toLocalDateTime(coupon?.startsAt ?? null),
      endsAt: toLocalDateTime(coupon?.endsAt ?? null),
      isActive: coupon?.isActive ?? true,
    },
    values: isOpen
      ? {
          code: coupon?.code ?? "",
          description: coupon?.description ?? "",
          type: coupon?.type ?? "PERCENTAGE",
          value: coupon?.value ?? undefined,
          maxDiscount: coupon?.maxDiscount ?? undefined,
          minOrderAmount: coupon?.minOrderAmount ?? undefined,
          usageLimit: coupon?.usageLimit ?? undefined,
          startsAt: toLocalDateTime(coupon?.startsAt ?? null),
          endsAt: toLocalDateTime(coupon?.endsAt ?? null),
          isActive: coupon?.isActive ?? true,
        }
      : undefined,
  });

  const typeWatch = watch("type");
  const codeWatch = watch("code");
  const descriptionWatch = watch("description");
  const valueWatch = watch("value");
  const minOrderAmountWatch = watch("minOrderAmount");
  const endsAtWatch = watch("endsAt");

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const onSubmit = async (values: UpsertCouponFormValues) => {
    const payload = {
      code: values.code.trim(),
      description: values.description?.trim() || null,
      type: values.type,
      value: values.value ?? null,
      maxDiscount: values.maxDiscount ?? null,
      minOrderAmount: values.minOrderAmount ?? null,
      usageLimit: values.usageLimit ?? null,
      startsAt: values.startsAt?.trim() || null,
      endsAt: values.endsAt?.trim() || null,
      isActive: values.isActive,
    };

    try {
      const response = await fetch(
        isEdit && coupon
          ? `/api/admin/coupons/${encodeURIComponent(coupon.id)}`
          : "/api/admin/coupons",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const json = (await response.json()) as { error?: string };

      if (!response.ok) {
        toast.error(
          json.error ??
            (isEdit
              ? "Không thể cập nhật mã giảm giá."
              : "Không thể tạo mã giảm giá."),
        );
        return;
      }

      toast.success(
        isEdit
          ? "Cập nhật mã giảm giá thành công."
          : "Tạo mã giảm giá thành công.",
      );
      onCompleted();
      onClose();
    } catch {
      toast.error(
        isEdit
          ? "Có lỗi xảy ra khi cập nhật. Vui lòng thử lại."
          : "Có lỗi xảy ra khi tạo mã. Vui lòng thử lại.",
      );
    }
  };

  const handleGenerateAi = async () => {
    if (isGeneratingAi || isSubmitting) return;

    const campaignTitle = watch("description")?.trim() ?? "";
    const discountPercent =
      typeWatch === "PERCENTAGE" ? watch("value") : undefined;
    const discountFixedVnd =
      typeWatch === "FIXED" ? watch("value") : undefined;
    const freeShipping = typeWatch === "FREE_SHIPPING";

    setIsGeneratingAi(true);

    try {
      const response = await fetch("/api/admin/coupons/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredType: typeWatch,
          campaignTitle: campaignTitle || undefined,
          discountPercent:
            typeof discountPercent === "number"
              ? discountPercent
              : discountPercent != null
                ? Number(discountPercent)
                : undefined,
          discountFixedVnd:
            typeof discountFixedVnd === "number"
              ? discountFixedVnd
              : discountFixedVnd != null
                ? Number(discountFixedVnd)
                : undefined,
          freeShipping: freeShipping || undefined,
          minOrderAmountVnd: watch("minOrderAmount"),
          maxDiscountVnd: watch("maxDiscount"),
          usageLimit: watch("usageLimit"),
          preferredStartsAt: watch("startsAt") || undefined,
          preferredEndsAt: watch("endsAt") || undefined,
        }),
      });

      const json = (await response.json()) as {
        error?: string;
        data?: {
          code: string;
          description: string;
          type: CouponType;
          value: number | null;
          maxDiscountVnd: number | null;
          minOrderAmountVnd: number | null;
          usageLimit: number | null;
          suggestedStartsAt: string | null;
          suggestedEndsAt: string | null;
        };
      };

      if (!response.ok || !json.data) {
        toast.error(
          json.error ??
            "Tính năng AI tạm thời không khả dụng. Vui lòng thử lại sau.",
        );
        return;
      }

      const d = json.data;
      setValue("code", d.code, { shouldDirty: true });
      setValue("description", d.description, { shouldDirty: true });
      setValue("type", d.type, { shouldDirty: true });
      setValue("value", d.value ?? undefined, { shouldDirty: true });
      setValue("maxDiscount", d.maxDiscountVnd ?? undefined, {
        shouldDirty: true,
      });
      setValue("minOrderAmount", d.minOrderAmountVnd ?? undefined, {
        shouldDirty: true,
      });
      setValue("usageLimit", d.usageLimit ?? undefined, { shouldDirty: true });
      setValue(
        "startsAt",
        d.suggestedStartsAt ? toLocalDateTime(d.suggestedStartsAt) : "",
        { shouldDirty: true },
      );
      setValue(
        "endsAt",
        d.suggestedEndsAt ? toLocalDateTime(d.suggestedEndsAt) : "",
        { shouldDirty: true },
      );

      toast.success(
        "Đã gợi ý cấu hình mã. Bạn có thể chỉnh sửa lại trước khi lưu.",
      );
    } catch {
      toast.error(
        "Có lỗi xảy ra khi gọi AI. Vui lòng kiểm tra cấu hình và thử lại.",
      );
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleCopyCode = () => {
    const code = codeWatch?.trim();
    if (!code) return;
    void navigator.clipboard.writeText(code).then(() => {
      toast.success("Đã sao chép mã vào clipboard.");
    });
  };

  const title = isEdit ? "Chỉnh sửa mã giảm giá" : "Tạo mã giảm giá mới";
  const subtitle =
    mode === "edit"
      ? "Cập nhật thông tin và điều kiện áp dụng cho khách hàng Đức Uy Audio."
      : "Cấu hình mã giảm giá và quy tắc sử dụng cho khách hàng Đức Uy Audio.";
  const primaryLabel = isEdit ? "Lưu thay đổi" : "Tạo mã";

  const previewHeadline =
    typeWatch === "PERCENTAGE" && valueWatch != null
      ? `GIẢM ${valueWatch}%`
      : typeWatch === "FIXED" && valueWatch != null
        ? `GIẢM ${formatVnd(valueWatch)}`
        : typeWatch === "FREE_SHIPPING"
          ? "MIỄN PHÍ VẬN CHUYỂN"
          : "ƯU ĐÃI";

  const previewDesc =
    descriptionWatch?.trim() ||
    "Áp dụng cho đơn hàng đủ điều kiện tại Đức Uy Audio.";

  const minOrderStr =
    minOrderAmountWatch != null && Number(minOrderAmountWatch) > 0
      ? formatVnd(Number(minOrderAmountWatch))
      : null;

  let expiresStr = "";
  if (endsAtWatch?.trim()) {
    try {
      const end = new Date(endsAtWatch);
      const now = new Date();
      const days = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (days > 0) expiresStr = `Hết hạn sau ${days} ngày`;
      else expiresStr = "Đã hết hạn";
    } catch {
      expiresStr = "";
    }
  }

  const disclaimerParts = [expiresStr, minOrderStr ? `Đơn tối thiểu ${minOrderStr}` : null].filter(Boolean);
  const disclaimer = disclaimerParts.length > 0 ? disclaimerParts.join(" - ") : "Áp dụng theo điều kiện.";

  if (!isOpen) return null;

  return (
    <div
      className={styles["admin-coupon-upsert-modal"]}
      role="dialog"
      aria-modal="true"
    >
      <div className={styles["admin-coupon-upsert-modal__panel"]}>
        <p className={styles["admin-coupon-upsert-modal__breadcrumb"]}>
          <span>Admin</span>
          <span className={styles["admin-coupon-upsert-modal__breadcrumb-sep"]}>
            /
          </span>
          <span>Mã giảm giá</span>
          <span className={styles["admin-coupon-upsert-modal__breadcrumb-sep"]}>
            /
          </span>
          <span>{isEdit ? "Chỉnh sửa" : "Tạo mới"}</span>
        </p>

        <header className={styles["admin-coupon-upsert-modal__header"]}>
          <div className={styles["admin-coupon-upsert-modal__title-group"]}>
            <h2 className={styles["admin-coupon-upsert-modal__title"]}>
              {title}
            </h2>
            <p className={styles["admin-coupon-upsert-modal__subtitle"]}>
              {subtitle}
            </p>
          </div>
          <div className={styles["admin-coupon-upsert-modal__header-actions"]}>
            <button
              type="button"
              className={styles["admin-coupon-upsert-modal__discard-button"]}
              onClick={handleClose}
            >
              Huỷ
            </button>
            <button
              type="submit"
              form="admin-coupon-upsert-form"
              className={styles["admin-coupon-upsert-modal__submit-button"]}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Đang xử lý..." : primaryLabel}
            </button>
            <button
              type="button"
              className={styles["admin-coupon-upsert-modal__close-button"]}
              onClick={handleClose}
              aria-label="Đóng"
            >
              <MdClose />
            </button>
          </div>
        </header>

        <form
          id="admin-coupon-upsert-form"
          className={styles["admin-coupon-upsert-modal__body"]}
          onSubmit={handleSubmit(onSubmit)}
        >
          <div className={styles["admin-coupon-upsert-modal__grid"]}>
            <div className={styles["admin-coupon-upsert-modal__left"]}>
              <div className={styles["admin-coupon-upsert-modal__card"]}>
                <div className={styles["admin-coupon-upsert-modal__card-header"]}>
                  <div
                    className={styles["admin-coupon-upsert-modal__card-icon"]}
                  >
                    <MdSettings />
                  </div>
                  <span
                    className={styles["admin-coupon-upsert-modal__card-title"]}
                  >
                    Cấu hình chung
                  </span>
                </div>
                <div className={styles["admin-coupon-upsert-modal__body"]}>
                  <div
                    className={styles["admin-coupon-upsert-modal__field-row"]}
                  >
                    <label
                      className={
                        styles["admin-coupon-upsert-modal__field-label"]
                      }
                    >
                      Mã giảm giá
                    </label>
                    <div
                      className={
                        styles["admin-coupon-upsert-modal__code-row"]
                      }
                    >
                      <div
                        className={
                          styles["admin-coupon-upsert-modal__code-input-wrap"]
                        }
                      >
                        <input
                          type="text"
                          className={`${styles["admin-coupon-upsert-modal__input"]} ${errors.code ? styles["admin-coupon-upsert-modal__input--error"] : ""}`}
                          placeholder="VD: SUMMER2024"
                          {...register("code")}
                        />
                        {errors.code && (
                          <p
                            className={
                              styles["admin-coupon-upsert-modal__error"]
                            }
                          >
                            {errors.code.message}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        className={
                          styles["admin-coupon-upsert-modal__ai-button"]
                        }
                        onClick={handleGenerateAi}
                        disabled={isGeneratingAi}
                        title="AI gợi ý cấu hình mã"
                      >
                        <MdAutoAwesome />
                        {isGeneratingAi ? "Đang xử lý..." : "AI gợi ý cấu hình"}
                      </button>
                    </div>
                  </div>

                  <div
                    className={styles["admin-coupon-upsert-modal__field-row"]}
                  >
                    <label
                      className={
                        styles["admin-coupon-upsert-modal__field-label"]
                      }
                    >
                      Loại giảm giá
                    </label>
                    <select
                      className={styles["admin-coupon-upsert-modal__input"]}
                      {...register("type")}
                    >
                      <option value="PERCENTAGE">Phần trăm (%)</option>
                      <option value="FIXED">Số tiền cố định (VND)</option>
                      <option value="FREE_SHIPPING">Miễn phí vận chuyển</option>
                    </select>
                  </div>

                  <div
                    className={styles["admin-coupon-upsert-modal__field-row"]}
                  >
                    <label
                      className={
                        styles["admin-coupon-upsert-modal__field-label"]
                      }
                    >
                      Mô tả
                    </label>
                    <textarea
                      className={styles["admin-coupon-upsert-modal__textarea"]}
                      placeholder="Giải thích ưu đãi (VD: Giảm 20% cho tất cả tai nghe)"
                      {...register("description")}
                    />
                    {errors.description && (
                      <p
                        className={
                          styles["admin-coupon-upsert-modal__error"]
                        }
                      >
                        {errors.description.message}
                      </p>
                    )}
                  </div>

                  <div
                    className={styles["admin-coupon-upsert-modal__field-row"]}
                  >
                    <label
                      className={
                        styles["admin-coupon-upsert-modal__field-label"]
                      }
                    >
                      Giá trị giảm{" "}
                      {typeWatch === "PERCENTAGE"
                        ? "(%)"
                        : typeWatch === "FREE_SHIPPING"
                          ? "(VND, để trống = miễn toàn bộ)"
                          : "(VND)"}
                    </label>
                    <div
                      className={
                        styles["admin-coupon-upsert-modal__input-wrap"]
                      }
                    >
                      <input
                        type="number"
                        min={typeWatch === "PERCENTAGE" ? 1 : 0}
                        max={typeWatch === "PERCENTAGE" ? 100 : undefined}
                        step={typeWatch === "PERCENTAGE" ? 1 : 1000}
                        className={`${styles["admin-coupon-upsert-modal__input"]} ${errors.value ? styles["admin-coupon-upsert-modal__input--error"] : ""}`}
                        placeholder={
                          typeWatch === "PERCENTAGE"
                            ? "20"
                            : typeWatch === "FREE_SHIPPING"
                              ? "Để trống = miễn toàn bộ"
                              : "500000"
                        }
                        {...register("value", { valueAsNumber: true })}
                      />
                      {typeWatch === "PERCENTAGE" && (
                        <span
                          className={
                            styles["admin-coupon-upsert-modal__input-suffix"]
                          }
                        >
                          %
                        </span>
                      )}
                      {typeWatch !== "PERCENTAGE" && (
                        <span
                          className={
                            styles["admin-coupon-upsert-modal__input-suffix"]
                          }
                        >
                          VND
                        </span>
                      )}
                    </div>
                    {errors.value && (
                      <p
                        className={
                          styles["admin-coupon-upsert-modal__error"]
                        }
                      >
                        {errors.value.message}
                      </p>
                    )}
                  </div>

                  <div
                    className={styles["admin-coupon-upsert-modal__field-row"]}
                  >
                    <label
                      className={
                        styles["admin-coupon-upsert-modal__field-label"]
                      }
                    >
                      Giảm tối đa (VND)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      className={styles["admin-coupon-upsert-modal__input"]}
                      placeholder="Để trống = không giới hạn"
                      {...register("maxDiscount", { valueAsNumber: true })}
                    />
                  </div>

                  <div
                    className={styles["admin-coupon-upsert-modal__field-row"]}
                  >
                    <label
                      className={
                        styles["admin-coupon-upsert-modal__field-label"]
                      }
                    >
                      Đơn tối thiểu (VND)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={10000}
                      className={styles["admin-coupon-upsert-modal__input"]}
                      placeholder="0"
                      {...register("minOrderAmount", { valueAsNumber: true })}
                    />
                  </div>
                </div>
              </div>

              <div
                className={`${styles["admin-coupon-upsert-modal__card"]} ${styles["admin-coupon-upsert-modal__card--preview"]}`}
              >
                <div className={styles["admin-coupon-upsert-modal__card-header"]}>
                  <div
                    className={styles["admin-coupon-upsert-modal__card-icon"]}
                  >
                    <MdVisibility />
                  </div>
                  <span
                    className={`${styles["admin-coupon-upsert-modal__card-title"]} ${styles["admin-coupon-upsert-modal__card-title--preview"]}`}
                  >
                    Góc nhìn khách hàng
                  </span>
                </div>
                <div
                  className={styles["admin-coupon-upsert-modal__preview-inner"]}
                >
                  <MdHeadphones
                    className={
                      styles["admin-coupon-upsert-modal__preview-icon-corner"]
                    }
                    aria-hidden
                  />
                  <p
                    className={
                      styles["admin-coupon-upsert-modal__preview-badge"]
                    }
                  >
                    Ưu đãi giới hạn
                  </p>
                  <p
                    className={
                      styles["admin-coupon-upsert-modal__preview-headline"]
                    }
                  >
                    {previewHeadline}
                  </p>
                  <p
                    className={
                      styles["admin-coupon-upsert-modal__preview-desc"]
                    }
                  >
                    {previewDesc}
                  </p>
                  <div
                    className={
                      styles["admin-coupon-upsert-modal__preview-apply-row"]
                    }
                  >
                    <input
                      type="text"
                      readOnly
                      className={
                        styles["admin-coupon-upsert-modal__preview-code-input"]
                      }
                      value={codeWatch ?? ""}
                    />
                    <button
                      type="button"
                      className={styles["admin-coupon-upsert-modal__preview-copy-btn"]}
                      onClick={handleCopyCode}
                      aria-label="Sao chép mã"
                      title="Sao chép mã"
                    >
                      <MdContentCopy />
                    </button>
                    <span
                      className={
                        styles["admin-coupon-upsert-modal__preview-apply-btn"]
                      }
                    >
                      Áp dụng
                    </span>
                  </div>
                  <p
                    className={
                      styles["admin-coupon-upsert-modal__preview-disclaimer"]
                    }
                  >
                    {disclaimer}
                  </p>
                </div>
              </div>
            </div>

            <div className={styles["admin-coupon-upsert-modal__right"]}>
              <div className={styles["admin-coupon-upsert-modal__card"]}>
                <div className={styles["admin-coupon-upsert-modal__card-header"]}>
                  <div
                    className={styles["admin-coupon-upsert-modal__card-icon"]}
                  >
                    <MdCheckCircle />
                  </div>
                  <span
                    className={styles["admin-coupon-upsert-modal__card-title"]}
                  >
                    Sử dụng & thời hạn
                  </span>
                </div>
                <div className={styles["admin-coupon-upsert-modal__body"]}>
                  <div
                    className={
                      styles["admin-coupon-upsert-modal__toggle-row"]
                    }
                  >
                    <span
                      className={
                        styles["admin-coupon-upsert-modal__toggle-label"]
                      }
                    >
                      Trạng thái
                    </span>
                    <button
                      type="button"
                      className={`${styles["admin-coupon-upsert-modal__toggle"]} ${watch("isActive") ? styles["admin-coupon-upsert-modal__toggle--checked"] : ""}`}
                      onClick={() =>
                        setValue("isActive", !watch("isActive"), {
                          shouldDirty: true,
                        })
                      }
                      aria-label={watch("isActive") ? "Tắt mã" : "Bật mã"}
                    >
                      <span
                        className={
                          styles["admin-coupon-upsert-modal__toggle-thumb"]
                        }
                      />
                    </button>
                  </div>
                  <p
                    className={
                      styles["admin-coupon-upsert-modal__toggle-hint"]
                    }
                  >
                    Cho phép khách hàng sử dụng mã này
                  </p>

                  <div
                    className={styles["admin-coupon-upsert-modal__field-row"]}
                  >
                    <label
                      className={
                        styles["admin-coupon-upsert-modal__field-label"]
                      }
                    >
                      Giới hạn lượt dùng (mã)
                    </label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      className={styles["admin-coupon-upsert-modal__input"]}
                      placeholder="Để trống = không giới hạn"
                      {...register("usageLimit", { valueAsNumber: true })}
                    />
                    <p
                      className={
                        styles["admin-coupon-upsert-modal__field-hint"]
                      }
                    >
                      Để trống = không giới hạn lượt đổi
                    </p>
                  </div>

                  <div
                    className={styles["admin-coupon-upsert-modal__field-row"]}
                  >
                    <label
                      className={
                        styles["admin-coupon-upsert-modal__field-label"]
                      }
                    >
                      Bắt đầu
                    </label>
                    <input
                      type="datetime-local"
                      className={styles["admin-coupon-upsert-modal__input"]}
                      {...register("startsAt")}
                    />
                  </div>

                  <div
                    className={styles["admin-coupon-upsert-modal__field-row"]}
                  >
                    <label
                      className={
                        styles["admin-coupon-upsert-modal__field-label"]
                      }
                    >
                      Kết thúc
                    </label>
                    <input
                      type="datetime-local"
                      className={`${styles["admin-coupon-upsert-modal__input"]} ${errors.endsAt ? styles["admin-coupon-upsert-modal__input--error"] : ""}`}
                      {...register("endsAt")}
                    />
                    {errors.endsAt && (
                      <p
                        className={
                          styles["admin-coupon-upsert-modal__error"]
                        }
                      >
                        {errors.endsAt.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div
                className={`${styles["admin-coupon-upsert-modal__card"]} ${styles["admin-coupon-upsert-modal__card--tip"]}`}
              >
                <div className={styles["admin-coupon-upsert-modal__card-header"]}>
                  <div
                    className={`${styles["admin-coupon-upsert-modal__card-icon"]} ${styles["admin-coupon-upsert-modal__card-icon--tip"]}`}
                  >
                    <MdInfoOutline />
                  </div>
                  <span
                    className={`${styles["admin-coupon-upsert-modal__card-title"]} ${styles["admin-coupon-upsert-modal__card-title--tip"]}`}
                  >
                    Quick Tip
                  </span>
                </div>
                <p
                  className={styles["admin-coupon-upsert-modal__tip-text"]}
                  dangerouslySetInnerHTML={{
                    __html: QUICK_TIP_TEXT.replace(
                      /\*\*(.+?)\*\*/g,
                      "<strong>$1</strong>",
                    ),
                  }}
                />
              </div>
            </div>
          </div>

          <div className={styles["admin-coupon-upsert-modal__actions"]}>
            <button
              type="button"
              className={styles["admin-coupon-upsert-modal__discard-button"]}
              onClick={handleClose}
            >
              Huỷ
            </button>
            <button
              type="submit"
              className={styles["admin-coupon-upsert-modal__submit-button"]}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Đang xử lý..." : primaryLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminCouponUpsertModal;
