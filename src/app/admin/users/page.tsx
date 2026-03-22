import React, { Suspense } from "react";
import AdminUserManagementPage from "@/features/admin/components/users/AdminUserManagementPage";

export default function AdminUsersRoute() {
  return (
    <Suspense fallback={null}>
      <AdminUserManagementPage />
    </Suspense>
  );
}

