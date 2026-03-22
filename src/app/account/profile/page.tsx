"use client";

import React, { useEffect, useState } from "react";
import ProfileInfo from "@/features/account/components/ProfileInfo";

export default function ProfilePage() {
    const [profile, setProfile] = useState<any>(null);
    const [addresses, setAddresses] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = async () => {
        try {
            const [profileRes, addressesRes] = await Promise.all([
                fetch("/api/shop/profile"),
                fetch("/api/shop/addresses")
            ]);

            if (profileRes.ok) {
                const profileData = await profileRes.json();
                setProfile(profileData);
            }

            if (addressesRes.ok) {
                const addressesData = await addressesRes.json();
                setAddresses(addressesData);
            }
        } catch (error) {
            console.error("Failed to fetch user data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    if (isLoading) return <p style={{ color: "white", textAlign: "center" }}>Đang tải thông tin...</p>;

    const defaultAddress = addresses.find(addr => addr.isDefault) || addresses[0];

    return (
        <ProfileInfo
            profile={profile}
            defaultAddress={defaultAddress}
            onUpdate={fetchData}
        />
    );
}
