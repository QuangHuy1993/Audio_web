"use client";

import React, { useEffect, useState } from "react";
import AddressList from "@/features/account/components/AddressList";

export default function AddressPage() {
    const [addresses, setAddresses] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = async () => {
        try {
            const res = await fetch("/api/shop/addresses");
            if (res.ok) {
                const data = await res.json();
                setAddresses(data);
            }
        } catch (error) {
            console.error("Failed to fetch addresses:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    if (isLoading) return <p style={{ color: "white", textAlign: "center" }}>Đang tải địa chỉ...</p>;

    return <AddressList addresses={addresses} onUpdate={fetchData} />;
}
