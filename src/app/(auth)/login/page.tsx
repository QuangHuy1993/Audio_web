import { Suspense } from "react";
import AuthLoginPage from "@/features/auth/components/AuthLoginPage";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <AuthLoginPage />
    </Suspense>
  );
}

