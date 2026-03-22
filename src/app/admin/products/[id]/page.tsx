import React, { Suspense } from "react";
import AdminProductEditPage from "@/features/admin/components/products/AdminProductEditPage";

export default function AdminProductEditRoute() {
  return (
    <Suspense fallback={null}>
      <AdminProductEditPage />
    </Suspense>
  );
}

