"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    MdPerson,
    MdReceiptLong,
    MdFavorite,
    MdConfirmationNumber,
    MdLocationOn,
    MdRateReview,
    MdLock
} from "react-icons/md";
import { toast } from "sonner";
import clsx from "clsx";
import styles from "./UserProfile.module.css";
import ChangePasswordModal from "./ChangePasswordModal";

const ProfileSidebar: React.FC = () => {
    const pathname = usePathname();
    const [profile, setProfile] = useState<any>(null);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

    useEffect(() => {
        fetch("/api/shop/profile")
            .then(res => res.json())
            .then(data => setProfile(data))
            .catch(err => console.error("Failed to fetch profile in sidebar:", err));
    }, []);

    const navItems = [
        { href: "/account/profile", label: "Thông tin cá nhân", icon: MdPerson },
        { href: "/account/orders", label: "Đơn hàng của tôi", icon: MdReceiptLong },
        { href: "/account/wishlist", label: "Danh sách yêu thích", icon: MdFavorite },
        { href: "/account/vouchers", label: "Ví voucher", icon: MdConfirmationNumber },
        { href: "/account/address", label: "Địa chỉ giao hàng", icon: MdLocationOn },
        { href: "/account/reviews", label: "Đánh giá của tôi", icon: MdRateReview },
    ];

    return (
        <>
            <aside className={styles["user-profile-content__sidebar"]}>
                <div className={styles["user-profile-content__glass-card"]}>
                    <div className={styles["user-profile-content__sidebar-header"]}>
                        <p className={styles["user-profile-content__sidebar-title"]}>Menu quản lý</p>
                    </div>
                    <nav className={styles["user-profile-content__sidebar-nav"]}>
                        {navItems.map((item) => (
                            <Link
                                key={item.label}
                                href={item.href}
                                className={clsx(
                                    styles["user-profile-content__sidebar-link"],
                                    pathname === item.href && styles["user-profile-content__sidebar-link--active"]
                                )}
                            >
                                <item.icon className={styles["user-profile-content__sidebar-link-icon"]} />
                                {item.label}
                            </Link>
                        ))}
                        <div className={styles["user-profile-content__sidebar-divider"]} />
                        <Link
                            href="/account/security"
                            className={clsx(
                                styles["user-profile-content__sidebar-link"],
                                pathname === "/account/security" && styles["user-profile-content__sidebar-link--active"]
                            )}
                        >
                            <MdLock className={styles["user-profile-content__sidebar-link-icon"]} />
                            Bảo mật tài khoản
                        </Link>
                    </nav>
                </div>
            </aside>

            <ChangePasswordModal
                isOpen={isPasswordModalOpen}
                onClose={() => setIsPasswordModalOpen(false)}
            />
        </>
    );
};

export default ProfileSidebar;
