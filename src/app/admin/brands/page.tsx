import React, { Suspense } from "react";
import AdminBrandManagementPage from "@/features/admin/components/brands/AdminBrandManagementPage";

export default function AdminBrandsRoute() {
  return (
    <Suspense fallback={null}>
      <AdminBrandManagementPage />
    </Suspense>
  );
}
