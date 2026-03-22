"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FaHeadphonesAlt } from "react-icons/fa";
import { toast } from "sonner";
import PageTransitionOverlay from "@/components/shared/PageTransitionOverlay";
import styles from "./AuthRegisterPage.module.css";

function AuthRegisterPage() {
  const router = useRouter();
  const { status } = useSession();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
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

  const handleToggleConfirmPassword = () => {
    setShowConfirmPassword((prev) => !prev);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const trimmedFullName = fullName.trim();
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const trimmedConfirmPassword = confirmPassword.trim();

    if (
      !trimmedFullName ||
      !trimmedEmail ||
      !trimmedPassword ||
      !trimmedConfirmPassword
    ) {
      toast.error("Vui lòng điền đầy đủ tất cả các trường thông tin.");
      return;
    }

    if (trimmedPassword !== trimmedConfirmPassword) {
      toast.error("Mật khẩu và xác nhận mật khẩu không khớp.");
      return;
    }

    if (!acceptedTerms) {
      toast.error("Vui lòng đồng ý với Điều khoản dịch vụ và Chính sách bảo mật.");
      return;
    }

    const normalizedEmail = trimmedEmail.toLowerCase();

    try {
      setIsSubmitting(true);

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: trimmedFullName,
          email: normalizedEmail,
          password: trimmedPassword,
        }),
      });

      const data = (await response.json()) as {
        message?: string;
        email?: string;
        fullName?: string;
        code?: string;
      };

      if (!response.ok) {
        toast.error(
          data.message ??
            "Không thể tạo tài khoản. Vui lòng kiểm tra lại thông tin và thử lại.",
        );
        return;
      }

      toast.success(
        "Tạo tài khoản thành công. Vui lòng kiểm tra email để kích hoạt tài khoản.",
      );

      setIsTransitionActive(true);

      window.setTimeout(() => {
        router.push(
          `/verify-account?email=${encodeURIComponent(
            data.email ?? normalizedEmail,
          )}`,
        );
      }, 1100);
    } catch (error) {
      console.error("[AuthRegisterPage] Failed to register account", error);
      toast.error("Đã xảy ra lỗi trong quá trình tạo tài khoản. Vui lòng thử lại sau.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <React.Fragment>
      <PageTransitionOverlay
        isActive={isTransitionActive}
        subtitle="Đang chuẩn bị không gian tài khoản dành riêng cho bạn..."
        bottomText="Đức Uy Audio đang cấu hình trải nghiệm thành viên..."
      />
      <div className={styles["auth-register-page-page"]}>
      <div className={styles["auth-register-page-page__container"]}>
        {/* Left side - brand visual */}
        <div className={styles["auth-register-page-page__left"]}>
          <div className={styles["auth-register-page-page__left-background"]} />
          <div className={styles["auth-register-page-page__left-overlay"]} />
          <div className={styles["auth-register-page-page__left-gradient"]} />

          <div className={styles["auth-register-page-page__left-header"]}>
            <div className={styles["auth-register-page-page__logo"]}>
              <FaHeadphonesAlt
                className={styles["auth-register-page-page__logo-icon"]}
                aria-hidden="true"
              />
            </div>
            <span className={styles["auth-register-page-page__brand-name"]}>
              Đức Uy Audio
            </span>
          </div>

          <div className={styles["auth-register-page-page__left-content"]}>
            <h2 className={styles["auth-register-page-page__headline"]}>
              Tham gia{" "}
              <span className={styles["auth-register-page-page__headline-highlight"]}>
                cộng đồng yêu âm thanh
              </span>
              .
            </h2>

            <div className={styles["auth-register-page-page__social-proof"]}>
              <div className={styles["auth-register-page-page__avatars"]}>
                <img
                  className={styles["auth-register-page-page__avatar"]}
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDRC8QtyWA-W972_k8LvJjdB-D33Ct-OUma-aMmbceN5L_W1JLgkCeMTUc9UByLaf2jKyELTgyaEM-InnTbJz5iccqiNsjcJOKeof-NG148q3omKl8-kfRpDNnGJoY1uYmx7drskKreVZbDIIoMmcLQv8Rr42p0Ej5516UMW3Q_fxHBH1tXmgQ6trBOueWDrl-kGEvcz7yVYYPGGxr4A5WibZjmKDkiIN2h7uBTZqbhuDZHn9cr6Icf5EMOxz1aWVuIMRmh2Jzk4SbK"
                  alt="Chân dung khách hàng hài lòng"
                />
                <img
                  className={styles["auth-register-page-page__avatar"]}
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCdPGCAbFKhETPaVCZiAJd_1BhqyiJCoTWLc7Y3hBJ-ssoyaxp2psdtqx2WCbnG5raHUDI6TEPGAngwMujFyxktk6hK9iR5Yd_CoZ1U99FSh8LWQDGIJlyYcOtTs7Di7Q5U2mkv85L5Oq4OTtre8U5M5_h1-PkJwrxVTspcUWpw41z8TCuo-ehP4Suxc0Z8MkTrNo6AwkId6GSJCDqIX4LF-z9Gb_huY5TzQpqWhUi2BG2ODUOOQPzWP403vgj0rfI62ccv1jGjR69H"
                  alt="Chân dung khách hàng hài lòng"
                />
                <img
                  className={styles["auth-register-page-page__avatar"]}
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDd71OLjwXjr9_r-vZHx8PyGnmA-jbZnWYApymwjJZYoEvzhnDrvJY_vCRL2aXzyfDT_dfJFfYZY4d7btKIso94Aw0Ykea2j9RFwZg6di5AXiZ7dbqZhIl4SI5HNLns_PCKM2LmAFpFCuutoUHnCDAbwxgjqOpxXr179Wj_AxqBvPzTo83ltkB-0ky1V-AJZw5zr_oCriKvn52A1RgjiJo5ERdxpa4Jh0PCg2uM-c9HCJRIHeltQnGz9P8eEbuuSi__rr800zQUACtU"
                  alt="Chân dung khách hàng hài lòng"
                />
              </div>
              <p className={styles["auth-register-page-page__social-text"]}>
                Cùng hơn 10.000 người dùng hài lòng
              </p>
            </div>
          </div>
        </div>

        {/* Right side - register form */}
        <div className={styles["auth-register-page-page__right"]}>
          <div className={styles["auth-register-page-page__card"]}>
            <div className={styles["auth-register-page-page__card-header"]}>
              <h1 className={styles["auth-register-page-page__title"]}>
                Tạo tài khoản
              </h1>
              <p className={styles["auth-register-page-page__subtitle"]}>
                Bắt đầu hành trình âm thanh cao cấp của bạn.
              </p>
            </div>


            <form
              className={styles["auth-register-page-page__form"]}
              onSubmit={handleSubmit}
            >
              <label className={styles["auth-register-page-page__field"]}>
                <span className={styles["auth-register-page-page__field-label"]}>
                  Họ và tên
                </span>
                <div className={styles["auth-register-page-page__field-control"]}>
                  <input
                    type="text"
                    placeholder="Nguyễn Văn A"
                    className={styles["auth-register-page-page__input"]}
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                  />
                  <span
                    className={styles["auth-register-page-page__input-icon-text"]}
                    aria-hidden="true"
                  >
                    *
                  </span>
                </div>
              </label>

              <label className={styles["auth-register-page-page__field"]}>
                <span className={styles["auth-register-page-page__field-label"]}>
                  Địa chỉ email
                </span>
                <div className={styles["auth-register-page-page__field-control"]}>
                  <input
                    type="email"
                    placeholder="tenban@vidu.com"
                    className={styles["auth-register-page-page__input"]}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                  <span
                    className={styles["auth-register-page-page__input-icon-mail"]}
                    aria-hidden="true"
                  >
                    @
                  </span>
                </div>
              </label>

              <label className={styles["auth-register-page-page__field"]}>
                <span className={styles["auth-register-page-page__field-label"]}>
                  Mật khẩu
                </span>
                <div className={styles["auth-register-page-page__field-control"]}>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Tạo mật khẩu"
                    className={styles["auth-register-page-page__input"]}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={handleTogglePassword}
                    className={
                      styles["auth-register-page-page__input-icon-toggle"]
                    }
                    aria-label={
                      showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"
                    }
                    tabIndex={-1}
                  >
                    {showPassword ? "Ẩn" : "Hiện"}
                  </button>
                </div>
              </label>

              <label className={styles["auth-register-page-page__field"]}>
                <span className={styles["auth-register-page-page__field-label"]}>
                  Xác nhận mật khẩu
                </span>
                <div className={styles["auth-register-page-page__field-control"]}>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Nhập lại mật khẩu"
                    className={styles["auth-register-page-page__input"]}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={handleToggleConfirmPassword}
                    className={
                      styles["auth-register-page-page__input-icon-toggle"]
                    }
                    aria-label={
                      showConfirmPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"
                    }
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? "Ẩn" : "Hiện"}
                  </button>
                </div>
              </label>

              <div className={styles["auth-register-page-page__terms-row"]}>
                <input
                  id="terms"
                  name="terms"
                  type="checkbox"
                  className={styles["auth-register-page-page__checkbox"]}
                  checked={acceptedTerms}
                  onChange={(event) =>
                    setAcceptedTerms(event.target.checked)
                  }
                />
                <label
                  htmlFor="terms"
                  className={
                    styles["auth-register-page-page__terms-label"]
                  }
                >
                  Tôi đồng ý với{" "}
                  <Link
                    href="/terms"
                    className={styles["auth-register-page-page__link"]}
                  >
                    Điều khoản dịch vụ
                  </Link>{" "}
                  và{" "}
                  <Link
                    href="/privacy"
                    className={styles["auth-register-page-page__link"]}
                  >
                    Chính sách bảo mật
                  </Link>
                  .
                </label>
              </div>

              <button
                type="submit"
                className={styles["auth-register-page-page__submit"]}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Đang tạo tài khoản..." : "Đăng ký"}
              </button>
            </form>

            <div className={styles["auth-register-page-page__footer"]}>
              <span>Đã có tài khoản?</span>
              <Link
                href="/login"
                className={styles["auth-register-page-page__footer-link"]}
              >
                Đăng nhập
              </Link>
            </div>
          </div>
        </div>
      </div>
      </div>
    </React.Fragment>
  );
}

export default AuthRegisterPage;

