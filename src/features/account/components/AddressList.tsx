"use client";

import React, { useState } from "react";
import { MdAdd, MdLocationOn, MdCheckCircle } from "react-icons/md";
import { toast } from "sonner";
import clsx from "clsx";
import styles from "./UserProfile.module.css";
import AddressModal from "./AddressModal";

interface AddressListProps {
    addresses: any[];
    onUpdate: () => void;
}

const AddressList: React.FC<AddressListProps> = ({ addresses, onUpdate }) => {
    const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
    const [editingAddress, setEditingAddress] = useState<any>(null);

    const handleDeleteAddress = async (id: string) => {
        if (!confirm("Bạn có chắc chắn muốn xóa địa chỉ này?")) return;

        try {
            const res = await fetch(`/api/shop/addresses/${id}`, { method: "DELETE" });
            if (res.ok) {
                toast.success("Đã xóa địa chỉ thành công!");
                onUpdate();
            } else {
                const data = await res.json();
                toast.error(data.error || "Không thể xóa địa chỉ.");
            }
        } catch (error) {
            toast.error("Có lỗi xảy ra khi xóa địa chỉ.");
        }
    };

    const handleSetDefaultAddress = async (address: any) => {
        if (address.isDefault) return;

        try {
            const res = await fetch(`/api/shop/addresses/${address.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fullName: address.fullName,
                    phone: address.phone,
                    line1: address.line1,
                    province: address.province,
                    district: address.district,
                    ward: address.ward,
                    isDefault: true
                }),
            });

            if (res.ok) {
                toast.success("Đã đặt địa chỉ mặc định mới!");
                onUpdate();
            }
        } catch (error) {
            toast.error("Không thể thay đổi địa chỉ mặc định.");
        }
    };

    return (
        <>
            <section className={styles["user-profile-content__section"]}>
                <div className={styles["user-profile-content__address-header"]}>
                    <div className={styles["user-profile-content__section-header"]} style={{ marginBottom: 0 }}>
                        <div className={styles["user-profile-content__icon-box"]}>
                            <MdLocationOn size={24} />
                        </div>
                        <h2 className={styles["user-profile-content__section-title"]}>Địa chỉ giao hàng</h2>
                    </div>
                    <button
                        className={styles["user-profile-content__add-btn"]}
                        disabled={addresses.length >= 4}
                        onClick={() => {
                            setEditingAddress(null);
                            setIsAddressModalOpen(true);
                        }}
                        style={addresses.length >= 4 ? { opacity: 0.5, cursor: "not-allowed" } : {}}
                    >
                        <MdAdd size={20} />
                        {addresses.length >= 4 ? "Đã đạt giới hạn 4 địa chỉ" : "Thêm địa chỉ mới"}
                    </button>
                </div>

                <div className={styles["user-profile-content__address-grid"]}>
                    {addresses.length > 0 ? (
                        addresses.map((address) => (
                            <div
                                key={address.id}
                                className={clsx(
                                    styles["user-profile-content__address-card"],
                                    address.isDefault && styles["user-profile-content__address-card--default"]
                                )}
                                onClick={() => handleSetDefaultAddress(address)}
                                style={{ cursor: address.isDefault ? "default" : "pointer" }}
                            >
                                <div className={styles["user-profile-content__card-header"]}>
                                    <h3 className={styles["user-profile-content__card-name"]}>{address.fullName}</h3>
                                    {address.isDefault && <span className={styles["user-profile-content__default-badge"]}>Mặc định</span>}
                                </div>
                                <div className={styles["user-profile-content__address-details"]}>
                                    <p>{address.phone}</p>
                                    <p>{address.line1}{address.line2 ? `, ${address.line2}` : ""}</p>
                                    <p>{address.ward}, {address.district}, {address.province}</p>
                                </div>
                                <div className={styles["user-profile-content__card-actions"]}>
                                    <button
                                        className={clsx(styles["user-profile-content__action-btn"], styles["user-profile-content__action-btn--edit"])}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingAddress(address);
                                            setIsAddressModalOpen(true);
                                        }}
                                    >
                                        Sửa
                                    </button>
                                    {!address.isDefault && (
                                        <button
                                            className={clsx(styles["user-profile-content__action-btn"], styles["user-profile-content__action-btn--delete"])}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteAddress(address.id);
                                            }}
                                        >
                                            Xóa
                                        </button>
                                    )}
                                    {address.isDefault && (
                                        <div className={styles["user-profile-content__set-default"]} style={{ color: "#1DB954" }}>
                                            <MdCheckCircle size={18} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <p style={{ color: "#9eb7a7", fontSize: "14px", gridColumn: "1 / -1" }}>
                            Bạn chưa có địa chỉ giao hàng nào.
                        </p>
                    )}
                </div>
            </section>

            <AddressModal
                isOpen={isAddressModalOpen}
                onClose={() => {
                    setIsAddressModalOpen(false);
                    setEditingAddress(null);
                }}
                onSuccess={() => {
                    setIsAddressModalOpen(false);
                    setEditingAddress(null);
                    onUpdate();
                }}
                initialData={editingAddress}
            />
        </>
    );
};

export default AddressList;
