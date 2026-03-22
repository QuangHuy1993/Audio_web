"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { MdOutlinePublic, MdQrCode2, MdSave, MdSync } from "react-icons/md";
import { FaSpinner } from "react-icons/fa";
import styles from "./AdminSettings.module.css";

type SettingField = {
    key: string;
    value: string;
};

// Mặc định state hiển thị
const DEFAULT_SETTINGS: Record<string, string> = {
    website_title: "Đức Uy Audio",
    support_email: "contact@ducuy-audio.vn",
    store_address: "123 Premium Sound Street, Audio District, Hanoi, Vietnam",
    qr_bank_id: "970422", // MBBank
    qr_account_no: "",
    qr_account_name: "",
};

export default function AdminSettingsPage() {
    const [settings, setSettings] = useState<Record<string, string>>(DEFAULT_SETTINGS);
    const [initialSettings, setInitialSettings] = useState<Record<string, string>>(DEFAULT_SETTINGS);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<"general" | "payment">("general");

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            setIsLoading(true);
            const res = await fetch("/api/admin/settings");
            if (!res.ok) throw new Error("Failed to fetch settings");
            const data: { key: string; value: string }[] = await res.json();

            const newSettings = { ...DEFAULT_SETTINGS };
            data.forEach((item) => {
                newSettings[item.key] = item.value;
            });

            setSettings(newSettings);
            setInitialSettings(newSettings);
        } catch (error) {
            console.error(error);
            toast.error("Không thể tải cài đặt. Vui lòng thử lại.");
        } finally {
            // Delay chút để mượt animation loading
            setTimeout(() => setIsLoading(false), 500);
        }
    };

    const handleInputChange = (key: string, value: string) => {
        setSettings((prev) => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        try {
            setIsSaving(true);

            // Lọc ra các field thay đổi
            const changedKeys = Object.keys(settings).filter(
                (key) => settings[key] !== initialSettings[key]
            );

            if (changedKeys.length === 0) {
                toast.info("Không có thay đổi nào để lưu.");
                setIsSaving(false);
                return;
            }

            // Gửi request cập nhật lần lượt từng field
            for (const key of changedKeys) {
                const res = await fetch("/api/admin/settings", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        key,
                        value: settings[key],
                        category: key.startsWith("qr_") ? "payment" : "general",
                    }),
                });

                if (!res.ok) {
                    throw new Error(`Cập nhật field ${key} thất bại`);
                }
            }

            setInitialSettings(settings); // Cập nhật gốc
            toast.success("Đã lưu các cài đặt thành công!");
        } catch (error) {
            console.error(error);
            toast.error("Lưu cài đặt thất bại. Vui lòng thử lại.");
        } finally {
            setIsSaving(false);
        }
    };

    const currentBankId = settings["qr_bank_id"] || "970422";
    const currentAccountNo = settings["qr_account_no"];
    const currentAccountName = settings["qr_account_name"];

    // Demo trực tiếp hình ảnh QR từ VietQR theo config
    // Compact2 template để preview gọn gàng
    const vietQrPreviewUrl = currentAccountNo
        ? `https://img.vietqr.io/image/${currentBankId}-${currentAccountNo}-compact2.jpg?accountName=${encodeURIComponent(currentAccountName)}`
        : null;

    if (isLoading) {
        return (
            <main className={styles["admin-settings__main"]}>
                <div className={styles["admin-settings__loading"]}>
                    <FaSpinner className={styles["admin-settings__spinner"]} />
                    <p>Đang tải cấu hình hệ thống...</p>
                </div>
            </main>
        );
    }

    return (
        <main className={styles["admin-settings__main"]}>
            {/* Header */}
            <header className={styles["admin-settings__header"]}>
                <div className={styles["admin-settings__header-title-container"]}>
                    <h2 className={styles["admin-settings__header-title"]}>Cài đặt hệ thống</h2>
                    <p className={styles["admin-settings__header-subtitle"]}>
                        Cấu hình các thông tin cơ bản và thông tin thanh toán cho cửa hàng
                    </p>
                </div>
                <div className={styles["admin-settings__header-actions"]}>
                    <button
                        className={styles["admin-settings__save-btn"]}
                        onClick={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving ? <MdSync className={styles["admin-settings__spinner"]} /> : <MdSave />}
                        Lưu thay đổi
                    </button>
                </div>
            </header>

            {/* Tabs Navigation */}
            <div className={styles["admin-settings__tabs"]}>
                <button
                    className={`${styles["admin-settings__tab"]} ${activeTab === "general" ? styles["admin-settings__tab--active"] : ""}`}
                    onClick={() => setActiveTab("general")}
                >
                    <MdOutlinePublic />
                    Cài đặt chung
                </button>
                <button
                    className={`${styles["admin-settings__tab"]} ${activeTab === "payment" ? styles["admin-settings__tab--active"] : ""}`}
                    onClick={() => setActiveTab("payment")}
                >
                    <MdQrCode2 />
                    Thanh toán (VietQR)
                </button>
            </div>

            <div className={styles["admin-settings__content"]}>
                {/* General Settings */}
                {activeTab === "general" && (
                    <section>
                        <div className={styles["admin-settings__section-header"]}>
                            <MdOutlinePublic className={styles["admin-settings__section-icon"]} />
                            <h3 className={styles["admin-settings__section-title"]}>Cài đặt chung</h3>
                        </div>

                        <div className={styles["admin-settings__grid"]}>
                            <div className={styles["admin-settings__card"]}>
                                <label className={styles["admin-settings__label"]}>Tên Website</label>
                                <input
                                    className={styles["admin-settings__input"]}
                                    type="text"
                                    value={settings["website_title"]}
                                    onChange={(e) => handleInputChange("website_title", e.target.value)}
                                />
                                <p className={styles["admin-settings__input-help"]}>
                                    Tên cửa hàng hiển thị trên tab trình duyệt và các kết quả tìm kiếm.
                                </p>
                            </div>

                            <div className={styles["admin-settings__card"]}>
                                <label className={styles["admin-settings__label"]}>Email hỗ trợ</label>
                                <input
                                    className={styles["admin-settings__input"]}
                                    type="email"
                                    value={settings["support_email"]}
                                    onChange={(e) => handleInputChange("support_email", e.target.value)}
                                />
                                <p className={styles["admin-settings__input-help"]}>
                                    Email liên hệ chính thức dùng để hỗ trợ khách hàng và gửi thông báo đơn hàng.
                                </p>
                            </div>

                            <div className={`${styles["admin-settings__card"]} ${styles["admin-settings__card--full"]}`}>
                                <label className={styles["admin-settings__label"]}>Địa chỉ cửa hàng</label>
                                <textarea
                                    className={styles["admin-settings__textarea"]}
                                    rows={2}
                                    value={settings["store_address"]}
                                    onChange={(e) => handleInputChange("store_address", e.target.value)}
                                />
                                <p className={styles["admin-settings__input-help"]}>
                                    Vị trí địa lý của showroom hoặc cửa hàng chính của bạn.
                                </p>
                            </div>
                        </div>
                    </section>
                )}

                {/* Payment Settings */}
                {activeTab === "payment" && (
                    <section>
                        <div className={styles["admin-settings__section-header"]}>
                            <MdQrCode2 className={styles["admin-settings__section-icon"]} />
                            <h3 className={styles["admin-settings__section-title"]}>Thanh toán (VietQR)</h3>
                        </div>

                        <div className={styles["admin-settings__payment-card"]}>
                            <div className={styles["admin-settings__payment-grid"]}>

                                <div className={styles["admin-settings__payment-fields"]}>
                                    <div>
                                        <label className={styles["admin-settings__label"]}>Ngân hàng thụ hưởng (qr_bank_id)</label>
                                        <select
                                            className={styles["admin-settings__select"]}
                                            value={settings["qr_bank_id"]}
                                            onChange={(e) => handleInputChange("qr_bank_id", e.target.value)}
                                        >
                                            <option value="970415">VietinBank (ICB)</option>
                                            <option value="970436">Vietcombank (VCB)</option>
                                            <option value="970422">MBBank (MB)</option>
                                            <option value="970407">Techcombank (TCB)</option>
                                            <option value="970418">BIDV</option>
                                            <option value="970405">Agribank</option>
                                            <option value="970416">ACB</option>
                                            <option value="970432">VPBank</option>
                                            <option value="970423">TPBank</option>
                                        </select>
                                        <p className={styles["admin-settings__input-help"]}>
                                            Chọn ngân hàng để tạo mã VietQR động hỗ trợ đối soát tự động.
                                        </p>
                                    </div>

                                    <div>
                                        <label className={styles["admin-settings__label"]}>Số tài khoản (qr_account_no)</label>
                                        <input
                                            className={styles["admin-settings__input"]}
                                            type="text"
                                            placeholder="Nhập số tài khoản ngân hàng"
                                            value={settings["qr_account_no"]}
                                            onChange={(e) => handleInputChange("qr_account_no", e.target.value)}
                                        />
                                        <p className={styles["admin-settings__input-help"]}>
                                            Số tài khoản chính sẽ dùng để nhận thanh toán từ khách hàng.
                                        </p>
                                    </div>

                                    <div>
                                        <label className={styles["admin-settings__label"]}>Tên tài khoản (qr_account_name)</label>
                                        <input
                                            className={styles["admin-settings__input"]}
                                            type="text"
                                            placeholder="Nhập họ tên chủ tài khoản (VIẾT HOA KHÔNG DẤU)"
                                            value={settings["qr_account_name"]}
                                            onChange={(e) => handleInputChange("qr_account_name", e.target.value)}
                                        />
                                        <p className={styles["admin-settings__input-help"]}>
                                            Phải khớp chính xác tuyệt đối với tên đăng ký tại ngân hàng.
                                        </p>
                                    </div>
                                </div>

                                {/* QR Preview Block */}
                                <div className={styles["admin-settings__qr-preview"]}>
                                    <p className={styles["admin-settings__qr-preview-title"]}>Xem trước VietQR</p>
                                    <div className={styles["admin-settings__qr-image-wrapper"]}>
                                        {vietQrPreviewUrl ? (
                                            <img
                                                src={vietQrPreviewUrl}
                                                alt="VietQR sample code"
                                                className={styles["admin-settings__qr-image"]}
                                            />
                                        ) : (
                                            <div className={styles["admin-settings__empty-qr"]}>
                                                <MdQrCode2 />
                                            </div>
                                        )}
                                    </div>
                                </div>

                            </div>
                        </div>
                    </section>
                )}

                {/* Footer Actions */}
                <div className={styles["admin-settings__footer"]}>
                    <button
                        className={styles["admin-settings__discard-btn"]}
                        onClick={() => setSettings(initialSettings)}
                        disabled={isSaving}
                    >
                        Hủy thay đổi
                    </button>
                    <button
                        className={styles["admin-settings__save-btn-bottom"]}
                        onClick={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving ? <MdSync className={styles["admin-settings__spinner"]} /> : null}
                        Lưu cài đặt
                    </button>
                </div>

            </div>
        </main>
    );
}
