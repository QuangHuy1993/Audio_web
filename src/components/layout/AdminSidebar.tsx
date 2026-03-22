"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaHeadphonesAlt } from "react-icons/fa";
import {
  MdAnalytics,
  MdBrandingWatermark,
  MdCategory,
  MdDashboard,
  MdGroup,
  MdHome,
  MdInventory2,
  MdLogout,
  MdSell,
  MdSettings,
  MdShoppingCart,
  MdSmartToy,
  MdRateReview,
} from "react-icons/md";
import type { IconType } from "react-icons";
import clsx from "clsx";
import styles from "./AdminSidebar.module.css";

export type AdminSidebarNavItem = {
  href?: string;
  label: string;
  icon: IconType;
  children?: {
    href: string;
    label: string;
  }[];
};

export const DEFAULT_NAV_ITEMS: AdminSidebarNavItem[] = [
  { href: "/admin/dashboard", label: "Tổng quan", icon: MdDashboard },
  { href: "/admin/categories", label: "Quản lý danh mục", icon: MdCategory },
  { href: "/admin/brands", label: "Quản lý thương hiệu", icon: MdBrandingWatermark },
  {
    label: "Quản lý sản phẩm",
    icon: MdInventory2,
    children: [
      { href: "/admin/products", label: "Sản phẩm" },
      { href: "/admin/inventory", label: "Kho hàng" },
    ],
  },
  { href: "/admin/orders", label: "Quản lý đơn hàng", icon: MdShoppingCart },
  { href: "/admin/reviews", label: "Quản lý đánh giá", icon: MdRateReview },
  { href: "/admin/users", label: "Quản lý người dùng ", icon: MdGroup },
  { href: "/admin/promotions", label: "Quản lý khuyến mãi", icon: MdSell },
  { href: "/admin/ai", label: "Quản lý AI", icon: MdSmartToy },
  { href: "/admin/reports", label: "Báo cáo thống kê", icon: MdAnalytics },
  { href: "/admin/settings", label: "Cài đặt hệ thống", icon: MdSettings },
];

export type AdminSidebarUser = {
  name: string;
  role: string;
  avatarUrl?: string | null;
};

const DEFAULT_USER: AdminSidebarUser = {
  name: "Admin hệ thống",
  role: "Super Admin",
  avatarUrl:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDRC8QtyWA-W972_k8LvJjdB-D33Ct-OUma-aMmbceN5L_W1JLgkCeMTUc9UByLaf2jKyELTgyaEM-InnTbJz5iccqiNsjcJOKeof-NG148q3omKl8-kfRpDNnGJoY1uYmx7drskKreVZbDIIoMmcLQv8Rr42p0Ej5516UMW3Q_fxHBH1tXmgQ6trBOueWDrl-kGEvcz7yVYYPGGxr4A5WibZjmKDkiIN2h7uBTZqbhuDZHn9cr6Icf5EMOxz1aWVuIMRmh2Jzk4SbK",
};

