import React, { Suspense } from "react";
import AdminBrandDetailPage from "@/features/admin/components/brands/AdminBrandDetailPage";

export default function AdminBrandDetailRoute() {
  return (
    <Suspense fallback={null}>
      <AdminBrandDetailPage />
    </Suspense>
  );
}
