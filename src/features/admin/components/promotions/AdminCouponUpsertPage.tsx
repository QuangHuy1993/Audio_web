"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
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
import modalStyles from "./AdminCouponUpsertModal.module.css";
import pageStyles from "./AdminCouponUpsertPage.module.css";

type CouponType = "PERCENTAGE" | "FIXED" | "FREE_SHIPPING";

const upsertCouponSchema = z
  .object({
    code: z.string().trim().min(1, "Mã giảm giá là bắt buộc.").max(40, "Mã quá dài."),
    description: z.string().trim().max(500).optional().or(z.literal("")),
    type: z.enum(["PERCENTAGE", "FIXED", "FREE_SHIPPING"]),
    value: z.union([z.number(), z.literal("")]).optional().transform((v): number | undefined => {
      if (v === "" || v == null) return undefined;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : undefined;
    }),
    maxDiscount: z.union([z.number(), z.literal("")]).optional().transform((v): number | undefined => {
      if (v === "" || v == null) return undefined;
      return Number.isFinite(Number(v)) ? Number(v) : undefined;
    }),
    minOrderAmount: z.union([z.number(), z.literal("")]).optional().transform((v): number | undefined => {
      if (v === "" || v == null) return undefined;
      return Number.isFinite(Number(v)) ? Number(v) : undefined;
    }),
    usageLimit: z.union([z.number(), z.literal("")]).optional().transform((v): number | undefined => {
      if (v === "" || v == null) return undefined;
      const n = Number(v);
      return Number.isInteger(n) && n > 0 ? n : undefined;
    }),
    usageLimitPerUser: z.union([z.number(), z.literal("")]).optional().transform((v): number | undefined => {
      if (v === "" || v == null) return undefined;
      const n = Number(v);
      return Number.isInteger(n) && n > 0 ? n : undefined;
    }),
    startsAt: z.string().trim().optional().or(z.literal("")),
    endsAt: z.string().trim().optional().or(z.literal("")),
    isActive: z.boolean(),
  })
  .refine(
    (d) => {
      if (d.type === "PERCENTAGE" && d.value != null) return d.value > 0 && d.value <= 100;
      if ((d.type === "FIXED" || d.type === "FREE_SHIPPING") && d.value != null) return d.value >= 0;
      return true;
    },
    { message: "PERCENTAGE: 1–100; FIXED/FREE_SHIPPING: >= 0.", path: ["value"] },
  )
  .refine(
    (d) => {
      if (!d.startsAt || !d.endsAt) return true;
      return new Date(d.endsAt).getTime() > new Date(d.startsAt).getTime();
    },
    { message: "Ngày kết thúc phải sau ngày bắt đầu.", path: ["endsAt"] },
  );

type UpsertCouponFormValues = z.infer<typeof upsertCouponSchema>;

