"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { signIn, signOut, getSession, useSession } from "next-auth/react";
import { FaHeadphonesAlt } from "react-icons/fa";
import { toast } from "sonner";
import PageTransitionOverlay from "@/components/shared/PageTransitionOverlay";
import { getRedirectAfterLogin } from "@/lib/auth-utils";
import styles from "./AuthLoginPage.module.css";

function AuthLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrlFromQuery = searchParams.get("callbackUrl") ?? undefined;

  const { status } = useSession();

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTransitionActive, setIsTransitionActive] = useState(true);
  const hasInitialAuthCheckDoneRef = useRef(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIsTransitionActive(false);
    }, 1100);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (status === "loading" || hasInitialAuthCheckDoneRef.current) {
      return;
    }

    hasInitialAuthCheckDoneRef.current = true;

    if (status === "authenticated") {
      toast.info("Bạn đã đăng nhập rồi.");
      router.replace("/");
    }
  }, [status, router]);

  const handleTogglePassword = () => {
    setShowPassword((prev) => !prev);
  };

  const handleForgotPasswordClick = () => {
    router.push("/forgot-password");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail && !trimmedPassword) {
      toast.error("Vui lòng nhập email và mật khẩu.");
      return;
    }

    if (!trimmedEmail) {
      toast.error("Vui lòng nhập email.");
      return;
    }

    if (!trimmedPassword) {
      toast.error("Vui lòng nhập mật khẩu.");
      return;
    }

    setIsSubmitting(true);
    try {
      const normalizedEmail = trimmedEmail.toLowerCase();

      const result = await signIn("credentials", {
        email: normalizedEmail,
        password: trimmedPassword,
        redirect: false,
        callbackUrl: callbackUrlFromQuery,
        ...(rememberMe
          ? {
              maxAge: 30 * 24 * 60 * 60,
            }
          : {}),
      });

      if (result?.error) {
        toast.error(
          "Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin.",
        );
        return;
      }

      const session = await getSession();
      if (!session?.user?.role) {
        toast.error("Đăng nhập không thành công. Vui lòng thử lại sau.");
        return;
      }

      const sessionUser = session.user as unknown as {
        id?: string;
        role?: string;
        email?: string | null;
        emailVerified?: string | Date | null;
      };

      const isAdmin = sessionUser.role === "ADMIN";
      const isEmailVerified = Boolean(sessionUser.emailVerified);
      const effectiveEmail =
        (sessionUser.email ?? normalizedEmail).toLowerCase();

      if (!isAdmin && !isEmailVerified) {
        toast.info(
          "Tài khoản của bạn chưa được kích hoạt. Chúng tôi sẽ gửi lại mã OTP để bạn hoàn tất kích hoạt.",
        );

        try {
          await fetch("/api/auth/resend-activation-otp", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: effectiveEmail,
            }),
          });
        } catch {
          // Nếu gửi lại OTP lỗi, vẫn tiếp tục các bước tiếp theo.
        }

        // Xoá session ngay để user không ở trạng thái đăng nhập khi quay lại.
        await signOut({ redirect: false });

        setIsTransitionActive(true);

        window.setTimeout(() => {
          router.push(
            `/verify-account?email=${encodeURIComponent(effectiveEmail)}`,
          );
        }, 1100);

        return;
      }

      const baseUrl =
        typeof window !== "undefined" ? window.location.origin : "";
      const redirectPath = getRedirectAfterLogin(
        sessionUser.role === "ADMIN" ? "ADMIN" : "USER",
        callbackUrlFromQuery ?? null,
        baseUrl,
      );
      toast.success("Đăng nhập thành công.");
      setIsTransitionActive(true);

      window.setTimeout(() => {
        router.push(redirectPath);
      }, 1100);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = () => {
    signIn("google", {
      callbackUrl: callbackUrlFromQuery ?? "/",
    });
  };

  return (
    <React.Fragment>
      <PageTransitionOverlay
        isActive={isTransitionActive}
        subtitle="Đang chuẩn bị màn đăng nhập dành riêng cho bạn..."
      />
      <div className={styles["auth-login-page-page"]}>
        <div className={styles["auth-login-page-page__container"]}>
        {/* Left side - brand visual */}
        <div className={styles["auth-login-page-page__left"]}>
          <div className={styles["auth-login-page-page__left-background"]} />
          <div className={styles["auth-login-page-page__left-overlay"]} />
          <div className={styles["auth-login-page-page__left-gradient"]} />

          <div className={styles["auth-login-page-page__left-header"]}>
            <div className={styles["auth-login-page-page__logo"]}>
              <FaHeadphonesAlt
                className={styles["auth-login-page-page__logo-icon"]}
                aria-hidden="true"
              />
            </div>
            <span className={styles["auth-login-page-page__brand-name"]}>
              Đức Uy Audio
            </span>
          </div>

          <div className={styles["auth-login-page-page__left-content"]}>
            <h2 className={styles["auth-login-page-page__headline"]}>
              Thưởng thức âm thanh ở{" "}
              <span className={styles["auth-login-page-page__headline-highlight"]}>
                trạng thái tinh khiết nhất
              </span>
              .
            </h2>

            <div className={styles["auth-login-page-page__social-proof"]}>
              <div className={styles["auth-login-page-page__avatars"]}>
                <img
                  className={styles["auth-login-page-page__avatar"]}
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDRC8QtyWA-W972_k8LvJjdB-D33Ct-OUma-aMmbceN5L_W1JLgkCeMTUc9UByLaf2jKyELTgyaEM-InnTbJz5iccqiNsjcJOKeof-NG148q3omKl8-kfRpDNnGJoY1uYmx7drskKreVZbDIIoMmcLQv8Rr42p0Ej5516UMW3Q_fxHBH1tXmgQ6trBOueWDrl-kGEvcz7yVYYPGGxr4A5WibZjmKDkiIN2h7uBTZqbhuDZHn9cr6Icf5EMOxz1aWVuIMRmh2Jzk4SbK"
                  alt="Chân dung khách hàng hài lòng"
                />
                <img
                  className={styles["auth-login-page-page__avatar"]}
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCdPGCAbFKhETPaVCZiAJd_1BhqyiJCoTWLc7Y3hBJ-ssoyaxp2psdtqx2WCbnG5raHUDI6TEPGAngwMujFyxktk6hK9iR5Yd_CoZ1U99FSh8LWQDGIJlyYcOtTs7Di7Q5U2mkv85L5Oq4OTtre8U5M5_h1-PkJwrxVTspcUWpw41z8TCuo-ehP4Suxc0Z8MkTrNo6AwkId6GSJCDqIX4LF-z9Gb_huY5TzQpqWhUi2BG2ODUOOQPzWP403vgj0rfI62ccv1jGjR69H"
                  alt="Chân dung khách hàng hài lòng"
                />
                <img
                  className={styles["auth-login-page-page__avatar"]}
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDd71OLjwXjr9_r-vZHx8PyGnmA-jbZnWYApymwjJZYoEvzhnDrvJY_vCRL2aXzyfDT_dfJFfYZY4d7btKIso94Aw0Ykea2j9RFwZg6di5AXiZ7dbqZhIl4SI5HNLns_PCKM2LmAFpFCuutoUHnCDAbwxgjqOpxXr179Wj_AxqBvPzTo83ltkB-0ky1V-AJZw5zr_oCriKvn52A1RgjiJo5ERdxpa4Jh0PCg2uM-c9HCJRIHeltQnGz9P8eEbuuSi__rr800zQUACtU"
                  alt="Chân dung khách hàng hài lòng"
                />
              </div>
              <p className={styles["auth-login-page-page__social-text"]}>
                Được tin tưởng bởi hơn 10.000 người yêu âm thanh
              </p>
            </div>
          </div>
        </div>

        {/* Right side - login form */}
        <div className={styles["auth-login-page-page__right"]}>
          <div className={styles["auth-login-page-page__card"]}>
            <div className={styles["auth-login-page-page__card-header"]}>
              <h1 className={styles["auth-login-page-page__title"]}>
                Chào mừng quay lại
              </h1>
              <p className={styles["auth-login-page-page__subtitle"]}>
                Vui lòng nhập thông tin để đăng nhập.
              </p>
            </div>

            <button
              type="button"
              className={styles["auth-login-page-page__google-button"]}
              onClick={handleGoogleLogin}
            >
              <span className={styles["auth-login-page-page__google-icon"]}>
                <span />
              </span>
              <span>Đăng nhập với Google</span>
            </button>

            <div className={styles["auth-login-page-page__divider"]}>
              <span className={styles["auth-login-page-page__divider-line"]} />
              <span className={styles["auth-login-page-page__divider-label"]}>
                hoặc đăng nhập bằng email
              </span>
              <span className={styles["auth-login-page-page__divider-line"]} />
            </div>

            <form
              className={styles["auth-login-page-page__form"]}
              onSubmit={handleSubmit}
            >
              <label className={styles["auth-login-page-page__field"]}>
                <span className={styles["auth-login-page-page__field-label"]}>
                  Địa chỉ email
                </span>
                <div className={styles["auth-login-page-page__field-control"]}>
                  <input
                    type="email"
                    placeholder="tenban@vidu.com"
                    className={styles["auth-login-page-page__input"]}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                  <span
                    className={styles["auth-login-page-page__input-icon-mail"]}
                    aria-hidden="true"
                  >
                    @
                  </span>
                </div>
              </label>

              <label className={styles["auth-login-page-page__field"]}>
                <div
                  className={
                    styles["auth-login-page-page__field-label-row"]
                  }
                >
                  <span
                    className={styles["auth-login-page-page__field-label"]}
                  >
                    Mật khẩu
                  </span>
                  <button
                    type="button"
                    className={
                      styles["auth-login-page-page__forgot-password"]
                    }
                    onClick={handleForgotPasswordClick}
                    tabIndex={-1}
                  >
                    Quên mật khẩu?
                  </button>
                </div>
                <div className={styles["auth-login-page-page__field-control"]}>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Nhập mật khẩu của bạn"
                    className={styles["auth-login-page-page__input"]}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={handleTogglePassword}
                    className={
                      styles["auth-login-page-page__input-icon-toggle"]
                    }
                    aria-label={
                      showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"
                    }
                  >
                    {showPassword ? "Ẩn" : "Hiện"}
                  </button>
                </div>
              </label>

              <div className={styles["auth-login-page-page__remember-row"]}>
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className={styles["auth-login-page-page__checkbox"]}
                  checked={rememberMe}
                  onChange={(event) =>
                    setRememberMe(event.target.checked)
                  }
                />
                <label
                  htmlFor="remember-me"
                  className={
                    styles["auth-login-page-page__remember-label"]
                  }
                >
                  Ghi nhớ trong 30 ngày
                </label>
              </div>

              <button
                type="submit"
                className={styles["auth-login-page-page__submit"]}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
              </button>
            </form>

            <div className={styles["auth-login-page-page__footer"]}>
              <span>Chưa có tài khoản?</span>
              <Link
                href="/register"
                className={styles["auth-login-page-page__signup-link"]}
              >
                Đăng ký miễn phí
              </Link>
            </div>
          </div>
        </div>
      </div>
      </div>
    </React.Fragment>
  );
}

export default AuthLoginPage;

