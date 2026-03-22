"use client";

import React, { useEffect, useState } from "react";
import ShopHeader from "@/components/layout/ShopHeader";
import ShopFooter from "@/components/layout/ShopFooter";
import PageTransitionOverlay from "@/components/shared/PageTransitionOverlay";
import ProfileSidebar from "@/features/account/components/ProfileSidebar";
import styles from "@/app/page.module.css";
import profileStyles from "@/features/account/components/UserProfile.module.css";
import { usePathname } from "next/navigation";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
    const [isTransitionActive, setIsTransitionActive] = useState(true);
    const pathname = usePathname();

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            setIsTransitionActive(false);
        }, 1100);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, []);

    // Determine transition message based on path
    const getTransitionData = () => {
        if (pathname.includes("/orders")) {
            return {
                subtitle: "Đang chuẩn bị lịch sử giao dịch của bạn...",
                bottomText: "Đức Uy Audio đồng hành cùng trải nghiệm âm thanh của bạn..."
            };
        }
        if (pathname.includes("/address")) {
            return {
                subtitle: "Đang tải danh sách địa chỉ giao hàng...",
                bottomText: "Đảm bảo thông tin giao hàng chính xác..."
            };
        }
        return {
            subtitle: "Đang chuyển đến trang quản lý tài khoản...",
            bottomText: "Đức Uy Audio bảo mật thông tin của bạn..."
        };
    };

    const transitionData = getTransitionData();

    return (
        <div className={`app-homepage-bg ${styles["home-page-page"]}`}>
            <PageTransitionOverlay
                isActive={isTransitionActive}
                subtitle={transitionData.subtitle}
                bottomText={transitionData.bottomText}
            />
            <ShopHeader />
            <main>
                <div className={profileStyles["user-profile-content"]}>
                    <div className={profileStyles["user-profile-content__container"]}>
                        <div className={profileStyles["user-profile-content__layout"]}>
                            <ProfileSidebar />
                            <div className={profileStyles["user-profile-content__main"]}>
                                {children}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            <ShopFooter />
        </div>
    );
}
