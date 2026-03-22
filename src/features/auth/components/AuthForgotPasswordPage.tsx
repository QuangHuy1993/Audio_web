"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FaHeadphonesAlt } from "react-icons/fa";
import { MdArrowBack, MdMail, MdShield } from "react-icons/md";
import PageTransitionOverlay from "@/components/shared/PageTransitionOverlay";
import styles from "./AuthForgotPasswordPage.module.css";

function AuthForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTransitionActive, setIsTransitionActive] = useState(true);
  const [overlaySubtitle, setOverlaySubtitle] = useState(
    "Đang chuẩn bị không gian khôi phục mật khẩu cho bạn...",
  );
  const [overlayBottomText, setOverlayBottomText] = useState(
    "Đức Uy Audio đang bảo vệ và xác thực thông tin tài khoản của bạn...",
  );

  const hasInitialTransitionEndedRef = useRef(false);

  useEffect(() => {
    if (hasInitialTransitionEndedRef.current) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsTransitionActive(false);
      hasInitialTransitionEndedRef.current = true;
    }, 1100);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.error("Vui lòng nhập địa chỉ email của bạn.");
      return;
    }

    const normalizedEmail = trimmedEmail.toLowerCase();

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
        }),
      });

      const data = (await response.json()) as {
        success?: boolean;
        message?: string;
        code?: string;
      };

      if (!response.ok) {
        toast.error(
          data.message ??
            "Không thể gửi yêu cầu đặt lại mật khẩu. Vui lòng thử lại sau.",
        );
        return;
      }

      setOverlaySubtitle(
        "Đang gửi mã OTP đến email của bạn, vui lòng kiểm tra hộp thư...",
      );
      setOverlayBottomText(
        "Đức Uy Audio đang chuẩn bị bước đặt lại mật khẩu an toàn cho bạn...",
      );
      setIsTransitionActive(true);

      window.setTimeout(() => {
        router.push(
          `/reset-password?email=${encodeURIComponent(normalizedEmail)}`,
        );
      }, 1100);
    } catch (error) {
      console.error(
        "[AuthForgotPasswordPage] Failed to request password reset",
        error,
      );
      toast.error(
        "Đã xảy ra lỗi trong quá trình gửi yêu cầu. Vui lòng thử lại sau.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <React.Fragment>
      <PageTransitionOverlay
        isActive={isTransitionActive}
        subtitle={overlaySubtitle}
        bottomText={overlayBottomText}
      />
      <div className={styles["auth-forgot-password-page"]}>
        <div className={styles["auth-forgot-password-page__left"]}>
          <div
            className={
              styles["auth-forgot-password-page__left-background-gradient"]
            }
          />
          <div
            className={
              styles["auth-forgot-password-page__left-light-overlay"]
            }
          />

          <div className={styles["auth-forgot-password-page__left-header"]}>
            <div className={styles["auth-forgot-password-page__logo"]}>
              <FaHeadphonesAlt
                className={styles["auth-forgot-password-page__logo-icon"]}
                aria-hidden="true"
              />
            </div>
            <div className={styles["auth-forgot-password-page__brand-text"]}>
              <span
                className={
                  styles["auth-forgot-password-page__brand-text-primary"]
                }
              >
                Đức Uy
              </span>
              <span
                className={
                  styles["auth-forgot-password-page__brand-text-secondary"]
                }
              >
                Audio
              </span>
            </div>
          </div>

          <div className={styles["auth-forgot-password-page__left-content"]}>
            <div
              className={
                styles["auth-forgot-password-page__left-image-wrapper"]
              }
            >
              <div
                className={
                  styles["auth-forgot-password-page__left-image-border"]
                }
              >
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAOZF-zaNLGvifvkNdC50773xQkh6-vno9fi1XVuqD7xE0AANgGtDVM1dK0FMtLfD7mzlkzITk477izrEQgflfInQONioR2RLoWeCydbykAYTxnVVx460tKjhLVW641PVaalqT1dgbEweMlUheWSymmisI8DdZMD1gaqcKK0gurIQwd0qVlufih000pP2sentaaUvjvkLZAL0ehp4pDc8obreJoBV8kX5DSjVQDWXcwOt66HVH7GS7LuwuKhbywKDQtkIJgbr00g6b-"
                  alt="Người dùng đang tận hưởng âm nhạc"
                  className={
                    styles["auth-forgot-password-page__left-image-circle"]
                  }
                />
              </div>
            </div>

            <h1 className={styles["auth-forgot-password-page__headline"]}>
              Khôi phục <br />
              <span
                className={styles["auth-forgot-password-page__headline-accent"]}
              >
                truy cập...
              </span>
            </h1>
            <p className={styles["auth-forgot-password-page__subtitle"]}>
              Đừng để gián đoạn đam mê. Chúng tôi sẽ giúp bạn quay lại với
              không gian âm nhạc đẳng cấp ngay lập tức.
            </p>
          </div>

          <div className={styles["auth-forgot-password-page__left-footer"]}>
            Experience the Sound of Excellence
          </div>
        </div>

        <div className={styles["auth-forgot-password-page__right"]}>
          <div className={styles["auth-forgot-password-page__right-light"]} />
          <div className={styles["auth-forgot-password-page__right-inner"]}>
            <div
              className={styles["auth-forgot-password-page__brand-mobile-row"]}
            >
              <div className={styles["auth-forgot-password-page__logo"]}>
                <FaHeadphonesAlt
                  className={styles["auth-forgot-password-page__logo-icon"]}
                  aria-hidden="true"
                />
              </div>
              <div
                className={
                  styles["auth-forgot-password-page__brand-text-mobile"]
                }
              >
                <span
                  className={
                    styles["auth-forgot-password-page__brand-text-primary-mobile"]
                  }
                >
                  Đức Uy
                </span>
                <span
                  className={
                    styles[
                      "auth-forgot-password-page__brand-text-secondary-mobile"
                    ]
                  }
                >
                  Audio
                </span>
              </div>
            </div>

            <div className={styles["auth-forgot-password-page__card"]}>
              <div
                className={styles["auth-forgot-password-page__card-header"]}
              >
                <h2 className={styles["auth-forgot-password-page__title"]}>
                  Quên mật khẩu
                </h2>
                <p className={styles["auth-forgot-password-page__description"]}>
                  Nhập địa chỉ email liên kết với tài khoản của bạn. Chúng tôi
                  sẽ gửi một mã xác minh để bạn có thể đặt lại mật khẩu.
                </p>
              </div>

              <form
                className={styles["auth-forgot-password-page__form"]}
                onSubmit={handleSubmit}
              >
                <div className={styles["auth-forgot-password-page__field"]}>
                  <label
                    htmlFor="forgot-password-email"
                    className={
                      styles["auth-forgot-password-page__field-label"]
                    }
                  >
                    Email
                  </label>
                  <div
                    className={
                      styles["auth-forgot-password-page__field-control"]
                    }
                  >
                    <div
                      className={
                        styles[
                          "auth-forgot-password-page__field-icon-wrapper"
                        ]
                      }
                    >
                      <MdMail
                        className={
                          styles["auth-forgot-password-page__field-icon"]
                        }
                        aria-hidden="true"
                      />
                    </div>
                    <input
                      id="forgot-password-email"
                      type="email"
                      placeholder="example@gmail.com"
                      className={
                        styles["auth-forgot-password-page__field-input"]
                      }
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className={
                    styles["auth-forgot-password-page__submit-button"]
                  }
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? "Đang gửi..."
                    : "Gửi mã đặt lại mật khẩu"}
                </button>
              </form>

              <div
                className={styles["auth-forgot-password-page__card-footer"]}
              >
                <div
                  className={
                    styles["auth-forgot-password-page__security-row"]
                  }
                >
                  <MdShield
                    className={
                      styles["auth-forgot-password-page__security-icon"]
                    }
                    aria-hidden="true"
                  />
                  <span
                    className={
                      styles["auth-forgot-password-page__security-text"]
                    }
                  >
                    Mã hóa bảo mật 256-bit
                  </span>
                </div>

                <div
                  className={
                    styles["auth-forgot-password-page__bottom-links-row"]
                  }
                >
                  <Link
                    href="/login"
                    className={
                      styles["auth-forgot-password-page__back-to-login-link"]
                    }
                  >
                    <MdArrowBack
                      className={
                        styles["auth-forgot-password-page__back-to-login-icon"]
                      }
                      aria-hidden="true"
                    />
                    <span>Quay lại Đăng nhập</span>
                  </Link>
                  <Link
                    href="/register"
                    className={
                      styles["auth-forgot-password-page__register-link"]
                    }
                  >
                    Đăng ký mới
                  </Link>
                </div>
              </div>
            </div>

            <div className={styles["auth-forgot-password-page__footer"]}>
              © 2024 Đức Uy Audio. All rights reserved.
            </div>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

export default AuthForgotPasswordPage;