export type AdminSidebarProps = {
  navItems?: AdminSidebarNavItem[];
  user?: AdminSidebarUser | null;
  onLogout?: () => void;
  onGoToShop?: () => void;
};

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  navItems = DEFAULT_NAV_ITEMS,
  user = DEFAULT_USER,
  onLogout,
  onGoToShop,
}) => {
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const normalizedNavItems = useMemo(() => navItems, [navItems]);

  return (
    <aside className={styles["admin-sidebar-sidebar"]}>
      <div className={styles["admin-sidebar-sidebar__logo"]}>
        <div className={styles["admin-sidebar-sidebar__logo-icon"]}>
          <FaHeadphonesAlt aria-hidden="true" />
        </div>
        <div className={styles["admin-sidebar-sidebar__brand"]}>
          <span className={styles["admin-sidebar-sidebar__brand-title"]}>
            Đức Uy{" "}
            <span className={styles["admin-sidebar-sidebar__brand-title-highlight"]}>
              Audio
            </span>
          </span>
          <button
            type="button"
            className={styles["admin-sidebar-sidebar__back-to-shop"]}
            onClick={onGoToShop}
          >
            <MdHome
              className={styles["admin-sidebar-sidebar__back-to-shop-icon"]}
              aria-hidden="true"
            />
            <span className={styles["admin-sidebar-sidebar__back-to-shop-label"]}>
              Về trang người dùng
            </span>
          </button>
        </div>
      </div>

      <nav className={styles["admin-sidebar-sidebar__nav"]} aria-label="Menu quản trị">
        <div className={styles["admin-sidebar-sidebar__nav-list"]}>
          {normalizedNavItems.map((item) => {
            const Icon = item.icon;

            // Group with children: e.g. Quản lý sản phẩm → Sản phẩm / Kho hàng
            if (item.children && item.children.length > 0) {
              const anyChildActive = item.children.some((child) =>
                pathname.startsWith(child.href),
              );
              const isOpen = openGroups[item.label] ?? anyChildActive;

              return (
                <div
                  key={item.label}
                  className={styles["admin-sidebar-sidebar__nav-group"]}
                >
                  <button
                    type="button"
                    className={clsx(
                      styles["admin-sidebar-sidebar__nav-link"],
                      anyChildActive &&
                      styles["admin-sidebar-sidebar__nav-link--active-group"],
                    )}
                    onClick={() =>
                      setOpenGroups((prev) => ({
                        ...prev,
                        [item.label]: !isOpen,
                      }))
                    }
                    aria-expanded={isOpen}
                  >
                    <Icon
                      className={styles["admin-sidebar-sidebar__nav-link-icon"]}
                    />
                    <span
                      className={styles["admin-sidebar-sidebar__nav-link-label"]}
                    >
                      {item.label}
                    </span>
                  </button>
                  {isOpen && (
                    <div
                      className={
                        styles["admin-sidebar-sidebar__nav-sub-list"]
                      }
                    >
                      {item.children.map((child) => {
                        const isSubActive = pathname.startsWith(child.href);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={clsx(
                              styles["admin-sidebar-sidebar__nav-sub-link"],
                              isSubActive &&
                              styles[
                              "admin-sidebar-sidebar__nav-sub-link--active"
                              ],
                            )}
                          >
                            <span
                              className={
                                styles[
                                "admin-sidebar-sidebar__nav-sub-link-bullet"
                                ]
                              }
                              aria-hidden="true"
                            />
                            <span
                              className={
                                styles[
                                "admin-sidebar-sidebar__nav-sub-link-label"
                                ]
                              }
                            >
                              {child.label}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            if (!item.href) {
              return null;
            }

            const isActive =
              item.href === "/admin/dashboard"
                ? pathname === "/admin/dashboard"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  styles["admin-sidebar-sidebar__nav-link"],
                  isActive &&
                  styles["admin-sidebar-sidebar__nav-link--active"],
                )}
              >
                <Icon
                  className={styles["admin-sidebar-sidebar__nav-link-icon"]}
                />
                <span
                  className={styles["admin-sidebar-sidebar__nav-link-label"]}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className={styles["admin-sidebar-sidebar__user"]}>
        <div className={styles["admin-sidebar-sidebar__user-inner"]}>
          {user?.avatarUrl ? (
            <img
              className={styles["admin-sidebar-sidebar__user-avatar"]}
              src={user.avatarUrl}
              alt=""
            />
          ) : (
            <div
              className={styles["admin-sidebar-sidebar__user-avatar"]}
              style={{
                background: "rgba(255,255,255,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                fontWeight: 700,
              }}
            >
              {user?.name?.slice(0, 1)?.toUpperCase() ?? "A"}
            </div>
          )}
          <div className={styles["admin-sidebar-sidebar__user-info"]}>
            <p className={styles["admin-sidebar-sidebar__user-name"]}>
              {user?.name ?? "Admin"}
            </p>
            <p className={styles["admin-sidebar-sidebar__user-role"]}>
              {user?.role ?? "Super Admin"}
            </p>
          </div>
          <button
            type="button"
            className={styles["admin-sidebar-sidebar__user-logout"]}
            onClick={onLogout}
            aria-label="Đăng xuất"
          >
            <MdLogout />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default AdminSidebar;
