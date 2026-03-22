import { Suspense } from "react";
import AuthVerifyAccountPage from "@/features/auth/components/AuthVerifyAccountPage";

export default function VerifyAccountPage() {
  return (
    <Suspense fallback={null}>
      <AuthVerifyAccountPage />
    </Suspense>
  );
}

