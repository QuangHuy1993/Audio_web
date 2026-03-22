import React, { Suspense } from "react";
import AdminPromotionManagementPage from "@/features/admin/components/promotions/AdminPromotionManagementPage";

export default function AdminPromotionsRoute() {
  return (
    <Suspense fallback={null}>
      <AdminPromotionManagementPage />
    </Suspense>
  );
}
