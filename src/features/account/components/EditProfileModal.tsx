"use client";

import React, { useState, useEffect } from "react";
import { MdClose, MdPerson } from "react-icons/md";
import { toast } from "sonner";
import styles from "./EditProfileModal.module.css";

interface EditProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialData: {
        name: string;
        email: string;
        phone: string;
    };
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose, onSuccess, initialData }) => {
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setName(initialData.name || "");
            setPhone(initialData.phone || "");
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) {
            toast.error("Vui lòng nhập họ và tên.");
            return;
        }

        try {
            setIsSubmitting(true);
            const res = await fetch("/api/shop/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, phone }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Không thể cập nhật hồ sơ.");
            }

            toast.success("Cập nhật hồ sơ thành công!");
            onSuccess();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <div className={styles.titleBox}>
                        <MdPerson size={20} />
                        <h3>Chỉnh sửa hồ sơ</h3>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <MdClose size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.field}>
                        <label>Email (Không thể thay đổi)</label>
                        <input
                            type="email"
                            value={initialData.email}
                            disabled
                            className={styles.disabledInput}
                        />
                    </div>

                    <div className={styles.field}>
                        <label>Họ và tên</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Nhập họ và tên của bạn"
                        />
                    </div>

                    <div className={styles.field}>
                        <label>Số điện thoại</label>
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="Số điện thoại cá nhân"
                        />
                        <p className={styles.hint}>Số điện thoại này sẽ được dùng cho tất cả địa chỉ giao hàng.</p>
                    </div>

                    <div className={styles.actions}>
                        <button type="button" className={styles.cancelBtn} onClick={onClose}>
                            Hủy
                        </button>
                        <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                            {isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditProfileModal;
