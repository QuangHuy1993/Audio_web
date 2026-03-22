import React, { useEffect, useState } from "react";
import { MdLocationOn, MdAddCircle } from "react-icons/md";
import { toast } from "sonner";
import type { AddressDto, UpsertAddressRequestDto } from "@/types/order";
import type { ProvinceOption, DistrictOption, WardOption } from "@/types/location";
import styles from "./CheckoutAddressSection.module.css";

export type CheckoutAddressSectionProps = {
  addresses: AddressDto[];
  selectedAddressId: string | null;
  canAddMore: boolean;
  onSelectAddress: (id: string) => void;
  onToggleNewForm: () => void;
  isNewFormOpen: boolean;
  onAddressCreated?: (address: AddressDto) => void;
};

const CheckoutAddressSection: React.FC<CheckoutAddressSectionProps> = ({
  addresses,
  selectedAddressId,
  canAddMore,
  onSelectAddress,
  onToggleNewForm,
  isNewFormOpen,
  onAddressCreated,
}) => {
  const hasAddresses = addresses.length > 0;

  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [wards, setWards] = useState<WardOption[]>([]);
  const [selectedProvinceCode, setSelectedProvinceCode] = useState<number | null>(null);
  const [selectedDistrictCode, setSelectedDistrictCode] = useState<number | null>(null);
  const [selectedWardCode, setSelectedWardCode] = useState<number | null>(null);
  const [isProvincesLoading, setIsProvincesLoading] = useState(false);
  const [isDistrictsLoading, setIsDistrictsLoading] = useState(false);
  const [isWardsLoading, setIsWardsLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [line1, setLine1] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isNewFormOpen || provinces.length > 0) {
      return;
    }

    const loadProvinces = async () => {
      try {
        setIsProvincesLoading(true);
        const res = await fetch("/api/shop/location/provinces");
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as ProvinceOption[];
        setProvinces(data);
      } catch {
        // giữ im lặng, form vẫn dùng được với placeholder
      } finally {
        setIsProvincesLoading(false);
      }
    };

    void loadProvinces();
  }, [isNewFormOpen, provinces.length]);

  useEffect(() => {
    // Khi chưa chọn tỉnh, reset quận/huyện.
    if (!selectedProvinceCode) {
      setDistricts([]);
      setSelectedDistrictCode(null);
      setWards([]);
      setSelectedWardCode(null);
    }
  }, [selectedProvinceCode]);

  useEffect(() => {
    // Khi chưa chọn quận/huyện, reset phường/xã.
    if (!selectedDistrictCode) {
      setWards([]);
      setSelectedWardCode(null);
      return;
    }

    const loadWards = async () => {
      try {
        setIsWardsLoading(true);
        console.log(
          "[CheckoutAddress] fetching wards for districtCode=",
          selectedDistrictCode,
        );
        const res = await fetch(
          `/api/shop/location/wards?districtCode=${selectedDistrictCode}`,
        );
        if (!res.ok) {
          console.log(
            "[CheckoutAddress] wards response not ok:",
            res.status,
          );
          return;
        }
        const data = (await res.json()) as WardOption[];
        console.log(
          "[CheckoutAddress] wards loaded:",
          Array.isArray(data) ? data.length : "invalid data",
          data,
        );
        setWards(Array.isArray(data) ? data : []);
      } catch {
        // giữ im lặng, người dùng vẫn có thể lưu không có phường/xã nếu cần
        console.log(
          "[CheckoutAddress] failed to load wards for districtCode=",
          selectedDistrictCode,
        );
      } finally {
        setIsWardsLoading(false);
      }
    };

    void loadWards();
  }, [selectedDistrictCode]);

  return (
    <section
      className={styles["checkout-address"]}
      aria-labelledby="address-heading"
    >
      <header className={styles["checkout-address__header"]}>
        <span className={styles["checkout-address__header-icon"]}>
          <MdLocationOn aria-hidden="true" />
        </span>
        <h2
          id="address-heading"
          className={styles["checkout-address__header-title"]}
        >
          Địa chỉ giao hàng
        </h2>
      </header>

      {hasAddresses && (
        <div className={styles["checkout-address__saved"]}>
          {addresses.map((address) => {
            const isSelected = address.id === selectedAddressId;

            return (
              <label
                key={address.id}
                className={`${styles["checkout-address__card"]} ${
                  isSelected
                    ? styles["checkout-address__card--selected"]
                    : ""
                }`}
              >
                <input
                  type="radio"
                  name="checkout-address"
                  checked={isSelected}
                  onChange={() => onSelectAddress(address.id)}
                  className={styles["checkout-address__radio"]}
                />
                <div className={styles["checkout-address__card-body"]}>
                  <div className={styles["checkout-address__card-row"]}>
                    <span className={styles["checkout-address__card-name"]}>
                      {address.fullName}
                    </span>
                    {address.isDefault && (
                      <span
                        className={styles["checkout-address__badge-default"]}
                      >
                        Mặc định
                      </span>
                    )}
                  </div>
                  <p className={styles["checkout-address__card-phone"]}>
                    {address.phone}
                  </p>
                  <p className={styles["checkout-address__card-address"]}>
                    {address.line1}
                    {address.ward ? `, ${address.ward}` : ""}
                    {address.district ? `, ${address.district}` : ""}
                    {address.province ? `, ${address.province}` : ""}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      )}

      <div className={styles["checkout-address__new"]}>
        {canAddMore && (
          <button
            type="button"
            className={styles["checkout-address__toggle-new"]}
            onClick={onToggleNewForm}
          >
            <span className={styles["checkout-address__toggle-new-icon"]}>
              <MdAddCircle aria-hidden="true" />
            </span>
            <span>Thêm địa chỉ mới</span>
          </button>
        )}

        {(!hasAddresses || isNewFormOpen) && (
          <form
            className={styles["checkout-address__form"]}
            onSubmit={async (event) => {
              event.preventDefault();

              const trimmedFullName = fullName.trim();
              const trimmedPhone = phone.trim();
              const trimmedLine1 = line1.trim();

              if (!trimmedFullName || !trimmedPhone || !trimmedLine1) {
                toast.error("Vui lòng điền đầy đủ họ tên, số điện thoại và địa chỉ chi tiết.");
                return;
              }

              if (!selectedProvinceCode || !selectedDistrictCode) {
                toast.error("Vui lòng chọn đầy đủ Tỉnh/Thành phố và Quận/Huyện.");
                return;
              }

              if (!selectedWardCode) {
                toast.error("Vui lòng chọn Phường/Xã để tính phí vận chuyển chính xác.");
                return;
              }

              const province = provinces.find(
                (item) => item.code === selectedProvinceCode,
              );
              const district = districts.find(
                (item) => item.code === selectedDistrictCode,
              );
              const ward = wards.find((item) => item.code === selectedWardCode);

              if (!province || !district || !ward) {
                    toast.error("Không thể xác định tỉnh/thành phố, quận/huyện hoặc phường/xã đã chọn.");
                return;
              }

              const payload: UpsertAddressRequestDto = {
                fullName: trimmedFullName,
                phone: trimmedPhone,
                line1: trimmedLine1,
                ward: ward.name,
                district: district.name,
                province: province.name,
              };

              try {
                setIsSubmitting(true);

                const res = await fetch("/api/shop/addresses", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(payload),
                });

                console.log("[CheckoutAddress] /api/shop/addresses status", {
                  status: res.status,
                  ok: res.ok,
                });

                const json = (await res.json().catch(() => null)) as
                  | AddressDto
                  | { error?: string }
                  | null;

                console.log("[CheckoutAddress] /api/shop/addresses response", {
                  json,
                });

                if (!res.ok) {
                  const message =
                    (json && "error" in json && json.error) ||
                    "Không thể thêm địa chỉ mới. Vui lòng thử lại sau.";
                  toast.error(message);
                  return;
                }

                const created = json as AddressDto;

                toast.success("Đã thêm địa chỉ giao hàng mới.");

                if (onAddressCreated) {
                  onAddressCreated(created);
                }

                setFullName("");
                setPhone("");
                setLine1("");
                setSelectedProvinceCode(null);
                setSelectedDistrictCode(null);
                setSelectedWardCode(null);
                setDistricts([]);
                setWards([]);
              } catch (error) {
                console.error(
                  "[CheckoutAddress] Failed to create address",
                  error,
                );
                toast.error("Không thể thêm địa chỉ mới. Vui lòng thử lại sau.");
              } finally {
                setIsSubmitting(false);
              }
            }}
          >
            <div className={styles["checkout-address__field"]}>
              <label
                className={styles["checkout-address__label"]}
                htmlFor="fullName"
              >
                Họ và tên
              </label>
              <input
                id="fullName"
                type="text"
                placeholder="Nhập họ tên"
                className={styles["checkout-address__input"]}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </div>

            <div className={styles["checkout-address__field"]}>
              <label
                className={styles["checkout-address__label"]}
                htmlFor="phone"
              >
                Số điện thoại
              </label>
              <input
                id="phone"
                type="tel"
                placeholder="Nhập số điện thoại"
                className={styles["checkout-address__input"]}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>

            <div className={styles["checkout-address__field"]}>
              <label
                className={styles["checkout-address__label"]}
                htmlFor="province"
              >
                Tỉnh / Thành phố
              </label>
              <select
                id="province"
                className={styles["checkout-address__select"]}
                value={selectedProvinceCode ?? ""}
                onChange={async (event) => {
                  const value = event.target.value;
                  // Tạm log phục vụ debug luồng chọn tỉnh và load quận/huyện
                  console.log("[CheckoutAddress] province change raw:", value);
                  if (!value) {
                    setSelectedProvinceCode(null);
                    setDistricts([]);
                    setSelectedDistrictCode(null);
                    return;
                  }

                  const numeric = Number(value);
                  if (!Number.isFinite(numeric) || numeric <= 0) {
                    console.log(
                      "[CheckoutAddress] province numeric invalid:",
                      numeric,
                    );
                    setSelectedProvinceCode(null);
                    setDistricts([]);
                    setSelectedDistrictCode(null);
                    return;
                  }

                  setSelectedProvinceCode(numeric);
                  setDistricts([]);
                  setSelectedDistrictCode(null);

                  try {
                    setIsDistrictsLoading(true);
                    console.log(
                      "[CheckoutAddress] fetching districts for provinceCode=",
                      numeric,
                    );
                    const res = await fetch(
                      `/api/shop/location/districts?provinceCode=${numeric}`,
                    );
                    if (!res.ok) {
                      console.log(
                        "[CheckoutAddress] districts response not ok:",
                        res.status,
                      );
                      return;
                    }
                    const data = (await res.json()) as DistrictOption[];
                    console.log(
                      "[CheckoutAddress] districts loaded:",
                      Array.isArray(data) ? data.length : "invalid data",
                      data,
                    );
                    setDistricts(data);
                  } catch {
                    console.log(
                      "[CheckoutAddress] failed to load districts for provinceCode=",
                      numeric,
                    );
                  } finally {
                    setIsDistrictsLoading(false);
                  }
                }}
              >
                <option value="">
                  {isProvincesLoading
                    ? "Đang tải tỉnh / thành phố..."
                    : "Chọn tỉnh / thành phố"}
                </option>
                {provinces.map((province) => (
                  <option key={province.code} value={province.code}>
                    {province.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles["checkout-address__field"]}>
              <label
                className={styles["checkout-address__label"]}
                htmlFor="district"
              >
                Quận / Huyện
              </label>
              <select
                id="district"
                className={styles["checkout-address__select"]}
                value={selectedDistrictCode ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  if (!value) {
                    setSelectedDistrictCode(null);
                    setWards([]);
                    setSelectedWardCode(null);
                    return;
                  }
                  const numeric = Number(value);
                  const next = Number.isFinite(numeric) ? numeric : null;
                  setSelectedDistrictCode(next);
                  setWards([]);
                  setSelectedWardCode(null);
                }}
                disabled={!selectedProvinceCode || isDistrictsLoading}
              >
                <option value="">
                  {!selectedProvinceCode
                    ? "Chọn tỉnh / thành phố trước"
                    : isDistrictsLoading
                      ? "Đang tải quận / huyện..."
                      : "Chọn quận / huyện"}
                </option>
                {districts.map((district) => (
                  <option key={district.code} value={district.code}>
                    {district.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles["checkout-address__field"]}>
              <label
                className={styles["checkout-address__label"]}
                htmlFor="ward"
              >
                Phường / Xã
              </label>
              <select
                id="ward"
                className={styles["checkout-address__select"]}
                value={selectedWardCode ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  if (!value) {
                    setSelectedWardCode(null);
                    return;
                  }
                  const numeric = Number(value);
                  setSelectedWardCode(Number.isFinite(numeric) ? numeric : null);
                }}
                disabled={!selectedDistrictCode || isWardsLoading}
              >
                <option value="">
                  {!selectedDistrictCode
                    ? "Chọn quận / huyện trước"
                    : isWardsLoading
                      ? "Đang tải phường / xã..."
                      : "Chọn phường / xã"}
                </option>
                {wards.map((ward) => (
                  <option key={ward.code} value={ward.code}>
                    {ward.name}
                  </option>
                ))}
              </select>
            </div>

            <div
              className={styles["checkout-address__field"]}
            >
              <label
                className={styles["checkout-address__label"]}
                htmlFor="line1"
              >
                Địa chỉ cụ thể
              </label>
              <input
                id="line1"
                type="text"
                placeholder="Số nhà, tên đường..."
                className={styles["checkout-address__input"]}
                value={line1}
                onChange={(event) => setLine1(event.target.value)}
              />
            </div>
            <div className={styles["checkout-address__actions"]}>
              <button
                type="submit"
                className={styles["checkout-address__submit"]}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Đang lưu địa chỉ..." : "Lưu địa chỉ giao hàng"}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
};

export default CheckoutAddressSection;

