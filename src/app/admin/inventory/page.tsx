import { Suspense } from "react";
import AdminInventoryDashboardPage from "@/features/admin/components/inventory/AdminInventoryDashboardPage";

export default function InventoryPage() {
  return (
    <Suspense fallback={null}>
      <AdminInventoryDashboardPage />
    </Suspense>
  );
}

