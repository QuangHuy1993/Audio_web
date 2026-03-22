import React, { Suspense } from "react";
import AdminProductManagementPage from "@/features/admin/components/products/AdminProductManagementPage";

export default function AdminProductsRoute() {
  return (
    <Suspense fallback={null}>
      <AdminProductManagementPage />
    </Suspense>
  );
}

