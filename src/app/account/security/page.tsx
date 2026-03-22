"use client";

import React, { useEffect, useState } from "react";
import SecuritySettings from "@/features/account/components/SecuritySettings";

export default function SecurityPage() {
    const [profile, setProfile] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = async () => {
        try {
            const res = await fetch("/api/shop/profile");
            if (res.ok) {
                const data = await res.json();
                setProfile(data);
            }
        } catch (error) {
            console.error("Failed to fetch profile:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    if (isLoading) return <p style={{ color: "white", textAlign: "center" }}>Đang tải thông tin bảo mật...</p>;

    return <SecuritySettings profile={profile} />;
}
