"use client";

import React, { useEffect, useState } from "react";
import { MdClose, MdLocationOn } from "react-icons/md";
import { toast } from "sonner";
import styles from "./AddressModal.module.css";
import type { ProvinceOption, DistrictOption, WardOption } from "@/types/location";
import type { AddressDto } from "@/types/order";

interface AddressModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (address: AddressDto) => void;
    initialData?: AddressDto | null;
}

const AddressModal: React.FC<AddressModalProps> = ({ isOpen, onClose, onSuccess, initialData }) => {
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [line1, setLine1] = useState("");
    const [selectedProvinceCode, setSelectedProvinceCode] = useState<number | null>(null);
    const [selectedDistrictCode, setSelectedDistrictCode] = useState<number | null>(null);
    const [selectedWardCode, setSelectedWardCode] = useState<number | null>(null);
    const [isDefault, setIsDefault] = useState(false);

    const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
    const [districts, setDistricts] = useState<DistrictOption[]>([]);
    const [wards, setWards] = useState<WardOption[]>([]);
    const [isLoadingLocations, setIsLoadingLocations] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadProvinces();
            if (initialData) {
                setFullName(initialData.fullName);
                setPhone(initialData.phone);
                setLine1(initialData.line1);
                setIsDefault(initialData.isDefault);
                // We'll need to match codes by names since DTO might not have codes
                // but let's assume we can load them or handle them.
                // For now, let's focus on the basic structure.
            } else {
                setFullName("");
                setPhone("");
                setLine1("");
                setSelectedProvinceCode(null);
                setSelectedDistrictCode(null);
                setSelectedWardCode(null);
                setIsDefault(false);
            }
        }
    }, [isOpen, initialData]);

    const loadProvinces = async () => {
        try {
            setIsLoadingLocations(true);
            const res = await fetch("/api/shop/location/provinces");
            if (res.ok) {
                const data = await res.json();
                setProvinces(data);

                // If editing, try to find the province code by name
                if (initialData?.province) {
                    const found = data.find((p: any) => p.name === initialData.province);
                    if (found) setSelectedProvinceCode(found.code);
                }
            }
        } catch (error) {
            console.error("Failed to load provinces", error);
        } finally {
            setIsLoadingLocations(false);
        }
    };

    useEffect(() => {
        if (selectedProvinceCode) {
            loadDistricts(selectedProvinceCode);
        } else {
            setDistricts([]);
            setSelectedDistrictCode(null);
        }
    }, [selectedProvinceCode]);

    const loadDistricts = async (provinceCode: number) => {
        try {
            const res = await fetch(`/api/shop/location/districts?provinceCode=${provinceCode}`);
            if (res.ok) {
                const data = await res.json();
                setDistricts(data);

                if (initialData?.district) {
                    const found = data.find((d: any) => d.name === initialData.district);
                    if (found) setSelectedDistrictCode(found.code);
                }
            }
        } catch (error) {
            console.error("Failed to load districts", error);
        }
    };

    useEffect(() => {
        if (selectedDistrictCode) {
            loadWards(selectedDistrictCode);
        } else {
            setWards([]);
            setSelectedWardCode(null);
        }
    }, [selectedDistrictCode]);

    const loadWards = async (districtCode: number) => {
        try {
            const res = await fetch(`/api/shop/location/wards?districtCode=${districtCode}`);
            if (res.ok) {
                const data = await res.json();
                setWards(data);

                if (initialData?.ward) {
                    const found = data.find((w: any) => w.name === initialData.ward);
                    if (found) setSelectedWardCode(found.code);
                }
            }
        } catch (error) {
            console.error("Failed to load wards", error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!fullName || !phone || !line1 || !selectedProvinceCode || !selectedDistrictCode || !selectedWardCode) {
            toast.error("Vui lòng nhập đầy đủ thông tin.");
            return;
        }

        const province = provinces.find(p => p.code === selectedProvinceCode)?.name;
        const district = districts.find(d => d.code === selectedDistrictCode)?.name;
        const ward = wards.find(w => w.code === selectedWardCode)?.name;

        const payload = {
            fullName,
            phone,
            line1,
            province,
            district,
            ward,
            isDefault
        };

        try {
            setIsSubmitting(true);
            const url = initialData ? `/api/shop/addresses/${initialData.id}` : "/api/shop/addresses";
            const method = initialData ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Có lỗi xảy ra.");
            }

            const savedAddress = await res.json();
            toast.success(initialData ? "Cập nhật địa chỉ thành công!" : "Thêm địa chỉ thành công!");
            onSuccess(savedAddress);
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <div className={styles.titleBox}>
                        <MdLocationOn size={20} />
                        <h3>{initialData ? "Sửa địa chỉ" : "Thêm địa chỉ mới"}</h3>
                    </div>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <MdClose size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.grid}>
                        <div className={styles.field}>
                            <label>Họ và tên</label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Nhập tên người nhận"
                            />
                        </div>
                        <div className={styles.field}>
                            <label>Số điện thoại</label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="Số điện thoại liên hệ"
                            />
                        </div>
                    </div>

                    <div className={styles.field}>
                        <label>Tỉnh / Thành phố</label>
                        <select
                            value={selectedProvinceCode ?? ""}
                            onChange={(e) => setSelectedProvinceCode(Number(e.target.value))}
                        >
                            <option value="">Chọn Tỉnh / Thành phố</option>
                            {provinces.map(p => (
                                <option key={p.code} value={p.code}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.grid}>
                        <div className={styles.field}>
                            <label>Quận / Huyện</label>
                            <select
                                value={selectedDistrictCode ?? ""}
                                onChange={(e) => setSelectedDistrictCode(Number(e.target.value))}
                                disabled={!selectedProvinceCode}
                            >
                                <option value="">Chọn Quận / Huyện</option>
                                {districts.map(d => (
                                    <option key={d.code} value={d.code}>{d.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className={styles.field}>
                            <label>Phường / Xã</label>
                            <select
                                value={selectedWardCode ?? ""}
                                onChange={(e) => setSelectedWardCode(Number(e.target.value))}
                                disabled={!selectedDistrictCode}
                            >
                                <option value="">Chọn Phường / Xã</option>
                                {wards.map(w => (
                                    <option key={w.code} value={w.code}>{w.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className={styles.field}>
                        <label>Địa chỉ chi tiết</label>
                        <input
                            type="text"
                            value={line1}
                            onChange={(e) => setLine1(e.target.value)}
                            placeholder="Số nhà, tên đường..."
                        />
                    </div>

                    <div className={styles.checkboxField}>
                        <input
                            type="checkbox"
                            id="isDefault"
                            checked={isDefault}
                            onChange={(e) => setIsDefault(e.target.checked)}
                        />
                        <label htmlFor="isDefault">Đặt làm địa chỉ mặc định</label>
                    </div>

                    <div className={styles.actions}>
                        <button type="button" className={styles.cancelBtn} onClick={onClose}>
                            Hủy
                        </button>
                        <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                            {isSubmitting ? "Vui lòng chờ GHN xử lý..." : initialData ? "Lưu thay đổi" : "Thêm mới"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddressModal;
