"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { FaHeadphonesAlt } from "react-icons/fa";
import {
  MdKey,
  MdLock,
  MdLockReset,
  MdSchedule,
  MdVerifiedUser,
  MdVisibility,
  MdVisibilityOff,
  MdWest,
} from "react-icons/md";
import PageTransitionOverlay from "@/components/shared/PageTransitionOverlay";
import styles from "./AuthResetPasswordPage.module.css";

const OTP_TTL_MS = 10 * 60 * 1000;

type StatusMessage =
  | { type: "success"; text: string }
  | { type: "error"; text: string }
  | { type: null; text: "" };

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

function AuthResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams.get("email");
  const displayEmail = obfuscateEmail(emailFromQuery);

  const [isTransitionActive, setIsTransitionActive] = useState(true);
  const [overlaySubtitle, setOverlaySubtitle] = useState(
    "Đang chuẩn bị bước đặt lại mật khẩu an toàn cho bạn...",
  );
  const [overlayBottomText, setOverlayBottomText] = useState(
    "Đức Uy Audio đang bảo vệ và xác thực thông tin tài khoản của bạn...",
  );

  const [otpValues, setOtpValues] = useState<string[]>(() => Array(8).fill(""));
  const [remainingMs, setRemainingMs] = useState<number>(OTP_TTL_MS);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage>({
    type: null,
    text: "",
  });

  const hasInitialTransitionEndedRef = useRef(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

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
    setOtpValues((previous) => {
      const next = [...previous];
      next[index] = char;
      return next;
    });

    if (char && index < inputRefs.current.length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>,
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

  const validateForm = () => {
    const otpCode = otpValues.join("").trim();

    if (!otpCode || otpCode.length !== 8) {
      setStatusMessage({
        type: "error",
        text: "Vui lòng nhập đầy đủ mã OTP gồm 8 ký tự.",
      });
      return false;
    }

    const trimmedPassword = password.trim();
    const trimmedConfirmPassword = confirmPassword.trim();

    if (!trimmedPassword) {
      setStatusMessage({
        type: "error",
        text: "Vui lòng nhập mật khẩu mới.",
      });
      return false;
    }

    if (trimmedPassword.length < 8) {
      setStatusMessage({
        type: "error",
        text: "Mật khẩu mới phải có ít nhất 8 ký tự.",
      });
      return false;
    }

    if (trimmedPassword !== trimmedConfirmPassword) {
      setStatusMessage({
        type: "error",
        text: "Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại.",
      });
      return false;
    }

    setStatusMessage({ type: null, text: "" });
    return true;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const rawEmail = emailFromQuery?.trim();

    if (!rawEmail) {
      setStatusMessage({
        type: "error",
        text: "Không tìm thấy email cần đặt lại mật khẩu. Vui lòng quay lại bước quên mật khẩu.",
      });
      return;
    }

    if (!validateForm()) {
      return;
    }

    const normalizedEmail = rawEmail.toLowerCase();
    const otpCode = otpValues.join("").trim().toUpperCase();
    const newPassword = password.trim();

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: normalizedEmail,
          code: otpCode,
          newPassword,
        }),
      });

      const data = (await response.json()) as {
        success?: boolean;
        message?: string;
        code?: string;
      };

      if (!response.ok) {
        if (data.code === "OTP_TOO_MANY_ATTEMPTS") {
          setIsLocked(true);
          const lockedMsg =
            data.message ??
            "Bạn đã nhập sai quá nhiều lần. Vui lòng yêu cầu mã OTP mới.";
          toast.error(lockedMsg);
          setStatusMessage({ type: "error", text: lockedMsg });
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
            "Không thể cập nhật mật khẩu. Vui lòng kiểm tra lại thông tin và thử lại.";
          toast.error(errorMsg);
          setStatusMessage({ type: "error", text: errorMsg });
        }
        return;
      }

      toast.success("Mật khẩu của bạn đã được cập nhật thành công!");
      setStatusMessage({
        type: "success",
        text: "Mật khẩu của bạn đã được cập nhật thành công. Đang chuyển về trang đăng nhập...",
      });

      setOverlaySubtitle(
        "Đang kết nối bạn với không gian âm thanh quen thuộc bằng mật khẩu mới...",
      );
      setOverlayBottomText(
        "Đức Uy Audio đang đưa bạn trở lại hành trình trải nghiệm âm thanh của mình...",
      );
      setIsTransitionActive(true);

      window.setTimeout(() => {
        router.push("/login");
      }, 1100);
    } catch (error) {
      console.error(
        "[AuthResetPasswordPage] Failed to reset password with OTP",
        error,
      );
      setStatusMessage({
        type: "error",
        text: "Đã xảy ra lỗi trong quá trình cập nhật mật khẩu. Vui lòng thử lại sau.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (remainingMs > 0) {
      return;
    }

    const rawEmail = emailFromQuery?.trim();

    if (!rawEmail) {
      setStatusMessage({
        type: "error",
        text: "Không tìm thấy email để gửi lại mã OTP. Vui lòng quay lại bước quên mật khẩu.",
      });
      return;
    }

    const normalizedEmail = rawEmail.toLowerCase();

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
          `Chúng tôi vừa gửi một mã OTP mới đến ${displayEmail}. Mã cũ sẽ không còn hiệu lực.`,
      });
    } catch (error) {
      console.error(
        "[AuthResetPasswordPage] Failed to resend password reset OTP",
        error,
      );
      setStatusMessage({
        type: "error",
        text:
          "Đã xảy ra lỗi trong quá trình gửi lại mã OTP. Vui lòng thử lại sau hoặc liên hệ hỗ trợ.",
      });
    }
  };

  const isResendDisabled = remainingMs > 0 && !isLocked;
  const formattedRemainingTime = formatRemainingTime(remainingMs);

  const passwordInputType = showPassword ? "text" : "password";
  const confirmPasswordInputType = showConfirmPassword ? "text" : "password";

  return (
    <React.Fragment>
      <PageTransitionOverlay
        isActive={isTransitionActive}
        subtitle={overlaySubtitle}
        bottomText={overlayBottomText}
      />
      <div className={styles["auth-reset-password-page"]}>
        <div className={styles["auth-reset-password-page__left"]}>
          <div className={styles["auth-reset-password-page__left-image"]} />
          <div className={styles["auth-reset-password-page__left-overlay"]} />
          <div className={styles["auth-reset-password-page__left-green-tint"]} />
          <div
            className={
              styles["auth-reset-password-page__left-blur-circle-primary"]
            }
          />
          <div
            className={
              styles["auth-reset-password-page__left-blur-circle-secondary"]
            }
          />

          <div className={styles["auth-reset-password-page__left-header"]}>
            <div className={styles["auth-reset-password-page__logo"]}>
              <FaHeadphonesAlt
                className={styles["auth-reset-password-page__logo-icon"]}
                aria-hidden="true"
              />
            </div>
            <div className={styles["auth-reset-password-page__brand-text"]}>
              <span
                className={
                  styles["auth-reset-password-page__brand-text-primary"]
                }
              >
                Đức Uy
              </span>
              <span
                className={
                  styles["auth-reset-password-page__brand-text-secondary"]
                }
              >
                Audio
              </span>
            </div>
          </div>

          <div className={styles["auth-reset-password-page__left-content"]}>
            <h1 className={styles["auth-reset-password-page__headline"]}>
              Đặt lại <br />
              <span
                className={styles["auth-reset-password-page__headline-accent"]}
              >
                mật khẩu
              </span>
            </h1>
            <p className={styles["auth-reset-password-page__subtitle"]}>
              Tạo mật khẩu mới an toàn để tiếp tục trải nghiệm không gian âm
              thanh đỉnh cao.
            </p>
          </div>

          <div className={styles["auth-reset-password-page__left-footer"]}>
            <div
              className={styles["auth-reset-password-page__left-footer-line"]}
            />
            <div
              className={styles["auth-reset-password-page__left-footer-text"]}
            >
              Premium Audio Experience
            </div>
          </div>
        </div>

        <div className={styles["auth-reset-password-page__right"]}>
          <div className={styles["auth-reset-password-page__right-inner"]}>
            <div
              className={styles["auth-reset-password-page__brand-mobile-row"]}
            >
              <div className={styles["auth-reset-password-page__logo"]}>
                <FaHeadphonesAlt
                  className={styles["auth-reset-password-page__logo-icon"]}
                  aria-hidden="true"
                />
              </div>
              <div
                className={
                  styles["auth-reset-password-page__brand-text-mobile"]
                }
              >
                <span
                  className={
                    styles[
                      "auth-reset-password-page__brand-text-primary-mobile"
                    ]
                  }
                >
                  Đức Uy
                </span>
                <span
                  className={
                    styles[
                      "auth-reset-password-page__brand-text-secondary-mobile"
                    ]
                  }
                >
                  Audio
                </span>
              </div>
            </div>

            <div className={styles["auth-reset-password-page__card"]}>
              <div
                className={styles["auth-reset-password-page__card-header"]}
              >
                <h2 className={styles["auth-reset-password-page__title"]}>
                  Đặt lại mật khẩu
                </h2>
                <p className={styles["auth-reset-password-page__description"]}>
                  Vui lòng nhập mã OTP đã được gửi đến email{" "}
                  <span
                    className={styles["auth-reset-password-page__email-text"]}
                  >
                    {displayEmail}
                  </span>{" "}
                  và thiết lập mật khẩu mới.
                </p>
              </div>

              {statusMessage.type === "success" && statusMessage.text && (
                <div
                  className={
                    styles["auth-reset-password-page__status-success"]
                  }
                  role="status"
                >
                  {statusMessage.text}
                </div>
              )}

              {statusMessage.type === "error" && statusMessage.text && (
                <div
                  className={styles["auth-reset-password-page__status-error"]}
                  role="alert"
                >
                  {statusMessage.text}
                </div>
              )}

              <form
                className={styles["auth-reset-password-page__form"]}
                onSubmit={handleSubmit}
              >
                <div className={styles["auth-reset-password-page__otp-section"]}>
                  <label
                    className={
                      styles["auth-reset-password-page__field-label-inline"]
                    }
                  >
                    Mã xác thực OTP
                  </label>
                  <div
                    className={styles["auth-reset-password-page__otp-input-row"]}
                    onPaste={handleOtpPaste}
                  >
                    {otpValues.map((value, index) => {
                      const isPrimary = index < 4;
                      const inputClassName = [
                        styles["auth-reset-password-page__otp-input"],
                        isPrimary
                          ? styles[
                              "auth-reset-password-page__otp-input--primary"
                            ]
                          : styles[
                              "auth-reset-password-page__otp-input--accent"
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
                    className={styles["auth-reset-password-page__otp-footer"]}
                  >
                    <div
                      className={
                        styles["auth-reset-password-page__timer-wrapper"]
                      }
                    >
                      <div
                        className={
                          styles["auth-reset-password-page__timer-pill"]
                        }
                      >
                        <MdSchedule
                          className={
                            styles["auth-reset-password-page__timer-icon"]
                          }
                          aria-hidden="true"
                        />
                        <span
                          className={
                            styles["auth-reset-password-page__timer-text"]
                          }
                        >
                          {formattedRemainingTime}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={
                        styles["auth-reset-password-page__resend-button"]
                      }
                      onClick={handleResendOtp}
                      disabled={isResendDisabled}
                    >
                      Gửi lại mã
                    </button>
                  </div>
                </div>

                <div
                  className={styles["auth-reset-password-page__password-section"]}
                >
                  <div className={styles["auth-reset-password-page__field"]}>
                    <label
                      htmlFor="reset-password-new"
                      className={
                        styles["auth-reset-password-page__field-label"]
                      }
                    >
                      Mật khẩu mới
                    </label>
                    <div
                      className={
                        styles["auth-reset-password-page__field-control"]
                      }
                    >
                      <div
                        className={
                          styles[
                            "auth-reset-password-page__field-icon-wrapper-left"
                          ]
                        }
                      >
                        <MdLock
                          className={
                            styles["auth-reset-password-page__field-icon"]
                          }
                          aria-hidden="true"
                          tabIndex={-1}
                        />
                      </div>
                      <input
                        id="reset-password-new"
                        type={passwordInputType}
                        className={
                          styles["auth-reset-password-page__field-input"]
                        }
                        placeholder="Nhập mật khẩu mới"
                        value={password}
                        onChange={(event) =>
                          setPassword(event.target.value)
                        }
                        tabIndex={-1}
                      />
                      <button
                        type="button"
                        className={
                          styles[
                            "auth-reset-password-page__field-icon-button-right"
                          ]
                        }
                        onClick={() =>
                          setShowPassword((previous) => !previous)
                        }
                        aria-label={
                          showPassword
                            ? "Ẩn mật khẩu mới"
                            : "Hiển thị mật khẩu mới"
                        }
                      >
                        {showPassword ? (
                          <MdVisibilityOff
                            className={
                              styles["auth-reset-password-page__field-icon"]
                            }
                            aria-hidden="true"
                          />
                        ) : (
                          <MdVisibility
                            className={
                              styles["auth-reset-password-page__field-icon"]
                            }
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className={styles["auth-reset-password-page__field"]}>
                    <label
                      htmlFor="reset-password-confirm"
                      className={
                        styles["auth-reset-password-page__field-label"]
                      }
                    >
                      Xác nhận mật khẩu
                    </label>
                    <div
                      className={
                        styles["auth-reset-password-page__field-control"]
                      }
                    >
                      <div
                        className={
                          styles[
                            "auth-reset-password-page__field-icon-wrapper-left"
                          ]
                        }
                      >
                        <MdLockReset
                          className={
                            styles["auth-reset-password-page__field-icon"]
                          }
                          aria-hidden="true"
                        />
                      </div>
                      <input
                        id="reset-password-confirm"
                        type={confirmPasswordInputType}
                        className={
                          styles["auth-reset-password-page__field-input"]
                        }
                        placeholder="Xác nhận lại mật khẩu"
                        value={confirmPassword}
                        onChange={(event) =>
                          setConfirmPassword(event.target.value)
                        }
                      />
                      <button
                        type="button"
                        className={
                          styles[
                            "auth-reset-password-page__field-icon-button-right"
                          ]
                        }
                        onClick={() =>
                          setShowConfirmPassword((previous) => !previous)
                        }
                        aria-label={
                          showConfirmPassword
                            ? "Ẩn mật khẩu xác nhận"
                            : "Hiển thị mật khẩu xác nhận"
                        }
                      >
                        {showConfirmPassword ? (
                          <MdVisibilityOff
                            className={
                              styles["auth-reset-password-page__field-icon"]
                            }
                            aria-hidden="true"
                          />
                        ) : (
                          <MdVisibility
                            className={
                              styles["auth-reset-password-page__field-icon"]
                            }
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className={styles["auth-reset-password-page__submit-row"]}>
                  <button
                    type="submit"
                    className={
                      styles["auth-reset-password-page__submit-button"]
                    }
                    disabled={isSubmitting || isLocked}
                  >
                    <span>
                      {isSubmitting
                        ? "Đang cập nhật mật khẩu..."
                        : isLocked
                          ? "Đã khoá - Vui lòng gửi lại mã mới"
                          : "Cập nhật mật khẩu"}
                    </span>
                    <MdKey
                      className={
                        styles["auth-reset-password-page__submit-icon"]
                      }
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </form>

              <div
                className={styles["auth-reset-password-page__trust-section"]}
              >
                <div
                  className={styles["auth-reset-password-page__trust-item"]}
                >
                  <MdVerifiedUser
                    className={styles["auth-reset-password-page__trust-icon"]}
                    aria-hidden="true"
                  />
                  <span
                    className={styles["auth-reset-password-page__trust-label"]}
                  >
                    Bảo mật cao
                  </span>
                </div>
                <div
                  className={styles["auth-reset-password-page__trust-item"]}
                >
                  <MdVerifiedUser
                    className={styles["auth-reset-password-page__trust-icon"]}
                    aria-hidden="true"
                  />
                  <span
                    className={styles["auth-reset-password-page__trust-label"]}
                  >
                    Mã hóa 256-bit
                  </span>
                </div>
              </div>
            </div>

            <div className={styles["auth-reset-password-page__back-link-row"]}>
              <Link
                href="/login"
                className={styles["auth-reset-password-page__back-link"]}
              >
                <MdWest
                  className={styles["auth-reset-password-page__back-icon"]}
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

export default AuthResetPasswordPage;

