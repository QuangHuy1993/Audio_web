import React from "react";
import AdminUserDetailPage from "@/features/admin/components/users/AdminUserDetailPage";

type AdminUserDetailRouteProps = {
  params: Promise<{
    id: string;
  }>;
};

const AdminUserDetailRoute = async ({ params }: AdminUserDetailRouteProps) => {
  const { id } = await params;
  return <AdminUserDetailPage userId={id} />;
};

export default AdminUserDetailRoute;

