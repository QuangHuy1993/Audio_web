"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import PageTransitionOverlay from "@/components/shared/PageTransitionOverlay";

type AuthPageTransitionLayoutProps = {
  children: React.ReactNode;
};

export const AuthPageTransitionLayout: React.FC<
  AuthPageTransitionLayoutProps
> = ({ children }) => {
  const pathname = usePathname();
  const previousPathnameRef = useRef<string | null>(null);
  const [isTransitionActive, setIsTransitionActive] = useState(false);

  useEffect(() => {
    let timeoutId: number | undefined;
    const previousPathname = previousPathnameRef.current;

    if (previousPathname && previousPathname !== pathname) {
      const isAuthRouteChange =
        previousPathname.startsWith("/login") && pathname.startsWith("/register")
          ? true
          : previousPathname.startsWith("/register") &&
            pathname.startsWith("/login");

      if (isAuthRouteChange) {
        setIsTransitionActive(true);

        timeoutId = window.setTimeout(() => {
          setIsTransitionActive(false);
        }, 1100);
      }
    }

    previousPathnameRef.current = pathname;

    return () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [pathname]);

  return (
    <>
      <PageTransitionOverlay isActive={isTransitionActive} />
      {children}
    </>
  );
};

export default AuthPageTransitionLayout;

