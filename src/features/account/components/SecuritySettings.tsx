"use client";

import React, { useState } from "react";
import { MdSecurity, MdLock } from "react-icons/md";
import { toast } from "sonner";
import styles from "./UserProfile.module.css";
import ChangePasswordModal from "./ChangePasswordModal";

interface SecuritySettingsProps {
    profile: any;
}

const SecuritySettings: React.FC<SecuritySettingsProps> = ({ profile }) => {
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

    return (
        <>
            <section className={styles["user-profile-content__section"]}>
                <div className={styles["user-profile-content__section-header"]}>
                    <div className={styles["user-profile-content__icon-box"]}>
                        <MdSecurity size={24} />
                    </div>
                    <h2 className={styles["user-profile-content__section-title"]}>Bảo mật & Tài khoản</h2>
                </div>
                <div className={styles["user-profile-content__security-list"]}>
                    <div className={styles["user-profile-content__security-item"]}>
                        <div>
                            <p className={styles["user-profile-content__item-label"]}>Mật khẩu</p>
                            <p className={styles["user-profile-content__item-desc"]}>Thay đổi mật khẩu định kỳ để bảo vệ tài khoản</p>
                        </div>
                        <button
                            onClick={() => {
                                if (profile?.hasPassword === false) {
                                    toast.info("Tài khoản đăng nhập bằng Google không cần mật khẩu.");
                                } else {
                                    setIsPasswordModalOpen(true);
                                }
                            }}
                            className={styles["user-profile-content__item-action"]}
                        >
                            Thay đổi
                        </button>
                    </div>
                    <div className={styles["user-profile-content__security-item"]}>
                        <div>
                            <p className={styles["user-profile-content__item-label"]}>Xác thực 2 yếu tố (2FA)</p>
                            <p className={styles["user-profile-content__item-desc"]}>Tăng cường bảo mật khi đăng nhập</p>
                        </div>
                        <div className={styles["user-profile-content__toggle-container"]}>
                            <span className={styles["user-profile-content__toggle-dot"]} />
                        </div>
                    </div>
                </div>
            </section>

            <ChangePasswordModal
                isOpen={isPasswordModalOpen}
                onClose={() => setIsPasswordModalOpen(false)}
            />
        </>
    );
};

export default SecuritySettings;