type CouponData = {
  id: string;
  code: string;
  description: string | null;
  type: CouponType;
  value: number | null;
  maxDiscount: number | null;
  minOrderAmount: number | null;
  usageLimit: number | null;
  usageLimitPerUser: number | null;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

function toLocalDateTime(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

function formatVnd(n: number): string {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n);
}

const QUICK_TIP_TEXT =
  'Mã giảm giá có **thời hạn 24 giờ** và "Mỗi khách 1 lượt" thường có tỷ lệ chuyển đổi cao hơn khoảng 40% cho thiết bị âm thanh. Cân nhắc dùng cho flash sale.';

type AdminCouponUpsertPageProps = {
  mode: "create" | "edit";
  couponId?: string;
};

export default function AdminCouponUpsertPage({ mode, couponId }: AdminCouponUpsertPageProps) {
  const router = useRouter();
  const isEdit = mode === "edit";
  const [loading, setLoading] = useState(isEdit && !!couponId);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpsertCouponFormValues>({
    resolver: zodResolver(upsertCouponSchema) as Resolver<UpsertCouponFormValues>,
    defaultValues: {
      code: "",
      description: "",
      type: "PERCENTAGE",
      value: undefined,
      maxDiscount: undefined,
      minOrderAmount: undefined,
      usageLimit: undefined,
      usageLimitPerUser: undefined,
      startsAt: "",
      endsAt: "",
      isActive: true,
    },
  });

  const typeWatch = watch("type");
  const codeWatch = watch("code");
  const descriptionWatch = watch("description");
  const valueWatch = watch("value");
  const minOrderAmountWatch = watch("minOrderAmount");
  const endsAtWatch = watch("endsAt");

  useEffect(() => {
    if (mode !== "edit" || !couponId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/coupons/${encodeURIComponent(couponId)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Không tải được mã giảm giá.");
        return res.json();
      })
      .then((json: { data?: CouponData }) => {
        if (cancelled || !json.data) return;
        const c = json.data;
        reset({
          code: c.code,
          description: c.description ?? "",
          type: c.type,
          value: c.value ?? undefined,
          maxDiscount: c.maxDiscount ?? undefined,
          minOrderAmount: c.minOrderAmount ?? undefined,
          usageLimit: c.usageLimit ?? undefined,
          usageLimitPerUser: c.usageLimitPerUser ?? undefined,
          startsAt: toLocalDateTime(c.startsAt),
          endsAt: toLocalDateTime(c.endsAt),
          isActive: c.isActive,
        });
      })
      .catch(() => {
        if (!cancelled) toast.error("Không tải được thông tin mã giảm giá.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, couponId, reset]);

  const onSubmit = async (values: UpsertCouponFormValues) => {
    const payload = {
      code: values.code.trim(),
      description: values.description?.trim() || null,
      type: values.type,
      value: values.value ?? null,
      maxDiscount: values.maxDiscount ?? null,
      minOrderAmount: values.minOrderAmount ?? null,
      usageLimit: values.usageLimit ?? null,
      usageLimitPerUser: values.usageLimitPerUser ?? null,
      startsAt: values.startsAt?.trim() || null,
      endsAt: values.endsAt?.trim() || null,
      isActive: values.isActive,
    };
    try {
      const url = isEdit && couponId ? `/api/admin/coupons/${encodeURIComponent(couponId)}` : "/api/admin/coupons";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? (isEdit ? "Không thể cập nhật." : "Không thể tạo mã."));
        return;
      }
      toast.success(isEdit ? "Cập nhật mã giảm giá thành công." : "Tạo mã giảm giá thành công.");
      router.push("/admin/promotions");
    } catch {
      toast.error("Đã xảy ra lỗi. Vui lòng thử lại.");
    }
  };

  const handleGenerateAi = async () => {
    if (isGeneratingAi || isSubmitting) return;
    setIsGeneratingAi(true);
    try {
      const res = await fetch("/api/admin/coupons/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredType: typeWatch,
          campaignTitle: watch("description")?.trim() || undefined,
          discountPercent: typeWatch === "PERCENTAGE" ? watch("value") : undefined,
          discountFixedVnd: typeWatch === "FIXED" ? watch("value") : undefined,
          freeShipping: typeWatch === "FREE_SHIPPING",
          minOrderAmountVnd: watch("minOrderAmount"),
          maxDiscountVnd: watch("maxDiscount"),
          usageLimit: watch("usageLimit"),
          preferredStartsAt: watch("startsAt") || undefined,
          preferredEndsAt: watch("endsAt") || undefined,
        }),
      });
      const json = (await res.json()) as { error?: string; data?: { code: string; description: string; type: CouponType; value: number | null; maxDiscountVnd: number | null; minOrderAmountVnd: number | null; usageLimit: number | null; suggestedStartsAt: string | null; suggestedEndsAt: string | null } };
      if (!res.ok || !json.data) {
        toast.error(json.error ?? "Tính năng AI tạm thời không khả dụng.");
        return;
      }
      const d = json.data;
      setValue("code", d.code, { shouldDirty: true });
      setValue("description", d.description, { shouldDirty: true });
      setValue("type", d.type, { shouldDirty: true });
      setValue("value", d.value ?? undefined, { shouldDirty: true });
      setValue("maxDiscount", d.maxDiscountVnd ?? undefined, { shouldDirty: true });
      setValue("minOrderAmount", d.minOrderAmountVnd ?? undefined, { shouldDirty: true });
      setValue("usageLimit", d.usageLimit ?? undefined, { shouldDirty: true });
      setValue("startsAt", d.suggestedStartsAt ? toLocalDateTime(d.suggestedStartsAt) : "", { shouldDirty: true });
      setValue("endsAt", d.suggestedEndsAt ? toLocalDateTime(d.suggestedEndsAt) : "", { shouldDirty: true });
      toast.success("Đã gợi ý cấu hình mã. Bạn có thể chỉnh sửa trước khi lưu.");
    } catch {
      toast.error("Có lỗi khi gọi AI.");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleCopyCode = () => {
    const code = codeWatch?.trim();
    if (!code) return;
    void navigator.clipboard.writeText(code).then(() => toast.success("Đã sao chép mã."));
  };

  const title = isEdit ? "Chỉnh sửa mã giảm giá" : "Tạo mã giảm giá mới";
  const subtitle = isEdit ? "Cập nhật thông tin và điều kiện áp dụng cho khách hàng Đức Uy Audio." : "Cấu hình mã giảm giá và quy tắc sử dụng cho khách hàng Đức Uy Audio.";
  const primaryLabel = isEdit ? "Lưu thay đổi" : "Tạo mã";

  const previewHeadline =
    typeWatch === "PERCENTAGE" && valueWatch != null ? `GIẢM ${valueWatch}%` :
      typeWatch === "FIXED" && valueWatch != null ? `GIẢM ${formatVnd(valueWatch)}` :
        typeWatch === "FREE_SHIPPING" ? "MIỄN PHÍ VẬN CHUYỂN" : "ƯU ĐÃI";
  const previewDesc = descriptionWatch?.trim() || "Áp dụng cho đơn hàng đủ điều kiện tại Đức Uy Audio.";
  const minOrderStr = minOrderAmountWatch != null && Number(minOrderAmountWatch) > 0 ? formatVnd(Number(minOrderAmountWatch)) : null;
  let expiresStr = "";
  if (endsAtWatch?.trim()) {
    try {
      const days = Math.ceil((new Date(endsAtWatch).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      expiresStr = days > 0 ? `Hết hạn sau ${days} ngày` : "Đã hết hạn";
    } catch { /* ignore */ }
  }
  const disclaimer = [expiresStr, minOrderStr ? `Đơn tối thiểu ${minOrderStr}` : null].filter(Boolean).join(" - ") || "Áp dụng theo điều kiện.";

  if (loading) {
    return (
      <div className={pageStyles["admin-coupon-upsert-page"]}>
        <div className={pageStyles["admin-coupon-upsert-page__panel"]}>
          <div className={pageStyles["admin-coupon-upsert-page__loading"]}>Đang tải...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={pageStyles["admin-coupon-upsert-page"]}>
      <div className={pageStyles["admin-coupon-upsert-page__panel"]}>
        <p className={modalStyles["admin-coupon-upsert-modal__breadcrumb"]}>
          <span>Admin</span>
          <span className={modalStyles["admin-coupon-upsert-modal__breadcrumb-sep"]}>/</span>
          <Link href="/admin/promotions">Mã giảm giá</Link>
          <span className={modalStyles["admin-coupon-upsert-modal__breadcrumb-sep"]}>/</span>
          <span>{isEdit ? "Chỉnh sửa" : "Tạo mới"}</span>
        </p>

        <header className={modalStyles["admin-coupon-upsert-modal__header"]}>
          <div className={modalStyles["admin-coupon-upsert-modal__title-group"]}>
            <h2 className={modalStyles["admin-coupon-upsert-modal__title"]}>{title}</h2>
            <p className={modalStyles["admin-coupon-upsert-modal__subtitle"]}>{subtitle}</p>
          </div>
          <div className={modalStyles["admin-coupon-upsert-modal__header-actions"]}>
            <Link href="/admin/promotions" className={modalStyles["admin-coupon-upsert-modal__discard-button"]}>
              Huỷ
            </Link>
            <button type="submit" form="admin-coupon-upsert-form" className={modalStyles["admin-coupon-upsert-modal__submit-button"]} disabled={isSubmitting}>
              {isSubmitting ? "Đang xử lý..." : primaryLabel}
            </button>
          </div>
        </header>

        <form id="admin-coupon-upsert-form" className={modalStyles["admin-coupon-upsert-modal__body"]} onSubmit={handleSubmit(onSubmit)}>
          <div className={modalStyles["admin-coupon-upsert-modal__grid"]}>
            <div className={modalStyles["admin-coupon-upsert-modal__left"]}>
              <div className={modalStyles["admin-coupon-upsert-modal__card"]}>
                <div className={modalStyles["admin-coupon-upsert-modal__card-header"]}>
                  <div className={modalStyles["admin-coupon-upsert-modal__card-icon"]}><MdSettings /></div>
                  <span className={modalStyles["admin-coupon-upsert-modal__card-title"]}>Cấu hình chung</span>
                </div>
                <div className={modalStyles["admin-coupon-upsert-modal__body"]}>
                  <div className={modalStyles["admin-coupon-upsert-modal__field-row"]}>
                    <label className={modalStyles["admin-coupon-upsert-modal__field-label"]}>Mã giảm giá</label>
                    <div className={modalStyles["admin-coupon-upsert-modal__code-row"]}>
                      <div className={modalStyles["admin-coupon-upsert-modal__code-input-wrap"]}>
                        <input type="text" className={`${modalStyles["admin-coupon-upsert-modal__input"]} ${errors.code ? modalStyles["admin-coupon-upsert-modal__input--error"] : ""}`} placeholder="VD: SUMMER2024" {...register("code")} />
                        {errors.code && <p className={modalStyles["admin-coupon-upsert-modal__error"]}>{errors.code.message}</p>}
                      </div>
                      <button type="button" className={modalStyles["admin-coupon-upsert-modal__ai-button"]} onClick={handleGenerateAi} disabled={isGeneratingAi} title="AI gợi ý cấu hình mã">
                        <MdAutoAwesome /> {isGeneratingAi ? "Đang xử lý..." : "AI gợi ý cấu hình"}
                      </button>
                    </div>
                  </div>
                  <div className={modalStyles["admin-coupon-upsert-modal__field-row"]}>
                    <label className={modalStyles["admin-coupon-upsert-modal__field-label"]}>Loại giảm giá</label>
                    <select className={modalStyles["admin-coupon-upsert-modal__input"]} {...register("type")}>
                      <option value="PERCENTAGE">Phần trăm (%)</option>
                      <option value="FIXED">Số tiền cố định (VND)</option>
                      <option value="FREE_SHIPPING">Miễn phí vận chuyển</option>
                    </select>
                  </div>
                  <div className={modalStyles["admin-coupon-upsert-modal__field-row"]}>
                    <label className={modalStyles["admin-coupon-upsert-modal__field-label"]}>Mô tả</label>
                    <textarea className={modalStyles["admin-coupon-upsert-modal__textarea"]} placeholder="Giải thích ưu đãi (VD: Giảm 20% cho tất cả tai nghe)" {...register("description")} />
                    {errors.description && <p className={modalStyles["admin-coupon-upsert-modal__error"]}>{errors.description.message}</p>}
                  </div>
                  <div className={modalStyles["admin-coupon-upsert-modal__field-row"]}>
                    <label className={modalStyles["admin-coupon-upsert-modal__field-label"]}>Giá trị giảm {typeWatch === "PERCENTAGE" ? "(%)" : typeWatch === "FREE_SHIPPING" ? "(VND, để trống = miễn toàn bộ)" : "(VND)"}</label>
                    <div className={modalStyles["admin-coupon-upsert-modal__input-wrap"]}>
                      <input type="number" min={typeWatch === "PERCENTAGE" ? 1 : 0} max={typeWatch === "PERCENTAGE" ? 100 : undefined} step={typeWatch === "PERCENTAGE" ? 1 : 1000} className={`${modalStyles["admin-coupon-upsert-modal__input"]} ${errors.value ? modalStyles["admin-coupon-upsert-modal__input--error"] : ""}`} placeholder={typeWatch === "PERCENTAGE" ? "20" : typeWatch === "FREE_SHIPPING" ? "Để trống = miễn toàn bộ" : "500000"} {...register("value", { valueAsNumber: true })} />
                      {typeWatch === "PERCENTAGE" && <span className={modalStyles["admin-coupon-upsert-modal__input-suffix"]}>%</span>}
                      {typeWatch !== "PERCENTAGE" && <span className={modalStyles["admin-coupon-upsert-modal__input-suffix"]}>VND</span>}
                    </div>
                    {errors.value && <p className={modalStyles["admin-coupon-upsert-modal__error"]}>{errors.value.message}</p>}
                  </div>
                  <div className={modalStyles["admin-coupon-upsert-modal__field-row"]}>
                    <label className={modalStyles["admin-coupon-upsert-modal__field-label"]}>Giảm tối đa (VND)</label>
                    <input type="number" min={0} step={1000} className={modalStyles["admin-coupon-upsert-modal__input"]} placeholder="Để trống = không giới hạn" {...register("maxDiscount", { valueAsNumber: true })} />
                  </div>
                  <div className={modalStyles["admin-coupon-upsert-modal__field-row"]}>
                    <label className={modalStyles["admin-coupon-upsert-modal__field-label"]}>Đơn tối thiểu (VND)</label>
                    <input type="number" min={0} step={10000} className={modalStyles["admin-coupon-upsert-modal__input"]} placeholder="0" {...register("minOrderAmount", { valueAsNumber: true })} />
                  </div>
                </div>
              </div>

              <div className={`${modalStyles["admin-coupon-upsert-modal__card"]} ${modalStyles["admin-coupon-upsert-modal__card--preview"]}`}>
                <div className={modalStyles["admin-coupon-upsert-modal__card-header"]}>
                  <div className={modalStyles["admin-coupon-upsert-modal__card-icon"]}><MdVisibility /></div>
                  <span className={`${modalStyles["admin-coupon-upsert-modal__card-title"]} ${modalStyles["admin-coupon-upsert-modal__card-title--preview"]}`}>Góc nhìn khách hàng</span>
                </div>
                <div className={modalStyles["admin-coupon-upsert-modal__preview-inner"]}>
                  <MdHeadphones className={modalStyles["admin-coupon-upsert-modal__preview-icon-corner"]} aria-hidden />
                  <p className={modalStyles["admin-coupon-upsert-modal__preview-badge"]}>Ưu đãi giới hạn</p>
                  <p className={modalStyles["admin-coupon-upsert-modal__preview-headline"]}>{previewHeadline}</p>
                  <p className={modalStyles["admin-coupon-upsert-modal__preview-desc"]}>{previewDesc}</p>
                  <div className={modalStyles["admin-coupon-upsert-modal__preview-apply-row"]}>
                    <input type="text" readOnly className={modalStyles["admin-coupon-upsert-modal__preview-code-input"]} value={codeWatch ?? ""} />
                    <button type="button" className={modalStyles["admin-coupon-upsert-modal__preview-copy-btn"]} onClick={handleCopyCode} aria-label="Sao chép mã" title="Sao chép mã"><MdContentCopy /></button>
                    <span className={modalStyles["admin-coupon-upsert-modal__preview-apply-btn"]}>Áp dụng</span>
                  </div>
                  <p className={modalStyles["admin-coupon-upsert-modal__preview-disclaimer"]}>{disclaimer}</p>
                </div>
              </div>
            </div>

            <div className={modalStyles["admin-coupon-upsert-modal__right"]}>
              <div className={modalStyles["admin-coupon-upsert-modal__card"]}>
                <div className={modalStyles["admin-coupon-upsert-modal__card-header"]}>
                  <div className={modalStyles["admin-coupon-upsert-modal__card-icon"]}><MdCheckCircle /></div>
                  <span className={modalStyles["admin-coupon-upsert-modal__card-title"]}>Sử dụng & thời hạn</span>
                </div>
                <div className={modalStyles["admin-coupon-upsert-modal__body"]}>
                  <div className={modalStyles["admin-coupon-upsert-modal__status-section"]}>
                    <span className={modalStyles["admin-coupon-upsert-modal__status-section-title"]}>TRẠNG THÁI</span>
                    <hr className={modalStyles["admin-coupon-upsert-modal__status-divider"]} />
                    <div className={modalStyles["admin-coupon-upsert-modal__status-row"]}>
                      <button
                        type="button"
                        className={`${modalStyles["admin-coupon-upsert-modal__toggle"]} ${watch("isActive") ? modalStyles["admin-coupon-upsert-modal__toggle--checked"] : ""}`}
                        onClick={() => setValue("isActive", !watch("isActive"), { shouldDirty: true })}
                        aria-label={watch("isActive") ? "Tắt mã" : "Bật mã"}
                      >
                        <span className={modalStyles["admin-coupon-upsert-modal__toggle-thumb"]} />
                      </button>
                      <span className={`${modalStyles["admin-coupon-upsert-modal__status-badge"]} ${watch("isActive") ? modalStyles["admin-coupon-upsert-modal__status-badge--active"] : modalStyles["admin-coupon-upsert-modal__status-badge--inactive"]}`}>
                        {watch("isActive") ? "HOẠT ĐỘNG" : "TẮT"}
                      </span>
                    </div>
                  </div>
                  <p className={modalStyles["admin-coupon-upsert-modal__toggle-hint"]}>Cho phép khách hàng sử dụng mã này</p>

                  <div className={modalStyles["admin-coupon-upsert-modal__field-row"]}>
                    <label className={modalStyles["admin-coupon-upsert-modal__field-label"]}>Giới hạn lượt dùng (mã)</label>
                    <input type="number" min={1} step={1} className={modalStyles["admin-coupon-upsert-modal__input"]} placeholder="Để trống = không giới hạn" {...register("usageLimit", { valueAsNumber: true })} />
                    <p className={modalStyles["admin-coupon-upsert-modal__field-hint"]}>Tổng số lần mã này có thể được dùng</p>
                  </div>
                  <div className={modalStyles["admin-coupon-upsert-modal__field-row"]}>
                    <label className={modalStyles["admin-coupon-upsert-modal__field-label"]}>Giới hạn dùng / người</label>
                    <input type="number" min={1} step={1} className={modalStyles["admin-coupon-upsert-modal__input"]} placeholder="Để trống = không giới hạn" {...register("usageLimitPerUser", { valueAsNumber: true })} />
                    <p className={modalStyles["admin-coupon-upsert-modal__field-hint"]}>Số lần tối đa 1 khách hàng có thể dùng mã này</p>
                  </div>
                  <div className={modalStyles["admin-coupon-upsert-modal__field-row"]}>
                    <label className={modalStyles["admin-coupon-upsert-modal__field-label"]}>Bắt đầu</label>
                    <input type="datetime-local" className={modalStyles["admin-coupon-upsert-modal__input"]} {...register("startsAt")} />
                  </div>
                  <div className={modalStyles["admin-coupon-upsert-modal__field-row"]}>
                    <label className={modalStyles["admin-coupon-upsert-modal__field-label"]}>Kết thúc</label>
                    <input type="datetime-local" className={`${modalStyles["admin-coupon-upsert-modal__input"]} ${errors.endsAt ? modalStyles["admin-coupon-upsert-modal__input--error"] : ""}`} {...register("endsAt")} />
                    {errors.endsAt && <p className={modalStyles["admin-coupon-upsert-modal__error"]}>{errors.endsAt.message}</p>}
                  </div>
                </div>
              </div>

              <div className={`${modalStyles["admin-coupon-upsert-modal__card"]} ${modalStyles["admin-coupon-upsert-modal__card--tip"]}`}>
                <div className={modalStyles["admin-coupon-upsert-modal__card-header"]}>
                  <div className={`${modalStyles["admin-coupon-upsert-modal__card-icon"]} ${modalStyles["admin-coupon-upsert-modal__card-icon--tip"]}`}><MdInfoOutline /></div>
                  <span className={`${modalStyles["admin-coupon-upsert-modal__card-title"]} ${modalStyles["admin-coupon-upsert-modal__card-title--tip"]}`}>Quick Tip</span>
                </div>
                <p className={modalStyles["admin-coupon-upsert-modal__tip-text"]} dangerouslySetInnerHTML={{ __html: QUICK_TIP_TEXT.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>") }} />
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
