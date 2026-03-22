import React from "react";
import AuthPageTransitionLayout from "@/features/auth/components/AuthPageTransitionLayout";

type AuthLayoutProps = {
  children: React.ReactNode;
};

export default function AuthLayout({ children }: AuthLayoutProps) {
  return <AuthPageTransitionLayout>{children}</AuthPageTransitionLayout>;
}

