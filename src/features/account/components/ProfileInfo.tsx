"use client";

import React, { useRef, useState } from "react";
import { MdCameraAlt } from "react-icons/md";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import styles from "./UserProfile.module.css";
import EditProfileModal from "./EditProfileModal";

interface ProfileInfoProps {
    profile: any;
    defaultAddress: any;
    onUpdate: () => void;
}

const ProfileInfo: React.FC<ProfileInfoProps> = ({ profile, defaultAddress, onUpdate }) => {
    const { data: session, update } = useSession();
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const handleAvatarClick = () => {
        if (isUploadingAvatar) return;
        fileInputRef.current?.click();
    };

    const handleAvatarFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            setIsUploadingAvatar(true);
            const toastId = toast.loading("Đang tải ảnh lên...");

            const formData = new FormData();
            formData.append("file", file);

            const uploadRes = await fetch("/api/shop/profile/upload-avatar", {
                method: "POST",
                body: formData,
            });

            if (!uploadRes.ok) {
                const json = (await uploadRes.json().catch(() => null)) as { error?: string } | null;
                const errorMsg = json?.error ?? "Upload avatar thất bại.";
                console.error("[ProfileInfo][upload-avatar] Failed:", errorMsg);
                toast.error(errorMsg, { id: toastId });
                return;
            }

            const uploadJson = (await uploadRes.json()) as { secureUrl: string };

            const patchRes = await fetch("/api/shop/profile", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    image: uploadJson.secureUrl,
                }),
            });

            if (!patchRes.ok) {
                const json = (await patchRes.json().catch(() => null)) as { error?: string } | null;
                const errorMsg = json?.error ?? "Cập nhật hồ sơ thất bại.";
                console.error("[ProfileInfo][update-profile-image] Failed:", errorMsg);
                toast.error(errorMsg, { id: toastId });
                return;
            }

            // Đồng bộ session để Header cập nhật ngay lập tức
            await update({
                ...session,
                user: {
                    ...session?.user,
                    image: uploadJson.secureUrl,
                },
            });

            toast.success("Cập nhật ảnh đại diện thành công!", { id: toastId });
            onUpdate();
        } catch (error) {
            console.error("[ProfileInfo][avatar] Unexpected error:", error);
            toast.error("Đã xảy ra lỗi không mong muốn.");
        } finally {
            setIsUploadingAvatar(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    return (
        <>
            <section className={styles["user-profile-content__section"]}>
                <div className={styles["user-profile-content__info-header"]}>
                    <div className={styles["user-profile-content__avatar-wrapper"]}>
                        <div className={styles["user-profile-content__avatar-container"]}>
                            <img
                                alt="Avatar"
                                className={styles["user-profile-content__avatar-img"]}
                                src={profile?.image || "https://lh3.googleusercontent.com/aida-public/AB6AXuCRJVYW8jB4vUlCnCaR9L-QiUhf8uQQsdobCDO4JQFTgF6MhONdALv4sZATL_funjq7jCh-A1wCl70mhfw_VjFlcD0lOgIdbbvD2Ackk6Huy4IgXYmnCetmG01G6lTIHir49xYq2RODTPnO5r6L-V5GyOSPe6Y5-TTBcY5OuGFUtW_t5o_CvziLlF_WIzYXduXqldlsbMJOmFcHmqi9S-VjRiPC8T5TWz4xmnIlhUcNflWTIhuL-_GlEGKQxuznSGl3DgGXdTYCNBuM"}
                            />
                            <button
                                type="button"
                                className={styles["user-profile-content__avatar-upload"]}
                                onClick={handleAvatarClick}
                                disabled={isUploadingAvatar}
                            >
                                <MdCameraAlt size={16} color="black" />
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                style={{ display: "none" }}
                                onChange={handleAvatarFileChange}
                            />
                        </div>
                        <div className={styles["user-profile-content__name-block"]}>
                            <h1 className={styles["user-profile-content__user-name"]}>{profile?.name || "Người dùng"}</h1>
                            <p className={styles["user-profile-content__membership"]}>
                                Thành viên từ {profile?.createdAt ? new Date(profile.createdAt).getFullYear() : "2024"} • Hạng Vàng
                            </p>
                        </div>
                    </div>
                    <button
                        className={styles["user-profile-content__edit-btn"]}
                        onClick={() => setIsEditModalOpen(true)}
                    >
                        Chỉnh sửa hồ sơ
                    </button>
                </div>

                <div className={styles["user-profile-content__info-grid"]}>
                    <div className={styles["user-profile-content__field-group"]}>
                        <label className={styles["user-profile-content__field-label"]}>Họ và tên</label>
                        <p className={styles["user-profile-content__field-value"]}>{profile?.name || "Chưa cập nhật"}</p>
                    </div>
                    <div className={styles["user-profile-content__field-group"]}>
                        <label className={styles["user-profile-content__field-label"]}>Email</label>
                        <div className={styles["user-profile-content__field-value-wrapper"]}>
                            <p className={styles["user-profile-content__field-value"]}>{profile?.email}</p>
                            <span className={styles["user-profile-content__badge"]}>Đã xác minh</span>
                        </div>
                    </div>
                    <div className={styles["user-profile-content__field-group"]}>
                        <label className={styles["user-profile-content__field-label"]}>Số điện thoại</label>
                        <p className={styles["user-profile-content__field-value"]}>
                            {defaultAddress?.phone || "Chưa cập nhật"}
                        </p>
                    </div>
                </div>
            </section>

            <EditProfileModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSuccess={() => {
                    setIsEditModalOpen(false);
                    onUpdate();
                }}
                initialData={{
                    name: profile?.name || "",
                    email: profile?.email || "",
                    phone: defaultAddress?.phone || ""
                }}
            />
        </>
    );
};

export default ProfileInfo;
