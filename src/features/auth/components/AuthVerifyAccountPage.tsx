"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { FaHeadphonesAlt } from "react-icons/fa";
import {
  MdArrowForward,
  MdSchedule,
  MdVerifiedUser,
  MdSupportAgent,
  MdWest,
} from "react-icons/md";
import PageTransitionOverlay from "@/components/shared/PageTransitionOverlay";
import styles from "./AuthVerifyAccountPage.module.css";

const OTP_TTL_MS = 10 * 60 * 1000;

function obfuscateEmail(rawEmail: string | null): string {
  if (!rawEmail) {
    return "nguy***@gmail.com";
  }

  const trimmed = rawEmail.trim();
  const atIndex = trimmed.indexOf("@");

  if (atIndex <= 1) {
    return trimmed;
  }

  const namePart = trimmed.slice(0, atIndex);
  const domainPart = trimmed.slice(atIndex);

  if (namePart.length <= 3) {
    return `${namePart[0]}***${domainPart}`;
  }

  const visible = namePart.slice(0, 4);
  return `${visible}***${domainPart}`;
}

function formatRemainingTime(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const minutesText = minutes.toString().padStart(2, "0");
  const secondsText = seconds.toString().padStart(2, "0");
  return `${minutesText}:${secondsText}`;
}

function AuthVerifyAccountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams.get("email");
  const displayEmail = obfuscateEmail(emailFromQuery);

  const [isTransitionActive, setIsTransitionActive] = useState(true);
  const [otpValues, setOtpValues] = useState<string[]>(() =>
    Array(8).fill("")
  );
  const [remainingMs, setRemainingMs] = useState<number>(OTP_TTL_MS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | null;
    text: string;
  }>({ type: null, text: "" });

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIsTransitionActive(false);
    }, 1100);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setRemainingMs((previous) => {
        if (previous <= 1000) {
          return 0;
        }
        return previous - 1000;
      });
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const handleOtpChange = (index: number, value: string) => {
    const char = value.slice(-1).toUpperCase();
    setOtpValues((prev) => {
      const next = [...prev];
      next[index] = char;
      return next;
    });

    if (char && index < inputRefs.current.length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Backspace" && !otpValues[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData
      .getData("text")
      .replace(/\s/g, "")
      .toUpperCase()
      .slice(0, 8);

    if (pasted.length === 0) {
      return;
    }

    const next = Array(8).fill("");
    for (let i = 0; i < pasted.length && i < 8; i++) {
      next[i] = pasted[i];
    }
    setOtpValues(next);

    const lastFilledIndex = Math.min(pasted.length - 1, 7);
    inputRefs.current[lastFilledIndex]?.focus();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const rawEmail = emailFromQuery?.trim();

    if (!rawEmail) {
      setStatusMessage({
        type: "error",
        text: "Không tìm thấy email cần kích hoạt. Vui lòng quay lại bước đăng ký.",
      });
      return;
    }

    const code = otpValues.join("").trim().toUpperCase();

    if (!code || code.length !== 8) {
      setStatusMessage({
        type: "error",
        text: "Vui lòng nhập đầy đủ mã OTP gồm 8 ký tự.",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      setStatusMessage({ type: null, text: "" });

      const response = await fetch("/api/auth/verify-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: rawEmail,
          code,
        }),
      });

      const data = (await response.json()) as {
        message?: string;
        status?: string;
        code?: string;
      };

      if (!response.ok) {
        if (data.code === "OTP_TOO_MANY_ATTEMPTS") {
          setIsLocked(true);
          toast.error(
            data.message ??
              "Bạn đã nhập sai quá nhiều lần. Vui lòng yêu cầu mã OTP mới.",
          );
          setStatusMessage({
            type: "error",
            text:
              data.message ??
              "Bạn đã nhập sai quá nhiều lần. Vui lòng yêu cầu mã OTP mới.",
          });
        } else if (data.code === "OTP_INVALID") {
          const nextAttempts = failedAttempts + 1;
          setFailedAttempts(nextAttempts);

          if (nextAttempts >= 5) {
            setIsLocked(true);
            const lockedMsg =
              "Bạn đã nhập sai mã OTP quá 5 lần. Vui lòng yêu cầu mã OTP mới để tiếp tục.";
            toast.error(lockedMsg);
            setStatusMessage({ type: "error", text: lockedMsg });
          } else {
            const remaining = 5 - nextAttempts;
            const errorMsg =
              data.message ??
              `Mã OTP không chính xác. Bạn còn ${remaining} lần thử.`;
            toast.error(errorMsg);
            setStatusMessage({ type: "error", text: errorMsg });
          }
        } else {
          const errorMsg =
            data.message ??
            "Không thể kích hoạt tài khoản. Vui lòng kiểm tra lại mã OTP và thử lại.";
          toast.error(errorMsg);
          setStatusMessage({ type: "error", text: errorMsg });
        }
        return;
      }

      toast.success("Tài khoản của bạn đã được kích hoạt thành công!");
      setStatusMessage({
        type: "success",
        text: "Tài khoản của bạn đã được kích hoạt thành công. Đang chuyển về trang đăng nhập...",
      });

      setIsTransitionActive(true);

      window.setTimeout(() => {
        router.push("/login");
      }, 1100);
    } catch (error) {
      console.error("[AuthVerifyAccountPage] Failed to verify account", error);
      setStatusMessage({
        type: "error",
        text: "Đã xảy ra lỗi trong quá trình kích hoạt tài khoản. Vui lòng thử lại sau.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (remainingMs > 0 || isResending) {
      return;
    }

    const rawEmail = emailFromQuery?.trim();

    if (!rawEmail) {
      setStatusMessage({
        type: "error",
        text: "Không tìm thấy email cần gửi lại mã OTP. Vui lòng quay lại bước đăng ký.",
      });
      return;
    }

    try {
      setIsResending(true);
      setStatusMessage({ type: null, text: "" });

      const response = await fetch("/api/auth/resend-activation-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: rawEmail,
        }),
      });

      const data = (await response.json()) as {
        message?: string;
        success?: boolean;
        code?: string;
      };

      if (!response.ok) {
        setStatusMessage({
          type: "error",
          text:
            data.message ??
            "Không thể gửi lại mã OTP. Vui lòng thử lại sau hoặc liên hệ hỗ trợ.",
        });
        return;
      }

      setOtpValues(Array(8).fill(""));
      setRemainingMs(OTP_TTL_MS);
      setFailedAttempts(0);
      setIsLocked(false);

      setStatusMessage({
        type: "success",
        text:
          data.message ??
          "Chúng tôi vừa gửi một mã OTP mới đến email của bạn. Mã cũ sẽ không còn hiệu lực.",
      });
    } catch (error) {
      console.error("[AuthVerifyAccountPage] Failed to resend activation OTP", error);
      setStatusMessage({
        type: "error",
        text:
          "Đã xảy ra lỗi trong quá trình gửi lại mã OTP. Vui lòng thử lại sau hoặc liên hệ hỗ trợ.",
      });
    } finally {
      setIsResending(false);
    }
  };

  const isResendDisabled = (remainingMs > 0 && !isLocked) || isSubmitting || isResending;
  const formattedRemainingTime = formatRemainingTime(remainingMs);

  return (
    <React.Fragment>
      <PageTransitionOverlay
        isActive={isTransitionActive}
        subtitle="Đang chuẩn bị bước kích hoạt tài khoản cuối cùng cho bạn..."
        bottomText="Đức Uy Audio đang xác nhận thông tin tài khoản của bạn..."
      />
      <div className={styles["auth-verify-account-page"]}>
        {/* Left side - brand visual */}
        <div className={styles["auth-verify-account-page__left"]}>
          <div className={styles["auth-verify-account-page__left-image"]} />
          <div className={styles["auth-verify-account-page__left-overlay"]} />
          <div className={styles["auth-verify-account-page__left-glow"]} />

          <div className={styles["auth-verify-account-page__left-header"]}>
            <div className={styles["auth-verify-account-page__logo"]}>
              <FaHeadphonesAlt
                className={styles["auth-verify-account-page__logo-icon"]}
                aria-hidden="true"
              />
            </div>
            <div className={styles["auth-verify-account-page__brand-text"]}>
              <span
                className={
                  styles["auth-verify-account-page__brand-text-primary"]
                }
              >
                Đức Uy
              </span>
              <span
                className={
                  styles["auth-verify-account-page__brand-text-secondary"]
                }
              >
                Audio
              </span>
            </div>
          </div>

          <div className={styles["auth-verify-account-page__left-content"]}>
            <div
              className={
                styles["auth-verify-account-page__left-content-decoration"]
              }
            >
              <div
                className={
                  styles[
                    "auth-verify-account-page__left-content-decoration-glow"
                  ]
                }
              />
              <div
                className={
                  styles[
                    "auth-verify-account-page__left-content-decoration-line"
                  ]
                }
              />
            </div>

            <h1 className={styles["auth-verify-account-page__headline"]}>
              Chỉ còn <br />
              <span
                className={styles["auth-verify-account-page__headline-accent"]}
              >
                một bước nữa...
              </span>
            </h1>
            <p className={styles["auth-verify-account-page__subtitle"]}>
              Hoàn tất xác minh để bắt đầu hành trình trải nghiệm âm thanh cao
              cấp cùng Đức Uy Audio.
            </p>
          </div>

          <div className={styles["auth-verify-account-page__left-footer"]}>
            Premium Audio Experience
          </div>
        </div>

        {/* Right side - OTP card */}
        <div className={styles["auth-verify-account-page__right"]}>
          <div className={styles["auth-verify-account-page__content-wrapper"]}>
            <div className={styles["auth-verify-account-page__mobile-brand"]}>
              <div className={styles["auth-verify-account-page__logo"]}>
                <FaHeadphonesAlt
                  className={styles["auth-verify-account-page__logo-icon"]}
                  aria-hidden="true"
                />
              </div>
              <div
                className={styles["auth-verify-account-page__brand-text-mobile"]}
              >
                <span
                  className={
                    styles["auth-verify-account-page__brand-text-primary-mobile"]
                  }
                >
                  Đức Uy
                </span>
                <span
                  className={
                    styles[
                      "auth-verify-account-page__brand-text-secondary-mobile"
                    ]
                  }
                >
                  Audio
                </span>
              </div>
            </div>

            <div className={styles["auth-verify-account-page__card"]}>
              <div
                className={styles["auth-verify-account-page__card-header"]}
              >
                <h2 className={styles["auth-verify-account-page__title"]}>
                  Kích hoạt tài khoản
                </h2>
                <p className={styles["auth-verify-account-page__description"]}>
                  Chúng tôi đã gửi mã xác minh gồm 8 ký tự đến email
                  <br />
                  <span
                    className={styles["auth-verify-account-page__email-highlight"]}
                  >
                    {displayEmail}
                  </span>
                </p>
              </div>

              {statusMessage.type === "success" && statusMessage.text && (
                <div
                  className={styles["auth-verify-account-page__status-success"]}
                  role="status"
                >
                  {statusMessage.text}
                </div>
              )}

              {statusMessage.type === "error" && statusMessage.text && (
                <div
                  className={styles["auth-verify-account-page__status-error"]}
                  role="alert"
                >
                  {statusMessage.text}
                </div>
              )}

              <form
                className={styles["auth-verify-account-page__form"]}
                onSubmit={handleSubmit}
              >
                <div
                  className={styles["auth-verify-account-page__otp-input-row"]}
                  onPaste={handleOtpPaste}
                >
                  {otpValues.map((value, index) => {
                    const isPrimary = index < 4;
                    const inputClassName = [
                      styles["auth-verify-account-page__otp-input"],
                      isPrimary
                        ? styles[
                            "auth-verify-account-page__otp-input--primary"
                          ]
                        : styles[
                            "auth-verify-account-page__otp-input--accent"
                          ],
                    ].join(" ");

                    return (
                      <input
                        key={index}
                        ref={(element) => {
                          inputRefs.current[index] = element;
                        }}
                        type="text"
                        inputMode="text"
                        maxLength={1}
                        className={inputClassName}
                        value={value}
                        disabled={isSubmitting || isLocked}
                        onChange={(event) =>
                          handleOtpChange(index, event.target.value)
                        }
                        onKeyDown={(event) =>
                          handleOtpKeyDown(index, event)
                        }
                        aria-label={`Ký tự OTP thứ ${index + 1}`}
                      />
                    );
                  })}
                </div>

                <div
                  className={styles["auth-verify-account-page__timer-wrapper"]}
                >
                  <div
                    className={styles["auth-verify-account-page__timer-pill"]}
                  >
                    <MdSchedule
                      className={
                        styles["auth-verify-account-page__timer-icon"]
                      }
                      aria-hidden="true"
                    />
                    <span
                      className={
                        styles["auth-verify-account-page__timer-text"]
                      }
                    >
                      {formattedRemainingTime}
                    </span>
                  </div>
                </div>

                <div className={styles["auth-verify-account-page__actions"]}>
                  <button
                    type="submit"
                    className={
                      styles["auth-verify-account-page__submit-button"]
                    }
                    disabled={isSubmitting || isLocked}
                  >
                    <span>
                      {isSubmitting
                        ? "Đang xác minh mã OTP..."
                        : isLocked
                          ? "Đã khoá - Vui lòng gửi lại mã mới"
                          : "Xác nhận & kích hoạt"}
                    </span>
                    <MdArrowForward
                      className={
                        styles["auth-verify-account-page__submit-icon"]
                      }
                      aria-hidden="true"
                    />
                  </button>

                  <div
                    className={styles["auth-verify-account-page__resend-row"]}
                  >
                    <p
                      className={
                        styles["auth-verify-account-page__resend-text"]
                      }
                    >
                      Không nhận được mã?
                      <button
                        type="button"
                        className={
                        [
                          styles["auth-verify-account-page__resend-link"],
                          isResendDisabled
                            ? styles[
                                "auth-verify-account-page__resend-link--disabled"
                              ]
                            : "",
                        ].join(" ")
                        }
                        onClick={handleResendOtp}
                        disabled={isResendDisabled}
                        title={
                          isResendDisabled
                            ? "Bạn chỉ có thể yêu cầu mã OTP mới sau khi mã hiện tại hết hạn (10 phút)."
                            : "Gửi lại mã OTP mới tới email của bạn."
                        }
                      >
                        Gửi lại mã mới
                      </button>
                    </p>
                  </div>
                </div>
              </form>

              <div
                className={styles["auth-verify-account-page__trust-row"]}
              >
                <div
                  className={styles["auth-verify-account-page__trust-item"]}
                >
                  <MdVerifiedUser
                    className={
                      styles["auth-verify-account-page__trust-icon"]
                    }
                    aria-hidden="true"
                  />
                  <span
                    className={
                      styles["auth-verify-account-page__trust-label"]
                    }
                  >
                    Bảo mật SSL
                  </span>
                </div>
                <div
                  className={styles["auth-verify-account-page__trust-item"]}
                >
                  <MdSupportAgent
                    className={
                      styles["auth-verify-account-page__trust-icon"]
                    }
                    aria-hidden="true"
                  />
                  <span
                    className={
                      styles["auth-verify-account-page__trust-label"]
                    }
                  >
                    Hỗ trợ 24/7
                  </span>
                </div>
              </div>
            </div>

            <div className={styles["auth-verify-account-page__back-link-row"]}>
              <Link
                href="/login"
                className={styles["auth-verify-account-page__back-link"]}
              >
                <MdWest
                  className={styles["auth-verify-account-page__back-icon"]}
                  aria-hidden="true"
                />
                <span>Quay lại Đăng nhập</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}

export default AuthVerifyAccountPage;
