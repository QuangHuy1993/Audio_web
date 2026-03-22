import React from "react";
import AdminUserEditPage from "@/features/admin/components/users/AdminUserEditPage";

type AdminUserEditRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

const AdminUserEditRoute = async ({ params }: AdminUserEditRouteProps) => {
  const { id } = await params;
  return <AdminUserEditPage userId={id} />;
};

export default AdminUserEditRoute;

