/* eslint-disable react/jsx-no-bind */
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import clsx from "clsx";
import {
  MdGraphicEq,
  MdLeaderboard,
  MdPlayCircle,
  MdContactMail,
} from "react-icons/md";
import styles from "./ShopFooter.module.css";

export type ShopFooterProps = {
  year?: number;
  brandName?: string;
};

const DEFAULT_BRAND_NAME = "Đức Uy Audio";

const exploreLinks: { label: string; href: string }[] = [
  {
    label: "Dàn Karaoke",
    href: "/products",
  },
  {
    label: "Dàn nghe nhạc",
    href: "/products",
  },
  {
    label: "Dàn xem phim",
    href: "/products",
  },
  {
    label: "Loa Bluetooth",
    href: "/products",
  },
  {
    label: "Phụ kiện Hi-end",
    href: "/products",
  },
];

const supportLinks: { label: string; href: string }[] = [
  {
    label: "Chính sách bảo hành",
    href: "/support?policy=warranty",
  },
  {
    label: "Hướng dẫn mua hàng",
    href: "/support?policy=returns",
  },
  {
    label: "Vận chuyển & Lắp đặt",
    href: "/support",
  },
  {
    label: "Tin tức âm thanh",
    href: "/support",
  },
  {
    label: "Liên hệ",
    href: "/support#support-contact",
  },
];

export function ShopFooter({ year, brandName = DEFAULT_BRAND_NAME }: ShopFooterProps) {
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [hasNewsletterError, setHasNewsletterError] = useState(false);
  const [newsletterErrorMessage, setNewsletterErrorMessage] = useState<string | null>(null);
  const [isSubmittingNewsletter, setIsSubmittingNewsletter] = useState(false);

  const displayYear = year ?? new Date().getFullYear();

  const handleNewsletterSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = newsletterEmail.trim();

    if (!trimmed) {
      setHasNewsletterError(true);
      setNewsletterErrorMessage("Vui lòng nhập email của bạn.");
      toast.error("Vui lòng nhập email để đăng ký nhận tin.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setHasNewsletterError(true);
      setNewsletterErrorMessage("Email không hợp lệ.");
      toast.error("Email không hợp lệ. Vui lòng kiểm tra lại.");
      return;
    }

    setHasNewsletterError(false);
    setNewsletterErrorMessage(null);
    setIsSubmittingNewsletter(true);

    try {
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, 700);
      });
      setNewsletterEmail("");
      toast.success("Đăng ký nhận tin thành công. Cảm ơn bạn đã đồng hành cùng Đức Uy Audio.");
    } catch {
      toast.error("Không thể đăng ký nhận tin. Vui lòng thử lại sau.");
    } finally {
      setIsSubmittingNewsletter(false);
    }
  };

  return (
    <footer className={styles["shop-footer-footer"]}>
      <div className={styles["shop-footer-footer__inner"]}>
        <div className={styles["shop-footer-footer__grid"]}>
          <div className={styles["shop-footer-footer__brand"]}>
            <div className={styles["shop-footer-footer__brand-row"]}>
              <div className={styles["shop-footer-footer__brand-icon"]}>
                <MdGraphicEq />
              </div>
              <h2 className={styles["shop-footer-footer__brand-name"]}>
                {brandName.toUpperCase()}
              </h2>
            </div>
            <p className={styles["shop-footer-footer__brand-description"]}>
              Đơn vị tiên phong cung cấp giải pháp âm thanh Hi-end tích hợp trí tuệ nhân
              tạo tại Việt Nam, mang đến trải nghiệm nghe nhạc và xem phim đẳng cấp thế
              giới.
            </p>
            <div className={styles["shop-footer-footer__socials"]}>
              <button
                type="button"
                className={styles["shop-footer-footer__social-button"]}
                aria-label="Khám phá sản phẩm"
                onClick={() => {
                  window.location.href = "/products";
                }}
              >
                <MdLeaderboard />
              </button>
              <button
                type="button"
                className={styles["shop-footer-footer__social-button"]}
                aria-label="Kênh video trải nghiệm âm thanh"
              >
                <MdPlayCircle />
              </button>
              <button
                type="button"
                className={styles["shop-footer-footer__social-button"]}
                aria-label="Liên hệ Đức Uy Audio"
                onClick={() => {
                  window.location.href = "/support#support-contact";
                }}
              >
                <MdContactMail />
              </button>
            </div>
          </div>

          <div>
            <h4 className={styles["shop-footer-footer__column-title"]}>Khám phá</h4>
            <ul className={styles["shop-footer-footer__link-list"]}>
              {exploreLinks.map((item) => (
                <li
                  key={item.label}
                  className={styles["shop-footer-footer__link-item"]}
                >
                  <Link href={item.href} className={styles["shop-footer-footer__link"]}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className={styles["shop-footer-footer__column-title"]}>Hỗ trợ</h4>
            <ul className={styles["shop-footer-footer__link-list"]}>
              {supportLinks.map((item) => (
                <li
                  key={item.label}
                  className={styles["shop-footer-footer__link-item"]}
                >
                  <Link href={item.href} className={styles["shop-footer-footer__link"]}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className={styles["shop-footer-footer__column-title"]}>
              Đăng ký nhận tin
            </h4>
            <p className={styles["shop-footer-footer__newsletter-text"]}>
              Nhận thông tin sớm về ưu đãi đặc quyền, sự kiện trải nghiệm và cấu hình
              Hi-end mới nhất từ {brandName}.
            </p>
            <form onSubmit={handleNewsletterSubmit} noValidate>
              <input
                type="email"
                placeholder="Email của bạn"
                className={clsx(
                  styles["shop-footer-footer__input"],
                  hasNewsletterError && styles["shop-footer-footer__input--error"],
                )}
                value={newsletterEmail}
                onChange={(event) => {
                  setNewsletterEmail(event.target.value);
                  if (hasNewsletterError) {
                    setHasNewsletterError(false);
                    setNewsletterErrorMessage(null);
                  }
                }}
                aria-invalid={hasNewsletterError}
                aria-describedby={hasNewsletterError ? "shop-footer-newsletter-error" : undefined}
              />
              {hasNewsletterError && newsletterErrorMessage && (
                <span
                  id="shop-footer-newsletter-error"
                  className={styles["shop-footer-footer__input-error"]}
                  role="alert"
                >
                  {newsletterErrorMessage}
                </span>
              )}
              <button
                type="submit"
                className={styles["shop-footer-footer__button"]}
                disabled={isSubmittingNewsletter}
              >
                {isSubmittingNewsletter ? "Đang đăng ký..." : "Đăng ký ngay"}
              </button>
            </form>
          </div>
        </div>

        <div className={styles["shop-footer-footer__bottom"]}>
          <p>
            © {displayYear} {brandName}. Bảo lưu mọi quyền.
          </p>
          <div className={styles["shop-footer-footer__bottom-links"]}>
            <Link href="/support?policy=terms" className={styles["shop-footer-footer__link"]}>
              Điều khoản sử dụng
            </Link>
            <Link href="/support" className={styles["shop-footer-footer__link"]}>
              Chính sách bảo mật
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default ShopFooter;

