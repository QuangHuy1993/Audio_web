import { Suspense } from "react";
import AuthResetPasswordPage from "@/features/auth/components/AuthResetPasswordPage";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <AuthResetPasswordPage />
    </Suspense>
  );
}

