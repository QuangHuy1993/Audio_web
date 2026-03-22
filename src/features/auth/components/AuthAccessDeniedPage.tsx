"use client";

import React from "react";
import Link from "next/link";
import { MdHomeFilled, MdGraphicEq } from "react-icons/md";
import styles from "./AuthAccessDeniedPage.module.css";

export const AuthAccessDeniedPage: React.FC = () => {
  return (
    <div className={styles["auth-access-denied-page-page"]}>
      <header className={styles["auth-access-denied-page-page__header"]}>
        <div className={styles["auth-access-denied-page-page__header-inner"]}>
          <div className={styles["auth-access-denied-page-page__logo"]}>
            <MdGraphicEq aria-hidden="true" />
          </div>
          <span className={styles["auth-access-denied-page-page__brand"]}>
            Đức Uy Audio
          </span>
        </div>
      </header>

      <main className={styles["auth-access-denied-page-page__main"]}>
        <div className={styles["auth-access-denied-page-page__code-wrapper"]}>
          <h1 className={styles["auth-access-denied-page-page__code"]}>
            403
          </h1>

          <div className={styles["auth-access-denied-page-page__wave-container"]}>
            <svg
              className={styles["auth-access-denied-page-page__wave-svg"]}
              viewBox="0 0 400 200"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                className={
                  styles["auth-access-denied-page-page__wave-path--muted"]
                }
                d="M 50 100 Q 75 40 100 100 T 150 100"
                fill="none"
                stroke="#FFD700"
                strokeWidth="3"
              />
              <path
                d="M 180 100 Q 200 160 220 100 T 260 100"
                fill="none"
                stroke="#FFD700"
                strokeWidth="3"
              />
              <path
                d="M 80 120 Q 110 180 140 120 T 200 120"
                fill="none"
                stroke="#1DB954"
                strokeWidth="3"
              />
              <path
                className={
                  styles["auth-access-denied-page-page__wave-path--muted"]
                }
                d="M 230 80 Q 260 20 290 80 T 350 80"
                fill="none"
                stroke="#1DB954"
                strokeWidth="3"
              />
              <circle cx="165" cy="100" r="3" fill="#FFD700" opacity="0.5" />
              <circle cx="215" cy="120" r="3" fill="#1DB954" opacity="0.5" />
              <line
                x1="100"
                y1="140"
                x2="300"
                y2="60"
                stroke="#191414"
                strokeWidth="8"
              />
            </svg>

            <span className={styles["auth-access-denied-page-page__wave-icon"]}>
              {/* Using block icon to represent access denied */}
              !
            </span>
          </div>
        </div>

        <section aria-labelledby="access-denied-title">
          <h2
            id="access-denied-title"
            className={styles["auth-access-denied-page-page__title"]}
          >
            Access Denied
          </h2>
          <p className={styles["auth-access-denied-page-page__description"]}>
            Bạn không có quyền truy cập vào khu vực này. Vui lòng liên hệ quản trị
            viên hoặc quay lại trang chính để tiếp tục trải nghiệm âm thanh.
          </p>
        </section>

        <div className={styles["auth-access-denied-page-page__actions"]}>
          <Link
            href="/"
            className={styles["auth-access-denied-page-page__back-link"]}
          >
            <span className={styles["auth-access-denied-page-page__back-icon"]}>
              <MdHomeFilled aria-hidden="true" />
            </span>
            <span>Quay về trang chủ</span>
          </Link>
        </div>
      </main>

      <div className={styles["auth-access-denied-page-page__ambient"]}>
        <div
          className={styles["auth-access-denied-page-page__ambient-primary"]}
        />
        <div
          className={styles["auth-access-denied-page-page__ambient-secondary"]}
        />
      </div>

      <footer className={styles["auth-access-denied-page-page__footer"]}>
        Error Code: 403 Forbidden
      </footer>
    </div>
  );
};

export default AuthAccessDeniedPage;

