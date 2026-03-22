import React from "react";
import AdminCouponUpsertPage from "@/features/admin/components/promotions/AdminCouponUpsertPage";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminPromotionEditRoute({ params }: PageProps) {
  const { id } = await params;
  return <AdminCouponUpsertPage mode="edit" couponId={id} />;
}
