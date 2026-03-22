"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { toast } from "sonner";
import AdminSidebar from "@/components/layout/AdminSidebar";
import styles from "./AdminLayout.module.css";

type AdminLayoutClientProps = {
  children: React.ReactNode;
};

export default function AdminLayoutClient({ children }: AdminLayoutClientProps) {
  const router = useRouter();
  const { data: session } = useSession();

  const handleLogout = async () => {
    await signOut({ redirect: false });
    toast.success("Đăng xuất thành công.");
    router.push("/login");
  };

  const sidebarUser = session?.user
    ? {
        name: session.user.name ?? session.user.email ?? "Admin",
        role: session.user.role === "ADMIN" ? "Super Admin" : "User",
        avatarUrl: session.user.image ?? null,
      }
    : undefined;

  return (
    <div className={styles["admin-layout-layout"]}>
      <AdminSidebar
        user={sidebarUser}
        onLogout={handleLogout}
        onGoToShop={() => router.push("/")}
      />
      <main className={styles["admin-layout-layout__main"]}>{children}</main>
    </div>
  );
}
