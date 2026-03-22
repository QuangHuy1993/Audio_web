import Link from "next/link";
import { MdHome, MdContactSupport } from "react-icons/md";
import styles from "./not-found.module.css";

const HELP_URL = "/support";

const soundwaveBars = [
  { heightClass: styles["not-found-page__bar--h-32"], colorClass: styles["not-found-page__bar--primary"], delay: "0.1s" },
  { heightClass: styles["not-found-page__bar--h-48"], colorClass: styles["not-found-page__bar--gold"], delay: "0.2s" },
  { heightClass: styles["not-found-page__bar--h-24"], colorClass: styles["not-found-page__bar--primary"], delay: "0.3s" },
  { heightClass: styles["not-found-page__bar--h-56"], colorClass: styles["not-found-page__bar--gold"], delay: "0.4s" },
  { heightClass: styles["not-found-page__bar--h-40"], colorClass: styles["not-found-page__bar--primary"], delay: "0.5s" },
  { heightClass: styles["not-found-page__bar--h-64"], colorClass: styles["not-found-page__bar--primary"], delay: "0.6s" },
  { heightClass: styles["not-found-page__bar--h-40"], colorClass: styles["not-found-page__bar--gold"], delay: "0.7s" },
  { heightClass: styles["not-found-page__bar--h-56"], colorClass: styles["not-found-page__bar--primary"], delay: "0.8s" },
  { heightClass: styles["not-found-page__bar--h-24"], colorClass: styles["not-found-page__bar--gold"], delay: "0.9s" },
  { heightClass: styles["not-found-page__bar--h-48"], colorClass: styles["not-found-page__bar--primary"], delay: "1.0s" },
];

export default function NotFound() {
  return (
    <div className={styles["not-found-page"]}>
      <div className={styles["not-found-page__background"]}>
        <div className={styles["not-found-page__soundwave"]}>
          {soundwaveBars.map((bar, index) => (
            <div
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              className={`${styles["not-found-page__bar"]} ${bar.heightClass} ${bar.colorClass}`}
              style={{ animationDelay: bar.delay }}
            />
          ))}
        </div>
      </div>

      <main className={styles["not-found-page__content"]}>
        <div className={styles["not-found-page__hero"]}>
          <div className={styles["not-found-page__record-wrapper"]}>
            <div className={styles["not-found-page__record"]}>
              <div
                className={`${styles["not-found-page__record-ring"]} ${styles["not-found-page__record-ring--inner"]}`}
              />
              <div
                className={`${styles["not-found-page__record-ring"]} ${styles["not-found-page__record-ring--middle"]}`}
              />
              <div
                className={`${styles["not-found-page__record-ring"]} ${styles["not-found-page__record-ring--outer"]}`}
              />
              <div className={styles["not-found-page__code"]}>
                <span>404</span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h1 className={styles["not-found-page__title"]}>
            Âm thanh bị{" "}
            <span className={styles["not-found-page__highlight"]}>
              gián đoạn
            </span>
          </h1>
          <p className={styles["not-found-page__description"]}>
            Rất tiếc, trang bạn tìm kiếm không tồn tại hoặc đã được di
            chuyển. Hãy để chúng tôi dẫn lối bạn về không gian âm nhạc đích
            thực.
          </p>

          <div className={styles["not-found-page__actions"]}>
            <Link
              href="/"
              className={`${styles["not-found-page__button"]} ${styles["not-found-page__button--primary"]}`}
            >
              <span
                className={styles["not-found-page__icon"]}
                aria-hidden="true"
              >
                <MdHome />
              </span>
              Quay về Trang chủ
            </Link>

            <Link
              href={HELP_URL}
              className={`${styles["not-found-page__button"]} ${styles["not-found-page__button--secondary"]}`}
            >
              <span
                className={styles["not-found-page__icon"]}
                aria-hidden="true"
              >
                <MdContactSupport />
              </span>
              Trợ giúp
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

