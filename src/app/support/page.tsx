"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import clsx from "clsx";
import {
  MdSupportAgent,
  MdSmartToy,
  MdSearch,
  MdHelp,
  MdVerifiedUser,
  MdPayments,
  MdSell,
  MdSettingsSuggest,
  MdContactSupport,
  MdExpandMore,
  MdArrowForward,
  MdCall,
  MdMail,
  MdChat,
  MdSchedule,
  MdClose,
  MdChecklist,
  MdCheckCircle,
  MdWarning,
  MdCancel,
} from "react-icons/md";
import ShopHeader from "@/components/layout/ShopHeader";
import ShopFooter from "@/components/layout/ShopFooter";
import PageTransitionOverlay from "@/components/shared/PageTransitionOverlay";
import AiChatPanel from "@/features/shop/components/ai-chat/AiChatPanel";
import styles from "./page.module.css";

const supportRequestSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Họ và tên cần ít nhất 2 ký tự.")
    .max(120, "Họ và tên không quá 120 ký tự."),
  email: z
    .string()
    .trim()
    .min(1, "Email là bắt buộc.")
    .email("Email không hợp lệ."),
  phone: z
    .string()
    .trim()
    .min(1, "Số điện thoại là bắt buộc.")
    .regex(/^(0[0-9]{9}|\+84[0-9]{9})$/, "Số điện thoại không hợp lệ (VD: 0912345678 hoặc +84912345678)."),
  topic: z
    .string()
    .min(1, "Vui lòng chọn vấn đề cần hỗ trợ.")
    .refine(
      (v) => ["device-error", "upgrade-consult", "order-status", "other"].includes(v),
      "Vui lòng chọn vấn đề cần hỗ trợ.",
    ),
  message: z
    .string()
    .trim()
    .min(10, "Mô tả cần ít nhất 10 ký tự.")
    .max(2000, "Mô tả không quá 2000 ký tự."),
});

type SupportRequestFormValues = z.infer<typeof supportRequestSchema>;

type FaqItem = {
  question: string;
  answer: string;
};

type FaqCategory = {
  id: string;
  title: string;
  items: FaqItem[];
};

const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: "orders-payments",
    title: "Đơn hàng & thanh toán",
    items: [
      {
        question: "Làm sao để đặt hàng tại Đức Uy Audio?",
        answer:
          "Bạn có thể đặt hàng trực tiếp trên website bằng cách thêm sản phẩm vào giỏ, điền thông tin giao hàng và chọn phương thức thanh toán phù hợp. Đội ngũ Đức Uy sẽ liên hệ xác nhận đơn hàng trước khi tiến hành giao.",
      },
      {
        question: "Tôi có thể thanh toán qua những hình thức nào?",
        answer:
          "Chúng tôi hỗ trợ thanh toán chuyển khoản ngân hàng, quẹt thẻ tại showroom, COD (thanh toán khi nhận hàng) tại một số khu vực, và các cổng thanh toán trực tuyến đang được tích hợp dần.",
      },
      {
        question: "Làm sao kiểm tra trạng thái đơn hàng?",
        answer:
          "Sau khi đặt hàng, bạn sẽ nhận được mã đơn hàng qua email hoặc SMS. Bạn có thể dùng mã này để tra cứu trong khu vực tài khoản hoặc liên hệ trực tiếp hotline để được hỗ trợ.",
      },
      {
        question: "Tôi có thể hủy đơn sau khi đã đặt không?",
        answer:
          "Bạn có thể yêu cầu hủy đơn trước khi đơn được bàn giao cho đơn vị vận chuyển. Vui lòng liên hệ hotline hoặc Zalo của Đức Uy để được kiểm tra và hỗ trợ nhanh nhất.",
      },
    ],
  },
  {
    id: "shipping-installation",
    title: "Giao hàng & lắp đặt",
    items: [
      {
        question: "Thời gian giao hàng dự kiến là bao lâu?",
        answer:
          "Khu vực nội thành thường nhận hàng trong 2–4 giờ làm việc. Các tỉnh thành khác thời gian giao hàng dao động từ 2–3 ngày tùy đơn vị vận chuyển và địa chỉ nhận.",
      },
      {
        question: "Đức Uy có hỗ trợ lắp đặt tại nhà không?",
        answer:
          "Với các cấu hình dàn máy vừa và lớn, Đức Uy hỗ trợ lắp đặt, căn chỉnh cơ bản tại nhà theo lịch hẹn. Một số khu vực xa có thể phát sinh phụ phí di chuyển, sẽ được thông báo trước.",
      },
      {
        question: "Phí vận chuyển được tính như thế nào?",
        answer:
          "Phí vận chuyển phụ thuộc vào kích thước, khối lượng thiết bị và địa chỉ nhận hàng. Nhiều khu vực nội thành được hỗ trợ miễn phí hoặc ưu đãi theo chương trình khuyến mãi từng thời điểm.",
      },
    ],
  },
  {
    id: "warranty-returns",
    title: "Bảo hành & đổi trả",
    items: [
      {
        question: "Thời gian bảo hành cho sản phẩm là bao lâu?",
        answer:
          "Hầu hết sản phẩm tại Đức Uy Audio được bảo hành chính hãng từ 12–24 tháng tùy thương hiệu và dòng sản phẩm. Thông tin chi tiết được ghi rõ trên phiếu bảo hành và trong mô tả sản phẩm.",
      },
      {
        question: "Tôi cần làm gì khi sản phẩm gặp sự cố?",
        answer:
          "Vui lòng ghi lại hiện tượng lỗi, chụp hình hoặc quay video nếu có thể, sau đó liên hệ hotline hoặc email hỗ trợ. Đức Uy sẽ hướng dẫn bạn kiểm tra nhanh tại chỗ hoặc tiếp nhận sản phẩm để kiểm tra chuyên sâu.",
      },
      {
        question: "Điều kiện đổi trả sản phẩm là gì?",
        answer:
          "Đức Uy hỗ trợ đổi trả trong một số trường hợp cụ thể, ví dụ sản phẩm lỗi kỹ thuật từ nhà sản xuất hoặc giao nhầm model. Chi tiết điều kiện và quy trình vui lòng tham khảo mục Chính sách Đổi trả.",
      },
    ],
  },
  {
    id: "coupons-promotions",
    title: "Mã giảm giá & khuyến mãi",
    items: [
      {
        question: "Cách nhập mã giảm giá khi thanh toán?",
        answer:
          "Tại bước thanh toán, bạn nhập mã vào ô Mã giảm giá và nhấn Áp dụng. Hệ thống sẽ kiểm tra điều kiện áp dụng và hiển thị mức ưu đãi tương ứng nếu mã hợp lệ.",
      },
      {
        question: "Tại sao mã giảm giá của tôi không áp dụng được?",
        answer:
          "Một số nguyên nhân thường gặp: mã đã hết hạn, không áp dụng cho sản phẩm trong giỏ, đơn hàng chưa đạt giá trị tối thiểu hoặc mã đã được sử dụng trước đó. Bạn có thể kiểm tra lại điều kiện hoặc liên hệ để được hỗ trợ.",
      },
      {
        question: "Mã giảm giá có thể áp dụng nhiều lần không?",
        answer:
          "Tùy chương trình, mã có thể chỉ dùng một lần cho mỗi tài khoản hoặc cho phép dùng nhiều lần trong thời gian khuyến mãi. Thông tin này sẽ được ghi rõ trong chi tiết chương trình.",
      },
    ],
  },
  {
    id: "audio-setup",
    title: "Tư vấn âm thanh & setup phòng",
    items: [
      {
        question: "Tôi nên chọn loa loại nào cho phòng 20m²?",
        answer:
          "Với phòng khoảng 20m², các dòng loa bookshelf chất lượng hoặc loa cột kích thước vừa là lựa chọn hợp lý. Nên ưu tiên model có độ nhạy tốt, phối ghép cùng ampli phù hợp để tránh dư công suất.",
      },
      {
        question: "Khác biệt giữa loa bookshelf và loa floorstanding là gì?",
        answer:
          "Loa bookshelf có kích thước nhỏ gọn, phù hợp phòng vừa và nhỏ, trong khi loa floorstanding (loa cột) có thùng lớn hơn, dải trầm sâu hơn và phù hợp với không gian rộng hoặc nhu cầu nghe lớn.",
      },
      {
        question: "Có cần xử lý âm học phòng nghe không?",
        answer:
          "Xử lý âm học giúp giảm dội âm, cộng hưởng và méo tiếng, đặc biệt với phòng nghe chuyên dụng. Tùy ngân sách và không gian, bạn có thể bắt đầu từ các giải pháp đơn giản như thảm, rèm, tủ sách trước khi dùng panel chuyên dụng.",
      },
    ],
  },
];

const SUPPORT_RESOURCES = [
  {
    category: "Hướng dẫn",
    title: "Cách chọn loa cho phòng diện tích dưới 20m²",
    description:
      "Việc lựa chọn loa có kích thước và công suất phù hợp với diện tích phòng là yếu tố quan trọng nhất để có âm thanh cân bằng.",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCjMiGiP-vMsLNeUQh4LGZRcYjpKk_jdlvrYhvd3xI7ia6QLhC9n-mQFcalOYm72UG060IFeH3juXrZjW7tpTL11POr7EUhZOE_6XEGDypyA8YhJOa-Is2ORg19NFPBljG3lrg4dhhF2DNpWV6D7NMXfPZff5tdZnaWYaHambMAaODE2xMi0Wj50vXTl_T_fFj6UipAYXEw_2BkT9qGfN932h4bBDgWrnTBv5ebyIxRJg6KTQOBHpwAUEBskTtw0s1DSVFz_dLhEV7c",
  },
  {
    category: "Kỹ thuật",
    title: "Tại sao ampli đèn được giới Audiophile ưa chuộng?",
    description:
      "Khám phá chất âm ấm áp, giàu nhạc tính và cảm giác trình diễn đặc trưng của ampli đèn trong hệ thống Hi-end.",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBJvSK9KsJZ263LCyjPea6hC-0VjTL29V9fA7CNjEq1Z8_jo3clARt2-3fltuoXmQFiuj31wMpdYcipUNXJ-WAMa3OqSySFyMxQ74E6zFxC0whCJSHcccZMGCyaCO1uynDML3wK7-pqPtdqncCRky7olz2EvP0xnUKeJBOmqikRWfUJSzEMZsdspfDrQz6s3iaAizAJJxgiQtTcPboIJ_0OLfc2oMPfkJ0jt9TUMq6lDpUzERudfpPGN8bUAmLj1h3wjQ0hKIwz53yc",
  },
  {
    category: "Mẹo vặt",
    title: "Cách vệ sinh màng loa cao cấp không gây hư hại",
    description:
      "Một vài bước vệ sinh đơn giản giúp giữ loa luôn sạch đẹp mà vẫn đảm bảo độ bền của driver và màng loa.",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuD2FxXMaExS4YsAoSXKKRo8eXkyCDwGVDMwyd6PxMr_OoWIwx-6zxe6IAh8AJ4rVMgsSsY9NXYnUXH9YQ_pyuhHpOfu_nYOV-Ux1clfGvh5xJ69zI14PYi8_7ISRJSpDE0nwpD8FzbdrRSf-nLEXZbd7Gn4ohfn90w11kUkzq78sBBh3OUAW-4Fq0aOL_ZzYX0eV6JFDL5EzIuLeE-6oM40MVFBGiz9MT4bGaC5cEcvS4SEc01ijxsFxRQ7dQWqfl6cjw4S6VHmqP6N",
  },
];

function SupportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isTransitionActive, setIsTransitionActive] = useState(true);
  const [faqSearch, setFaqSearch] = useState("");
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(
    null,
  );
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [isWarrantyModalOpen, setIsWarrantyModalOpen] = useState(false);
  const [isReturnsModalOpen, setIsReturnsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [isTechSupportModalOpen, setIsTechSupportModalOpen] = useState(false);

  const {
    register: registerSupportForm,
    handleSubmit: handleSupportSubmit,
    reset: resetSupportForm,
    formState: { errors: supportFormErrors, isSubmitting: isSupportSubmitting },
  } = useForm<SupportRequestFormValues>({
    resolver: zodResolver(supportRequestSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      topic: "",
      message: "",
    },
  });

  const onSupportRequestSubmit = async (values: SupportRequestFormValues) => {
    try {
      const res = await fetch("/api/shop/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const errorJson = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(errorJson?.error ?? "Gửi yêu cầu thất bại.");
      }

      resetSupportForm();
      toast.success("Yêu cầu hỗ trợ đã được gửi. Chúng tôi sẽ liên hệ bạn sớm nhất.");
    } catch (error: any) {
      toast.error(error.message ?? "Gửi yêu cầu thất bại. Vui lòng thử lại sau.");
    }
  };

  const handleToggleCategory = (categoryId: string) => {
    setExpandedCategoryId((current) =>
      current === categoryId ? null : categoryId,
    );
    setExpandedQuestion(null);
  };

  const handleToggleQuestion = (question: string) => {
    setExpandedQuestion((current) => (current === question ? null : question));
  };

  const scrollToFaq = () => {
    document.getElementById("support-faq")?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToContact = () => {
    document.getElementById("support-contact")?.scrollIntoView({ behavior: "smooth" });
  };

  const normalizedSearch = faqSearch.trim().toLowerCase();

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setIsTransitionActive(false);
    }, 1100);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    const policy = searchParams.get("policy");

    setIsWarrantyModalOpen(policy === "warranty");
    setIsReturnsModalOpen(policy === "returns");
    setIsPaymentModalOpen(policy === "payment");
    setIsTermsModalOpen(policy === "terms");
    setIsPromoModalOpen(false);
    setIsTechSupportModalOpen(false);
  }, [searchParams]);

  return (
    <div className={`app-homepage-bg ${styles["support-page-page"]}`}>
      <PageTransitionOverlay
        isActive={isTransitionActive}
        subtitle="Đang chuẩn bị trung tâm Hỗ trợ dành riêng cho bạn..."
        bottomText="Đức Uy Audio đang kết nối trợ lý AI và đội ngũ chăm sóc khách hàng..."
      />
      <ShopHeader />

      <main className={styles["support-page-page__main"]}>
        {/* Hero */}
        <section className={styles["support-page-page__hero"]}>
          <div className={styles["support-page-page__hero-inner"]}>
            <div className={styles["support-page-page__hero-content"]}>
              <div className={styles["support-page-page__hero-badge"]}>
                <span
                  className={styles["support-page-page__hero-badge-icon"]}
                  aria-hidden="true"
                >
                  <MdSupportAgent />
                </span>
                CHĂM SÓC KHÁCH HÀNG TẬN TÂM
              </div>
              <h1 className={styles["support-page-page__hero-title"]}>
                Trung tâm Hỗ trợ{" "}
                <span className={styles["support-page-page__hero-title-highlight"]}>
                  Đức Uy Audio
                </span>
              </h1>
              <p className={styles["support-page-page__hero-description"]}>
                Mọi thắc mắc về kỹ thuật, chính sách bảo hành và hướng dẫn sử dụng
                thiết bị Hi-end của bạn đều được đội ngũ Đức Uy giải đáp nhanh
                chóng.
              </p>
              <form
                className={styles["support-page-page__hero-search"]}
                onSubmit={(event) => {
                  event.preventDefault();
                }}
              >
                <div className={styles["support-page-page__hero-search-inner"]}>
                  <span
                    className={styles["support-page-page__hero-search-icon"]}
                    aria-hidden="true"
                  >
                    <MdSearch />
                  </span>
                  <input
                    type="search"
                    className={styles["support-page-page__hero-search-input"]}
                    placeholder="Bạn cần hỗ trợ về vấn đề gì?"
                    aria-label="Nhập nội dung cần hỗ trợ"
                  />
                  <button
                    type="submit"
                    className={styles["support-page-page__hero-search-button"]}
                  >
                    Tìm kiếm
                  </button>
                </div>
                <div className={styles["support-page-page__hero-search-suggestions"]}>
                  <span className={styles["support-page-page__hero-search-label"]}>
                    Gợi ý:
                  </span>
                  <button
                    type="button"
                    className={styles["support-page-page__hero-search-suggestion"]}
                  >
                    Cài đặt DAC
                  </button>
                  <button
                    type="button"
                    className={styles["support-page-page__hero-search-suggestion"]}
                  >
                    Bảo hành loa Marshall
                  </button>
                  <button
                    type="button"
                    className={styles["support-page-page__hero-search-suggestion"]}
                  >
                    Nâng cấp firmware
                  </button>
                </div>
              </form>
              <div className={styles["support-page-page__hero-actions"]}>
                <button
                  type="button"
                  className={styles["support-page-page__hero-button-primary"]}
                  onClick={() => router.push("/tu-van-ai")}
                >
                  <span
                    className={
                      styles["support-page-page__hero-button-primary-icon"]
                    }
                    aria-hidden="true"
                  >
                    <MdSmartToy />
                  </span>
                  Nhờ AI hỗ trợ ngay
                </button>
                <button
                  type="button"
                  className={styles["support-page-page__hero-button-secondary"]}
                >
                  Liên hệ trực tiếp
                </button>
              </div>
            </div>

            <div className={styles["support-page-page__hero-visual"]}>
              <div
                className={styles["support-page-page__hero-visual-glow"]}
                aria-hidden="true"
              />
              <div className={styles["support-page-page__hero-visual-card"]}>
                <div className={styles["support-page-page__hero-visual-image"]} />
              </div>
            </div>
          </div>
        </section>

        {/* Quick actions */}
        <section
          className={styles["support-page-page__quick-actions"]}
          aria-label="Lối tắt hỗ trợ"
        >
          <div className={styles["support-page-page__quick-grid"]}>
            <button
              type="button"
              className={styles["support-page-page__quick-item"]}
              onClick={scrollToFaq}
            >
              <span
                className={styles["support-page-page__quick-item-icon"]}
                aria-hidden="true"
              >
                <MdHelp />
              </span>
              <span className={styles["support-page-page__quick-item-label"]}>
                Câu hỏi FAQ
              </span>
            </button>

            <button
              type="button"
              className={styles["support-page-page__quick-item"]}
              onClick={() => setIsWarrantyModalOpen(true)}
            >
              <span
                className={styles["support-page-page__quick-item-icon"]}
                aria-hidden="true"
              >
                <MdVerifiedUser />
              </span>
              <span className={styles["support-page-page__quick-item-label"]}>
                Bảo hành
              </span>
            </button>

            <button
              type="button"
              className={styles["support-page-page__quick-item"]}
              onClick={() => setIsPaymentModalOpen(true)}
            >
              <span
                className={styles["support-page-page__quick-item-icon"]}
                aria-hidden="true"
              >
                <MdPayments />
              </span>
              <span className={styles["support-page-page__quick-item-label"]}>
                Thanh toán
              </span>
            </button>

            <button
              type="button"
              className={styles["support-page-page__quick-item"]}
              onClick={() => setIsPromoModalOpen(true)}
            >
              <span
                className={styles["support-page-page__quick-item-icon"]}
                aria-hidden="true"
              >
                <MdSell />
              </span>
              <span className={styles["support-page-page__quick-item-label"]}>
                Khuyến mãi
              </span>
            </button>

            <button
              type="button"
              className={styles["support-page-page__quick-item"]}
              onClick={() => setIsTechSupportModalOpen(true)}
            >
              <span
                className={styles["support-page-page__quick-item-icon"]}
                aria-hidden="true"
              >
                <MdSettingsSuggest />
              </span>
              <span className={styles["support-page-page__quick-item-label"]}>
                Hỗ trợ kỹ thuật
              </span>
            </button>

            <button
              type="button"
              className={styles["support-page-page__quick-item"]}
              onClick={scrollToContact}
            >
              <span
                className={styles["support-page-page__quick-item-icon"]}
                aria-hidden="true"
              >
                <MdContactSupport />
              </span>
              <span className={styles["support-page-page__quick-item-label"]}>
                Liên hệ
              </span>
            </button>
          </div>
        </section>

        {/* AI assistant */}
        <section className={styles["support-page-page__ai-section"]}>
          <div className={styles["support-page-page__ai-card"]}>
            <div className={styles["support-page-page__ai-header"]}>
              <h2 className={styles["support-page-page__ai-title"]}>
                Trợ lý AI Đức Uy
              </h2>
              <p className={styles["support-page-page__ai-description"]}>
                Tư vấn âm thanh 24/7 – từ bảo hành, setup phòng nghe đến lựa chọn thiết bị phù hợp.
              </p>
            </div>
            <div className={styles["support-page-page__ai-panel-wrap"]}>
              <AiChatPanel
                sessionKey="general"
                suggestions={[
                  "Chính sách bảo hành thiết bị",
                  "Hướng dẫn kết nối bluetooth",
                  "Gợi ý bộ setup phòng nghe",
                  "Tư vấn theo ngân sách",
                ]}
                compact
              />
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section
          id="support-faq"
          className={styles["support-page-page__faq-section"]}
        >
          <div className={styles["support-page-page__faq-header"]}>
            <h2 className={styles["support-page-page__faq-title"]}>
              Câu hỏi thường gặp
            </h2>
            <div className={styles["support-page-page__faq-search-wrapper"]}>
              <input
                type="search"
                value={faqSearch}
                onChange={(event) => setFaqSearch(event.target.value)}
                placeholder="Tìm trong trợ giúp..."
                className={styles["support-page-page__faq-search-input"]}
                aria-label="Tìm kiếm trong câu hỏi thường gặp"
              />
              <span
                className={styles["support-page-page__faq-search-icon"]}
                aria-hidden="true"
              >
                <MdSearch />
              </span>
            </div>
          </div>

          <div className={styles["support-page-page__faq-grid"]}>
            {FAQ_CATEGORIES.map((category) => {
              const isCategoryExpanded = expandedCategoryId === category.id;

              const visibleItems = category.items.filter((item) => {
                if (!normalizedSearch) return true;
                const combined = `${item.question} ${item.answer}`.toLowerCase();
                return combined.includes(normalizedSearch);
              });

              if (!visibleItems.length) {
                return null;
              }

              return (
                <div
                  key={category.id}
                  className={styles["support-page-page__faq-category"]}
                >
                  <button
                    type="button"
                    className={styles["support-page-page__faq-category-header"]}
                    onClick={() => handleToggleCategory(category.id)}
                    aria-expanded={isCategoryExpanded}
                  >
                    <span
                      className={
                        styles["support-page-page__faq-category-title"]
                      }
                    >
                      {category.title}
                    </span>
                    <span
                      className={
                        styles["support-page-page__faq-category-icon-wrapper"]
                      }
                      aria-hidden="true"
                    >
                      <MdExpandMore
                        className={
                          isCategoryExpanded
                            ? styles[
                                "support-page-page__faq-category-icon--expanded"
                              ]
                            : styles["support-page-page__faq-category-icon"]
                        }
                      />
                    </span>
                  </button>

                  {isCategoryExpanded && (
                    <div
                      className={styles["support-page-page__faq-category-body"]}
                    >
                      {visibleItems.map((item) => {
                        const isQuestionExpanded =
                          expandedQuestion === item.question;

                        return (
                          <div
                            key={item.question}
                            className={styles["support-page-page__faq-item"]}
                          >
                            <button
                              type="button"
                              className={
                                styles["support-page-page__faq-item-header"]
                              }
                              onClick={() => handleToggleQuestion(item.question)}
                              aria-expanded={isQuestionExpanded}
                            >
                              <span
                                className={
                                  styles["support-page-page__faq-item-question"]
                                }
                              >
                                {item.question}
                              </span>
                              <MdExpandMore
                                className={
                                  isQuestionExpanded
                                    ? styles[
                                        "support-page-page__faq-item-icon--expanded"
                                      ]
                                    : styles[
                                        "support-page-page__faq-item-icon"
                                      ]
                                }
                                aria-hidden="true"
                              />
                            </button>
                            {isQuestionExpanded && (
                              <div
                                className={
                                  styles["support-page-page__faq-item-answer"]
                                }
                              >
                                {item.answer}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Policies and contact */}
        <section
          id="support-contact"
          className={styles["support-page-page__policy-contact-section"]}
        >
          <div className={styles["support-page-page__policies-grid"]}>
            <article className={styles["support-page-page__policy-card"]}>
              <div className={styles["support-page-page__policy-icon-wrapper"]}>
                <MdVerifiedUser
                  className={styles["support-page-page__policy-icon"]}
                  aria-hidden="true"
                />
              </div>
              <h3 className={styles["support-page-page__policy-title"]}>
                Chính sách bảo hành
              </h3>
              <p className={styles["support-page-page__policy-description"]}>
                Chi tiết về điều kiện, thời hạn và quy trình tiếp nhận bảo hành
                thiết bị tại hệ thống Đức Uy Audio.
              </p>
              <button
                type="button"
                className={styles["support-page-page__policy-link"]}
                onClick={() => setIsWarrantyModalOpen(true)}
              >
                Xem chi tiết
                <MdArrowForward
                  className={styles["support-page-page__policy-link-icon"]}
                  aria-hidden="true"
                />
              </button>
            </article>

            <article className={styles["support-page-page__policy-card"]}>
              <div className={styles["support-page-page__policy-icon-wrapper"]}>
                <MdSell
                  className={styles["support-page-page__policy-icon"]}
                  aria-hidden="true"
                />
              </div>
              <h3 className={styles["support-page-page__policy-title"]}>
                Chính sách đổi trả
              </h3>
              <p className={styles["support-page-page__policy-description"]}>
                Quy trình đổi mới sản phẩm và hoàn tiền khi sản phẩm gặp sự cố
                hoặc trải nghiệm chưa như mong đợi.
              </p>
              <button
                type="button"
                className={styles["support-page-page__policy-link"]}
                onClick={() => setIsReturnsModalOpen(true)}
              >
                Xem chi tiết
                <MdArrowForward
                  className={styles["support-page-page__policy-link-icon"]}
                  aria-hidden="true"
                />
              </button>
            </article>

            <article className={styles["support-page-page__policy-card"]}>
              <div className={styles["support-page-page__policy-icon-wrapper"]}>
                <MdSettingsSuggest
                  className={styles["support-page-page__policy-icon"]}
                  aria-hidden="true"
                />
              </div>
              <h3 className={styles["support-page-page__policy-title"]}>
                Điều khoản dịch vụ
              </h3>
              <p className={styles["support-page-page__policy-description"]}>
                Các quy định chung khi sử dụng dịch vụ và mua hàng tại hệ thống
                Đức Uy Audio.
              </p>
              <button
                type="button"
                className={styles["support-page-page__policy-link"]}
                onClick={() => setIsTermsModalOpen(true)}
              >
                Xem chi tiết
                <MdArrowForward
                  className={styles["support-page-page__policy-link-icon"]}
                  aria-hidden="true"
                />
              </button>
            </article>
          </div>

          <div className={styles["support-page-page__contact-grid"]}>
            <div className={styles["support-page-page__contact-info"]}>
              <h2 className={styles["support-page-page__contact-title"]}>
                Liên hệ trực tiếp
              </h2>
              <div className={styles["support-page-page__contact-list"]}>
                <div className={styles["support-page-page__contact-item"]}>
                  <div
                    className={
                      styles["support-page-page__contact-item-icon-wrapper"]
                    }
                    aria-hidden="true"
                  >
                    <MdCall />
                  </div>
                  <div>
                    <p className={styles["support-page-page__contact-label"]}>
                      Hotline 24/7
                    </p>
                    <p className={styles["support-page-page__contact-value"]}>
                      1900 88 99 00
                    </p>
                  </div>
                </div>

                <div className={styles["support-page-page__contact-item"]}>
                  <div
                    className={
                      styles["support-page-page__contact-item-icon-wrapper"]
                    }
                    aria-hidden="true"
                  >
                    <MdMail />
                  </div>
                  <div>
                    <p className={styles["support-page-page__contact-label"]}>
                      Email hỗ trợ
                    </p>
                    <p className={styles["support-page-page__contact-value"]}>
                      support@ducuyaudio.vn
                    </p>
                  </div>
                </div>

                <div className={styles["support-page-page__contact-item"]}>
                  <div
                    className={
                      styles["support-page-page__contact-item-icon-wrapper"]
                    }
                    aria-hidden="true"
                  >
                    <MdChat />
                  </div>
                  <div>
                    <p className={styles["support-page-page__contact-label"]}>
                      Zalo Official Account
                    </p>
                    <p className={styles["support-page-page__contact-value"]}>
                      Đức Uy Audio (OA)
                    </p>
                  </div>
                </div>

                <div className={styles["support-page-page__contact-working"]}>
                  <div
                    className={
                      styles["support-page-page__contact-working-inner"]
                    }
                  >
                    <span
                      className={
                        styles["support-page-page__contact-working-icon"]
                      }
                      aria-hidden="true"
                    >
                      <MdSchedule />
                    </span>
                    <span className={styles["support-page-page__contact-working-text"]}>
                      Giờ làm việc:{" "}
                      <strong>08:00 - 21:00 (Thứ 2 - Chủ nhật)</strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles["support-page-page__contact-form-card"]}>
              <h3 className={styles["support-page-page__contact-form-title"]}>
                Gửi yêu cầu hỗ trợ
              </h3>
              <form
                className={styles["support-page-page__contact-form"]}
                onSubmit={handleSupportSubmit(onSupportRequestSubmit, () => {
                  toast.error("Vui lòng kiểm tra lại thông tin.");
                })}
                noValidate
              >
                <div className={styles["support-page-page__contact-form-row"]}>
                  <div>
                    <input
                      type="text"
                      className={clsx(
                        styles["support-page-page__contact-input"],
                        supportFormErrors.fullName && styles["support-page-page__contact-input--error"],
                      )}
                      placeholder="Họ và tên"
                      aria-invalid={!!supportFormErrors.fullName}
                      aria-describedby={supportFormErrors.fullName ? "support-fullName-error" : undefined}
                      {...registerSupportForm("fullName")}
                    />
                    {supportFormErrors.fullName && (
                      <span id="support-fullName-error" className={styles["support-page-page__contact-error"]} role="alert">
                        {supportFormErrors.fullName.message}
                      </span>
                    )}
                  </div>
                  <div>
                    <input
                      type="email"
                      className={clsx(
                        styles["support-page-page__contact-input"],
                        supportFormErrors.email && styles["support-page-page__contact-input--error"],
                      )}
                      placeholder="Email của bạn"
                      aria-invalid={!!supportFormErrors.email}
                      aria-describedby={supportFormErrors.email ? "support-email-error" : undefined}
                      {...registerSupportForm("email")}
                    />
                    {supportFormErrors.email && (
                      <span id="support-email-error" className={styles["support-page-page__contact-error"]} role="alert">
                        {supportFormErrors.email.message}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <input
                    type="text"
                    className={clsx(
                      styles["support-page-page__contact-input"],
                      supportFormErrors.phone && styles["support-page-page__contact-input--error"],
                    )}
                    placeholder="Số điện thoại"
                    aria-invalid={!!supportFormErrors.phone}
                    aria-describedby={supportFormErrors.phone ? "support-phone-error" : undefined}
                    {...registerSupportForm("phone")}
                  />
                  {supportFormErrors.phone && (
                    <span id="support-phone-error" className={styles["support-page-page__contact-error"]} role="alert">
                      {supportFormErrors.phone.message}
                    </span>
                  )}
                </div>
                <div>
                  <select
                    className={clsx(
                      styles["support-page-page__contact-input"],
                      supportFormErrors.topic && styles["support-page-page__contact-input--error"],
                    )}
                    aria-invalid={!!supportFormErrors.topic}
                    aria-describedby={supportFormErrors.topic ? "support-topic-error" : undefined}
                    {...registerSupportForm("topic")}
                  >
                    <option value="" disabled>
                      Vấn đề cần hỗ trợ
                    </option>
                    <option value="device-error">Lỗi kỹ thuật thiết bị</option>
                    <option value="upgrade-consult">Tư vấn nâng cấp dàn</option>
                    <option value="order-status">Kiểm tra tình trạng đơn hàng</option>
                    <option value="other">Khác</option>
                  </select>
                  {supportFormErrors.topic && (
                    <span id="support-topic-error" className={styles["support-page-page__contact-error"]} role="alert">
                      {supportFormErrors.topic.message}
                    </span>
                  )}
                </div>
                <div>
                  <textarea
                    className={clsx(
                      styles["support-page-page__contact-textarea"],
                      supportFormErrors.message && styles["support-page-page__contact-textarea--error"],
                    )}
                    placeholder="Mô tả chi tiết yêu cầu của bạn..."
                    aria-invalid={!!supportFormErrors.message}
                    aria-describedby={supportFormErrors.message ? "support-message-error" : undefined}
                    {...registerSupportForm("message")}
                  />
                  {supportFormErrors.message && (
                    <span id="support-message-error" className={styles["support-page-page__contact-error"]} role="alert">
                      {supportFormErrors.message.message}
                    </span>
                  )}
                </div>
                <button
                  type="submit"
                  className={styles["support-page-page__contact-submit"]}
                  disabled={isSupportSubmitting}
                >
                  {isSupportSubmitting ? "Đang gửi..." : "Gửi yêu cầu ngay"}
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* Resources */}
        <section className={styles["support-page-page__resources-section"]}>
          <div className={styles["support-page-page__resources-header"]}>
            <div>
              <h2 className={styles["support-page-page__resources-title"]}>
                Tài nguyên hữu ích
              </h2>
              <p className={styles["support-page-page__resources-subtitle"]}>
                Mẹo vặt và kiến thức âm thanh từ đội ngũ Đức Uy Audio.
              </p>
            </div>
            <button
              type="button"
              className={styles["support-page-page__resources-link"]}
            >
              Xem tất cả blog
              <MdArrowForward
                className={styles["support-page-page__resources-link-icon"]}
                aria-hidden="true"
              />
            </button>
          </div>

          <div className={styles["support-page-page__resources-grid"]}>
            {SUPPORT_RESOURCES.map((resource) => (
              <article
                key={resource.title}
                className={styles["support-page-page__resource-card"]}
              >
                <div
                  className={styles["support-page-page__resource-image"]}
                  style={{ backgroundImage: `url("${resource.imageUrl}")` }}
                />
                <div className={styles["support-page-page__resource-body"]}>
                  <span
                    className={styles["support-page-page__resource-category"]}
                  >
                    {resource.category}
                  </span>
                  <h3 className={styles["support-page-page__resource-title"]}>
                    {resource.title}
                  </h3>
                  <p
                    className={
                      styles["support-page-page__resource-description"]
                    }
                  >
                    {resource.description}
                  </p>
                  <button
                    type="button"
                    className={styles["support-page-page__resource-link"]}
                  >
                    Đọc bài viết
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <ShopFooter />

      {isWarrantyModalOpen && (
        <div
          className={styles["support-page-page__modal-backdrop"]}
          role="dialog"
          aria-modal="true"
          aria-labelledby="support-warranty-modal-title"
          onClick={(e) => e.target === e.currentTarget && setIsWarrantyModalOpen(false)}
        >
          <div className={styles["support-page-page__modal"]} onClick={(e) => e.stopPropagation()}>
            <header className={styles["support-page-page__modal-header"]}>
              <div className={styles["support-page-page__modal-header-left"]}>
                <div
                  className={styles["support-page-page__modal-header-icon"]}
                  aria-hidden="true"
                >
                  <MdVerifiedUser />
                </div>
                <div>
                  <h1
                    id="support-warranty-modal-title"
                    className={styles["support-page-page__modal-title"]}
                  >
                    Chính sách bảo hành
                  </h1>
                  <p className={styles["support-page-page__modal-subtitle"]}>
                    ĐỨC UY AUDIO PREMIUM SERVICE
                  </p>
                </div>
              </div>
              <button
                type="button"
                className={styles["support-page-page__modal-close"]}
                onClick={() => setIsWarrantyModalOpen(false)}
                aria-label="Đóng chính sách bảo hành"
              >
                <MdClose />
              </button>
            </header>

            <div className={styles["support-page-page__modal-body"]}>
              <section className={styles["support-page-page__modal-overview"]}>
                <div
                  className={
                    styles["support-page-page__modal-overview-duration"]
                  }
                >
                  <span
                    className={
                      styles["support-page-page__modal-overview-duration-icon"]
                    }
                    aria-hidden="true"
                  >
                    <MdSchedule />
                  </span>
                  <h2
                    className={
                      styles["support-page-page__modal-overview-duration-title"]
                    }
                  >
                    Thời hạn bảo hành
                  </h2>
                  <p
                    className={
                      styles[
                        "support-page-page__modal-overview-duration-description"
                      ]
                    }
                  >
                    Cam kết bảo hành từ{" "}
                    <span
                      className={
                        styles[
                          "support-page-page__modal-overview-duration-highlight"
                        ]
                      }
                    >
                      12 - 24 tháng
                    </span>{" "}
                    cho tất cả các thiết bị âm thanh Hi-end chính hãng được phân
                    phối bởi Đức Uy Audio.
                  </p>
                </div>

                <div
                  className={
                    styles["support-page-page__modal-overview-visual"]
                  }
                >
                  <div
                    className={
                      styles["support-page-page__modal-overview-visual-image"]
                    }
                  />
                  <div
                    className={
                      styles["support-page-page__modal-overview-visual-chip"]
                    }
                  >
                    Quality Standard
                  </div>
                </div>
              </section>

              <div className={styles["support-page-page__modal-columns"]}>
                <div className={styles["support-page-page__modal-column"]}>
                  <div
                    className={styles["support-page-page__modal-column-header"]}
                  >
                    <span
                      className={
                        styles[
                          "support-page-page__modal-column-header-icon--success"
                        ]
                      }
                      aria-hidden="true"
                    >
                      <MdChecklist />
                    </span>
                    <h3
                      className={
                        styles["support-page-page__modal-column-header-title"]
                      }
                    >
                      Điều kiện bảo hành
                    </h3>
                  </div>
                  <ul className={styles["support-page-page__modal-list"]}>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span
                        className={
                          styles["support-page-page__modal-list-icon--success"]
                        }
                        aria-hidden="true"
                      >
                        <MdCheckCircle />
                      </span>
                      <span>
                        Sản phẩm còn nguyên tem niêm phong và không có dấu hiệu
                        tháo rời.
                      </span>
                    </li>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span
                        className={
                          styles["support-page-page__modal-list-icon--success"]
                        }
                        aria-hidden="true"
                      >
                        <MdCheckCircle />
                      </span>
                      <span>
                        Có thẻ bảo hành hoặc thông tin bảo hành điện tử chính
                        xác trên hệ thống.
                      </span>
                    </li>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span
                        className={
                          styles["support-page-page__modal-list-icon--success"]
                        }
                        aria-hidden="true"
                      >
                        <MdCheckCircle />
                      </span>
                      <span>
                        Lỗi kỹ thuật phát sinh từ nhà sản xuất trong quá trình
                        vận hành bình thường.
                      </span>
                    </li>
                  </ul>
                </div>

                <div className={styles["support-page-page__modal-column"]}>
                  <div
                    className={styles["support-page-page__modal-column-header"]}
                  >
                    <span
                      className={
                        styles[
                          "support-page-page__modal-column-header-icon--danger"
                        ]
                      }
                      aria-hidden="true"
                    >
                      <MdWarning />
                    </span>
                    <h3
                      className={
                        styles["support-page-page__modal-column-header-title"]
                      }
                    >
                      Trường hợp từ chối
                    </h3>
                  </div>
                  <ul className={styles["support-page-page__modal-list"]}>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span
                        className={
                          styles["support-page-page__modal-list-icon--danger"]
                        }
                        aria-hidden="true"
                      >
                        <MdCancel />
                      </span>
                      <span>
                        Hư hỏng do hỏa hoạn, ngập nước, hoặc tác động ngoại lực
                        mạnh.
                      </span>
                    </li>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span
                        className={
                          styles["support-page-page__modal-list-icon--danger"]
                        }
                        aria-hidden="true"
                      >
                        <MdCancel />
                      </span>
                      <span>
                        Tự ý thay đổi linh kiện hoặc sửa chữa tại các cơ sở
                        không thuộc ủy quyền.
                      </span>
                    </li>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span
                        className={
                          styles["support-page-page__modal-list-icon--danger"]
                        }
                        aria-hidden="true"
                      >
                        <MdCancel />
                      </span>
                      <span>
                        Sử dụng sai điện áp hoặc sai cách thức hướng dẫn từ nhà
                        sản xuất.
                      </span>
                    </li>
                  </ul>
                </div>
              </div>

              <section className={styles["support-page-page__modal-steps"]}>
                <h3
                  className={styles["support-page-page__modal-steps-title"]}
                >
                  Quy trình xử lý bảo hành
                </h3>
                <div
                  className={styles["support-page-page__modal-steps-track"]}
                  aria-hidden="true"
                />
                <div className={styles["support-page-page__modal-steps-grid"]}>
                  <div
                    className={styles["support-page-page__modal-step-card"]}
                  >
                    <div
                      className={
                        styles["support-page-page__modal-step-number"]
                      }
                    >
                      1
                    </div>
                    <span
                      className={styles["support-page-page__modal-step-title"]}
                    >
                      Tiếp nhận
                    </span>
                    <span
                      className={
                        styles["support-page-page__modal-step-description"]
                      }
                    >
                      Đăng ký qua Hotline hoặc trực tiếp tại Showroom
                    </span>
                  </div>

                  <div
                    className={styles["support-page-page__modal-step-card"]}
                  >
                    <div
                      className={
                        styles["support-page-page__modal-step-number"]
                      }
                    >
                      2
                    </div>
                    <span
                      className={styles["support-page-page__modal-step-title"]}
                    >
                      Kiểm tra
                    </span>
                    <span
                      className={
                        styles["support-page-page__modal-step-description"]
                      }
                    >
                      Kỹ thuật viên thẩm định tình trạng thực tế của thiết bị
                    </span>
                  </div>

                  <div
                    className={styles["support-page-page__modal-step-card"]}
                  >
                    <div
                      className={
                        styles["support-page-page__modal-step-number"]
                      }
                    >
                      3
                    </div>
                    <span
                      className={styles["support-page-page__modal-step-title"]}
                    >
                      Xử lý
                    </span>
                    <span
                      className={
                        styles["support-page-page__modal-step-description"]
                      }
                    >
                      Sửa chữa hoặc thay thế linh kiện chính hãng mới 100%
                    </span>
                  </div>

                  <div
                    className={styles["support-page-page__modal-step-card"]}
                  >
                    <div
                      className={
                        styles["support-page-page__modal-step-number"]
                      }
                    >
                      4
                    </div>
                    <span
                      className={styles["support-page-page__modal-step-title"]}
                    >
                      Bàn giao
                    </span>
                    <span
                      className={
                        styles["support-page-page__modal-step-description"]
                      }
                    >
                      Kiểm tra âm thanh đầu ra và hoàn trả cho khách hàng
                    </span>
                  </div>
                </div>
              </section>

              <section className={styles["support-page-page__modal-support"]}>
                <div
                  className={
                    styles["support-page-page__modal-support-inner"]
                  }
                >
                  <div
                    className={
                      styles["support-page-page__modal-support-left"]
                    }
                  >
                    <div
                      className={
                        styles["support-page-page__modal-support-agent"]
                      }
                    >
                      <span aria-hidden="true">
                        <MdSupportAgent />
                      </span>
                    </div>
                    <div>
                      <h4
                        className={
                          styles["support-page-page__modal-support-title"]
                        }
                      >
                        Hỗ trợ kỹ thuật 24/7
                      </h4>
                      <p
                        className={
                          styles[
                            "support-page-page__modal-support-description"
                          ]
                        }
                      >
                        Đội ngũ chuyên gia luôn sẵn sàng hỗ trợ bạn
                      </p>
                    </div>
                  </div>
                  <div
                    className={
                      styles["support-page-page__modal-support-actions"]
                    }
                  >
                    <a
                      href="tel:1900889900"
                      className={
                        styles["support-page-page__modal-support-primary"]
                      }
                    >
                      <MdCall aria-hidden="true" />
                      <span>Hotline: 1900 88 99 00</span>
                    </a>
                    <button
                      type="button"
                      className={
                        styles["support-page-page__modal-support-secondary"]
                      }
                      onClick={() => {
                        setIsWarrantyModalOpen(false);
                        scrollToContact();
                      }}
                    >
                      <MdChat aria-hidden="true" />
                      <span>Gửi yêu cầu</span>
                    </button>
                  </div>
                </div>
              </section>
            </div>

            <footer className={styles["support-page-page__modal-footer"]}>
              <span>© 2024 Đức Uy Audio - Hi-End Excellence</span>
              <span>Cập nhật lần cuối: 10/10/2023</span>
            </footer>
          </div>
        </div>
      )}

      {/* Modal Chính sách đổi trả */}
      {isReturnsModalOpen && (
        <div
          className={styles["support-page-page__modal-backdrop"]}
          role="dialog"
          aria-modal="true"
          aria-labelledby="support-returns-modal-title"
          onClick={(e) => e.target === e.currentTarget && setIsReturnsModalOpen(false)}
        >
          <div className={styles["support-page-page__modal"]} onClick={(e) => e.stopPropagation()}>
            <header className={styles["support-page-page__modal-header"]}>
              <div className={styles["support-page-page__modal-header-left"]}>
                <div className={styles["support-page-page__modal-header-icon"]} aria-hidden="true">
                  <MdSell />
                </div>
                <div>
                  <h1 id="support-returns-modal-title" className={styles["support-page-page__modal-title"]}>
                    Chính sách đổi trả
                  </h1>
                  <p className={styles["support-page-page__modal-subtitle"]}>
                    ĐỔI TRẢ & HOÀN TIỀN THEO QUY ĐỊNH
                  </p>
                </div>
              </div>
              <button
                type="button"
                className={styles["support-page-page__modal-close"]}
                onClick={() => setIsReturnsModalOpen(false)}
                aria-label="Đóng chính sách đổi trả"
              >
                <MdClose />
              </button>
            </header>
            <div className={styles["support-page-page__modal-body"]}>
              <section className={styles["support-page-page__modal-overview"]}>
                <div className={styles["support-page-page__modal-overview-duration"]}>
                  <span className={styles["support-page-page__modal-overview-duration-icon"]} aria-hidden="true">
                    <MdSchedule />
                  </span>
                  <h2 className={styles["support-page-page__modal-overview-duration-title"]}>
                    Thời hạn yêu cầu đổi trả
                  </h2>
                  <p className={styles["support-page-page__modal-overview-duration-description"]}>
                    Trong vòng{" "}
                    <span className={styles["support-page-page__modal-overview-duration-highlight"]}>
                      07 ngày
                    </span>{" "}
                    kể từ khi nhận hàng đối với sản phẩm điện tử, thiết bị âm thanh. Một số thương hiệu có thể quy định 03 ngày, vui lòng xem mô tả sản phẩm.
                  </p>
                </div>
                <div className={styles["support-page-page__modal-overview-visual"]}>
                  <div className={styles["support-page-page__modal-overview-visual-image"]} />
                  <div className={styles["support-page-page__modal-overview-visual-chip"]}>
                    Fair Return
                  </div>
                </div>
              </section>
              <div className={styles["support-page-page__modal-columns"]}>
                <div className={styles["support-page-page__modal-column"]}>
                  <div className={styles["support-page-page__modal-column-header"]}>
                    <span className={styles["support-page-page__modal-column-header-icon--success"]} aria-hidden="true">
                      <MdChecklist />
                    </span>
                    <h3 className={styles["support-page-page__modal-column-header-title"]}>
                      Điều kiện được đổi/trả
                    </h3>
                  </div>
                  <ul className={styles["support-page-page__modal-list"]}>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span className={styles["support-page-page__modal-list-icon--success"]} aria-hidden="true">
                        <MdCheckCircle />
                      </span>
                      <span>Giao nhầm mẫu, size, số lượng so với đơn đặt hàng.</span>
                    </li>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span className={styles["support-page-page__modal-list-icon--success"]} aria-hidden="true">
                        <MdCheckCircle />
                      </span>
                      <span>Hàng lỗi kỹ thuật, hỏng hóc, móp méo do bên bán hoặc vận chuyển.</span>
                    </li>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span className={styles["support-page-page__modal-list-icon--success"]} aria-hidden="true">
                        <MdCheckCircle />
                      </span>
                      <span>Sản phẩm không đúng mô tả trên website; hàng hết hạn sử dụng.</span>
                    </li>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span className={styles["support-page-page__modal-list-icon--success"]} aria-hidden="true">
                        <MdCheckCircle />
                      </span>
                      <span>Sản phẩm còn nguyên vẹn, đầy đủ tem, nhãn, bao bì, hóa đơn; chưa qua sử dụng sai cách.</span>
                    </li>
                  </ul>
                </div>
                <div className={styles["support-page-page__modal-column"]}>
                  <div className={styles["support-page-page__modal-column-header"]}>
                    <span className={styles["support-page-page__modal-column-header-icon--danger"]} aria-hidden="true">
                      <MdWarning />
                    </span>
                    <h3 className={styles["support-page-page__modal-column-header-title"]}>
                      Trường hợp không áp dụng
                    </h3>
                  </div>
                  <ul className={styles["support-page-page__modal-list"]}>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span className={styles["support-page-page__modal-list-icon--danger"]} aria-hidden="true">
                        <MdCancel />
                      </span>
                      <span>Khách đổi ý, không còn nhu cầu (trừ khi chính sách từng đợt cho phép).</span>
                    </li>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span className={styles["support-page-page__modal-list-icon--danger"]} aria-hidden="true">
                        <MdCancel />
                      </span>
                      <span>Lỗi do người sử dụng: rơi vỡ, vào nước, sử dụng sai điện áp.</span>
                    </li>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span className={styles["support-page-page__modal-list-icon--danger"]} aria-hidden="true">
                        <MdCancel />
                      </span>
                      <span>Quá thời hạn 07 ngày (hoặc theo quy định riêng của từng sản phẩm).</span>
                    </li>
                  </ul>
                </div>
              </div>
              <section className={styles["support-page-page__modal-overview"]} style={{ marginBottom: 20 }}>
                <div className={styles["support-page-page__modal-overview-duration"]} style={{ gridColumn: "1 / -1" }}>
                  <h3 className={styles["support-page-page__modal-overview-duration-title"]} style={{ marginBottom: 8 }}>
                    Chi phí vận chuyển & hình thức hoàn tiền
                  </h3>
                  <p className={styles["support-page-page__modal-overview-duration-description"]}>
                    Lỗi từ Đức Uy: Đức Uy chịu 100% phí ship hai chiều. Đổi do khách (nếu chính sách từng đợt cho phép): khách chịu phí gửi trả. Hoàn tiền qua chuyển khoản trong 5–7 ngày làm việc; hoặc đổi sản phẩm mới tương đương. Không hoàn tiền mặt tại cửa hàng cho đơn đặt online.
                  </p>
                  <p className={styles["support-page-page__modal-overview-duration-description"]} style={{ marginTop: 8 }}>
                    Khi gửi đổi trả, vui lòng kèm mã đơn hàng, ảnh sản phẩm (tem, lỗi), hóa đơn hoặc phiếu xuất kho; không tháo rời niêm phong nếu chưa có chỉ dẫn từ Đức Uy.
                  </p>
                </div>
              </section>
              <section className={styles["support-page-page__modal-steps"]}>
                <h3 className={styles["support-page-page__modal-steps-title"]}>
                  Quy trình xử lý đổi trả
                </h3>
                <div className={styles["support-page-page__modal-steps-track"]} aria-hidden="true" />
                <div className={styles["support-page-page__modal-steps-grid"]}>
                  <div className={styles["support-page-page__modal-step-card"]}>
                    <div className={styles["support-page-page__modal-step-number"]}>1</div>
                    <span className={styles["support-page-page__modal-step-title"]}>Liên hệ báo lỗi</span>
                    <span className={styles["support-page-page__modal-step-description"]}>Gọi Hotline, nhắn Zalo hoặc gửi email kèm mã đơn hàng và mô tả ngắn gọn tình trạng sản phẩm.</span>
                  </div>
                  <div className={styles["support-page-page__modal-step-card"]}>
                    <div className={styles["support-page-page__modal-step-number"]}>2</div>
                    <span className={styles["support-page-page__modal-step-title"]}>Gửi ảnh / chứng từ</span>
                    <span className={styles["support-page-page__modal-step-description"]}>Gửi ảnh sản phẩm (tem niêm phong, lỗi nếu có), hóa đơn hoặc phiếu xuất kho để Đức Uy xác nhận và hướng dẫn bước tiếp theo.</span>
                  </div>
                  <div className={styles["support-page-page__modal-step-card"]}>
                    <div className={styles["support-page-page__modal-step-number"]}>3</div>
                    <span className={styles["support-page-page__modal-step-title"]}>Kiểm tra</span>
                    <span className={styles["support-page-page__modal-step-description"]}>Đức Uy kiểm tra và thông báo phương án: hoàn tiền hoặc đổi sản phẩm mới; thời gian xử lý dự kiến.</span>
                  </div>
                  <div className={styles["support-page-page__modal-step-card"]}>
                    <div className={styles["support-page-page__modal-step-number"]}>4</div>
                    <span className={styles["support-page-page__modal-step-title"]}>Hoàn tiền / Đổi hàng</span>
                    <span className={styles["support-page-page__modal-step-description"]}>Hoàn tiền qua chuyển khoản trong 5–7 ngày làm việc sau khi xác nhận; hoặc đổi sản phẩm mới tương đương và giao hàng theo đơn.</span>
                  </div>
                </div>
              </section>
              <section className={styles["support-page-page__modal-support"]}>
                <div className={styles["support-page-page__modal-support-inner"]}>
                  <div className={styles["support-page-page__modal-support-left"]}>
                    <div className={styles["support-page-page__modal-support-agent"]}>
                      <span aria-hidden="true"><MdSupportAgent /></span>
                    </div>
                    <div>
                      <h4 className={styles["support-page-page__modal-support-title"]}>Hỗ trợ đổi trả 24/7</h4>
                      <p className={styles["support-page-page__modal-support-description"]}>Liên hệ để được hướng dẫn nhanh nhất</p>
                    </div>
                  </div>
                  <div className={styles["support-page-page__modal-support-actions"]}>
                    <a href="tel:1900889900" className={styles["support-page-page__modal-support-primary"]}>
                      <MdCall aria-hidden="true" /><span>Hotline: 1900 88 99 00</span>
                    </a>
                    <button type="button" className={styles["support-page-page__modal-support-secondary"]} onClick={() => { setIsReturnsModalOpen(false); scrollToContact(); }}>
                      <MdChat aria-hidden="true" /><span>Gửi yêu cầu</span>
                    </button>
                  </div>
                </div>
              </section>
            </div>
            <footer className={styles["support-page-page__modal-footer"]}>
              <span>© 2024 Đức Uy Audio - Hi-End Excellence</span>
              <span>Cập nhật lần cuối: 03/2024</span>
            </footer>
          </div>
        </div>
      )}

      {/* Modal Chính sách thanh toán */}
      {isPaymentModalOpen && (
        <div
          className={styles["support-page-page__modal-backdrop"]}
          role="dialog"
          aria-modal="true"
          aria-labelledby="support-payment-modal-title"
          onClick={(e) => e.target === e.currentTarget && setIsPaymentModalOpen(false)}
        >
          <div className={styles["support-page-page__modal"]} onClick={(e) => e.stopPropagation()}>
            <header className={styles["support-page-page__modal-header"]}>
              <div className={styles["support-page-page__modal-header-left"]}>
                <div className={styles["support-page-page__modal-header-icon"]} aria-hidden="true">
                  <MdPayments />
                </div>
                <div>
                  <h1 id="support-payment-modal-title" className={styles["support-page-page__modal-title"]}>
                    Chính sách thanh toán
                  </h1>
                  <p className={styles["support-page-page__modal-subtitle"]}>
                    ĐỨC UY AUDIO – NHIỀU HÌNH THỨC THANH TOÁN
                  </p>
                </div>
              </div>
              <button type="button" className={styles["support-page-page__modal-close"]} onClick={() => setIsPaymentModalOpen(false)} aria-label="Đóng chính sách thanh toán">
                <MdClose />
              </button>
            </header>
            <div className={styles["support-page-page__modal-body"]}>
              <section className={styles["support-page-page__modal-overview"]}>
                <div className={styles["support-page-page__modal-overview-duration"]}>
                  <span className={styles["support-page-page__modal-overview-duration-icon"]} aria-hidden="true">
                    <MdPayments />
                  </span>
                  <h2 className={styles["support-page-page__modal-overview-duration-title"]}>
                    Hình thức thanh toán
                  </h2>
                  <p className={styles["support-page-page__modal-overview-duration-description"]}>
                    Đức Uy Audio hỗ trợ{" "}
                    <span className={styles["support-page-page__modal-overview-duration-highlight"]}>
                      chuyển khoản ngân hàng
                    </span>
                    , thanh toán khi nhận hàng (COD), quẹt thẻ tại showroom và các cổng thanh toán trực tuyến đang được tích hợp.
                  </p>
                </div>
                <div className={styles["support-page-page__modal-overview-visual"]}>
                  <div className={styles["support-page-page__modal-overview-visual-image"]} />
                  <div className={styles["support-page-page__modal-overview-visual-chip"]}>Secure</div>
                </div>
              </section>
              <div className={styles["support-page-page__modal-columns"]}>
                <div className={styles["support-page-page__modal-column"]}>
                  <div className={styles["support-page-page__modal-column-header"]}>
                    <span className={styles["support-page-page__modal-column-header-icon--success"]} aria-hidden="true"><MdChecklist /></span>
                    <h3 className={styles["support-page-page__modal-column-header-title"]}>Hình thức áp dụng</h3>
                  </div>
                  <ul className={styles["support-page-page__modal-list"]}>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span className={styles["support-page-page__modal-list-icon--success"]} aria-hidden="true"><MdCheckCircle /></span>
                      <span>Chuyển khoản ngân hàng: ghi rõ mã đơn + tên; hoàn tất trong 24–48h; thường được miễn/giảm phí ship.</span>
                    </li>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span className={styles["support-page-page__modal-list-icon--success"]} aria-hidden="true"><MdCheckCircle /></span>
                      <span>COD (thanh toán khi nhận hàng): áp dụng theo khu vực, có thể phát sinh phí vận chuyển.</span>
                    </li>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span className={styles["support-page-page__modal-list-icon--success"]} aria-hidden="true"><MdCheckCircle /></span>
                      <span>Thanh toán tại showroom: tiền mặt, quẹt thẻ (phụ phí 1–2% tùy ngân hàng nếu có).</span>
                    </li>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span className={styles["support-page-page__modal-list-icon--success"]} aria-hidden="true"><MdCheckCircle /></span>
                      <span>Ví điện tử, thẻ quốc tế (VISA, Mastercard) khi được tích hợp trên website.</span>
                    </li>
                  </ul>
                </div>
                <div className={styles["support-page-page__modal-column"]}>
                  <div className={styles["support-page-page__modal-column-header"]}>
                    <span className={styles["support-page-page__modal-column-header-icon--danger"]} aria-hidden="true"><MdWarning /></span>
                    <h3 className={styles["support-page-page__modal-column-header-title"]}>Lưu ý</h3>
                  </div>
                  <ul className={styles["support-page-page__modal-list"]}>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span className={styles["support-page-page__modal-list-icon--danger"]} aria-hidden="true"><MdCancel /></span>
                      <span>Khách chịu phí chuyển khoản từ phía ngân hàng (nếu có).</span>
                    </li>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span className={styles["support-page-page__modal-list-icon--danger"]} aria-hidden="true"><MdCancel /></span>
                      <span>Nội dung chuyển khoản phải ghi chính xác để đối soát nhanh.</span>
                    </li>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span className={styles["support-page-page__modal-list-icon--danger"]} aria-hidden="true"><MdCancel /></span>
                      <span>Không hỗ trợ thanh toán bằng tiền giả hoặc hình thức không hợp lệ.</span>
                    </li>
                  </ul>
                </div>
              </div>
              <section className={styles["support-page-page__modal-overview"]} style={{ marginBottom: 20 }}>
                <div className={styles["support-page-page__modal-overview-duration"]} style={{ gridColumn: "1 / -1" }}>
                  <h3 className={styles["support-page-page__modal-overview-duration-title"]} style={{ marginBottom: 8 }}>
                    Hướng dẫn chuyển khoản
                  </h3>
                  <ul className={styles["support-page-page__modal-list"]} style={{ marginTop: 8 }}>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span className={styles["support-page-page__modal-list-icon--success"]} aria-hidden="true"><MdCheckCircle /></span>
                      <span>Nội dung chuyển khoản bắt buộc ghi: <strong>mã đơn hàng + họ tên người nhận</strong> để đối soát nhanh.</span>
                    </li>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span className={styles["support-page-page__modal-list-icon--success"]} aria-hidden="true"><MdCheckCircle /></span>
                      <span>Hoàn tất thanh toán trong 24–48 giờ sau khi đặt hàng. Sau khi chuyển, gửi lại biên lai (ảnh hoặc email) cho Đức Uy để xác nhận.</span>
                    </li>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span className={styles["support-page-page__modal-list-icon--success"]} aria-hidden="true"><MdCheckCircle /></span>
                      <span>Thông tin tài khoản ngân hàng Đức Uy được gửi trong email xác nhận đơn hàng. Đơn chưa thanh toán sau 24–48h có thể bị hủy để trả tồn kho.</span>
                    </li>
                  </ul>
                </div>
              </section>
              <section className={styles["support-page-page__modal-steps"]}>
                <h3 className={styles["support-page-page__modal-steps-title"]}>Quy trình đặt hàng & thanh toán</h3>
                <div className={styles["support-page-page__modal-steps-track"]} aria-hidden="true" />
                <div className={styles["support-page-page__modal-steps-grid"]}>
                  <div className={styles["support-page-page__modal-step-card"]}>
                    <div className={styles["support-page-page__modal-step-number"]}>1</div>
                    <span className={styles["support-page-page__modal-step-title"]}>Đặt hàng</span>
                    <span className={styles["support-page-page__modal-step-description"]}>Chọn sản phẩm, thêm vào giỏ, điền đầy đủ thông tin giao hàng và chọn hình thức thanh toán.</span>
                  </div>
                  <div className={styles["support-page-page__modal-step-card"]}>
                    <div className={styles["support-page-page__modal-step-number"]}>2</div>
                    <span className={styles["support-page-page__modal-step-title"]}>Thanh toán</span>
                    <span className={styles["support-page-page__modal-step-description"]}>Chuyển khoản: ghi đúng nội dung và chuyển trong 24–48h. COD: thanh toán khi nhận hàng. Showroom: thanh toán trực tiếp khi lấy hàng.</span>
                  </div>
                  <div className={styles["support-page-page__modal-step-card"]}>
                    <div className={styles["support-page-page__modal-step-number"]}>3</div>
                    <span className={styles["support-page-page__modal-step-title"]}>Xác nhận</span>
                    <span className={styles["support-page-page__modal-step-description"]}>Đức Uy liên hệ xác nhận đơn và thông báo thời gian giao hàng; với chuyển khoản, xác nhận sau khi đối soát biên lai.</span>
                  </div>
                </div>
              </section>
              <section className={styles["support-page-page__modal-support"]}>
                <div className={styles["support-page-page__modal-support-inner"]}>
                  <div className={styles["support-page-page__modal-support-left"]}>
                    <div className={styles["support-page-page__modal-support-agent"]}><span aria-hidden="true"><MdSupportAgent /></span></div>
                    <div>
                      <h4 className={styles["support-page-page__modal-support-title"]}>Cần tư vấn thanh toán?</h4>
                      <p className={styles["support-page-page__modal-support-description"]}>Hotline hỗ trợ 24/7</p>
                    </div>
                  </div>
                  <div className={styles["support-page-page__modal-support-actions"]}>
                    <a href="tel:1900889900" className={styles["support-page-page__modal-support-primary"]}>
                      <MdCall aria-hidden="true" /><span>Hotline: 1900 88 99 00</span>
                    </a>
                    <button type="button" className={styles["support-page-page__modal-support-secondary"]} onClick={() => { setIsPaymentModalOpen(false); scrollToContact(); }}>
                      <MdChat aria-hidden="true" /><span>Liên hệ</span>
                    </button>
                  </div>
                </div>
              </section>
            </div>
            <footer className={styles["support-page-page__modal-footer"]}>
              <span>© 2024 Đức Uy Audio - Hi-End Excellence</span>
              <span>Cập nhật lần cuối: 03/2024</span>
            </footer>
          </div>
        </div>
      )}

      {/* Modal Điều khoản dịch vụ */}
      {isTermsModalOpen && (
        <div
          className={styles["support-page-page__modal-backdrop"]}
          role="dialog"
          aria-modal="true"
          aria-labelledby="support-terms-modal-title"
          onClick={(e) => e.target === e.currentTarget && setIsTermsModalOpen(false)}
        >
          <div className={styles["support-page-page__modal"]} onClick={(e) => e.stopPropagation()}>
            <header className={styles["support-page-page__modal-header"]}>
              <div className={styles["support-page-page__modal-header-left"]}>
                <div className={styles["support-page-page__modal-header-icon"]} aria-hidden="true">
                  <MdSettingsSuggest />
                </div>
                <div>
                  <h1 id="support-terms-modal-title" className={styles["support-page-page__modal-title"]}>
                    Điều khoản dịch vụ
                  </h1>
                  <p className={styles["support-page-page__modal-subtitle"]}>
                    SỬ DỤNG WEBSITE & DỊCH VỤ ĐỨC UY AUDIO
                  </p>
                </div>
              </div>
              <button type="button" className={styles["support-page-page__modal-close"]} onClick={() => setIsTermsModalOpen(false)} aria-label="Đóng điều khoản dịch vụ">
                <MdClose />
              </button>
            </header>
            <div className={styles["support-page-page__modal-body"]}>
              <section className={styles["support-page-page__modal-overview"]}>
                <div className={styles["support-page-page__modal-overview-duration"]} style={{ gridColumn: "1 / -1" }}>
                  <h2 className={styles["support-page-page__modal-overview-duration-title"]}>Phạm vi áp dụng</h2>
                  <p className={styles["support-page-page__modal-overview-duration-description"]}>
                    Điều khoản này áp dụng khi quý khách truy cập, sử dụng website và dịch vụ mua hàng tại Đức Uy Audio. Việc sử dụng website đồng nghĩa với việc chấp nhận các điều khoản dưới đây.
                  </p>
                </div>
              </section>
              <div className={styles["support-page-page__modal-columns"]} style={{ gridTemplateColumns: "1fr" }}>
                <div className={styles["support-page-page__modal-column"]}>
                  <h3 className={styles["support-page-page__modal-column-header-title"]} style={{ marginBottom: 8 }}>Giá bán, hóa đơn và thanh toán</h3>
                  <p className={styles["support-page-page__modal-overview-duration-description"]} style={{ marginBottom: 12 }}>
                    Giá hiển thị có thể đã hoặc chưa bao gồm VAT tùy từng sản phẩm. Hóa đơn điện tử xuất theo Nghị định 123/2020 và quy định hiện hành. Thanh toán thực hiện theo đúng chính sách thanh toán của Đức Uy Audio.
                  </p>
                  <h3 className={styles["support-page-page__modal-column-header-title"]} style={{ marginBottom: 8 }}>Giao nhận và kiểm tra</h3>
                  <p className={styles["support-page-page__modal-overview-duration-description"]} style={{ marginBottom: 12 }}>
                    Khách hàng có trách nhiệm kiểm tra số lượng, chủng loại và tình trạng hàng khi nhận; báo lỗi trong thời hạn quy định theo chính sách đổi trả. Khiếu nại về vận chuyển cần gửi cho đơn vị vận chuyển trong vòng 24–48 giờ sau khi nhận hàng.
                  </p>
                  <h3 className={styles["support-page-page__modal-column-header-title"]} style={{ marginBottom: 8 }}>Bảo trì, bảo hành</h3>
                  <p className={styles["support-page-page__modal-overview-duration-description"]} style={{ marginBottom: 12 }}>
                    Bảo hành áp dụng theo chính sách bảo hành của Đức Uy và từng thương hiệu. Thời hạn và điều kiện chi tiết xem tại mục Chính sách bảo hành trên trang Hỗ trợ.
                  </p>
                  <h3 className={styles["support-page-page__modal-column-header-title"]} style={{ marginBottom: 8 }}>Quyền và trách nhiệm khách hàng</h3>
                  <p className={styles["support-page-page__modal-overview-duration-description"]} style={{ marginBottom: 6 }}>Quyền được đảm bảo:</p>
                  <ul className={styles["support-page-page__modal-list"]} style={{ marginBottom: 12 }}>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span className={styles["support-page-page__modal-list-icon--success"]} aria-hidden="true"><MdCheckCircle /></span>
                      <span>Được cung cấp thông tin đầy đủ, chính xác về sản phẩm và dịch vụ; bảo mật dữ liệu cá nhân theo quy định; khiếu nại, tố cáo theo quy định pháp luật.</span>
                    </li>
                  </ul>
                  <p className={styles["support-page-page__modal-overview-duration-description"]} style={{ marginBottom: 6 }}>Trách nhiệm khách hàng:</p>
                  <ul className={styles["support-page-page__modal-list"]} style={{ marginBottom: 12 }}>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span className={styles["support-page-page__modal-list-icon--danger"]} aria-hidden="true"><MdCancel /></span>
                      <span>Cung cấp thông tin chính xác khi đăng ký và đặt hàng; bảo mật tài khoản và mật khẩu; sử dụng dịch vụ đúng mục đích, không vi phạm pháp luật Việt Nam.</span>
                    </li>
                  </ul>
                  <h3 className={styles["support-page-page__modal-column-header-title"]} style={{ marginBottom: 8 }}>Bảo mật thông tin</h3>
                  <p className={styles["support-page-page__modal-overview-duration-description"]} style={{ marginBottom: 12 }}>
                    Đức Uy thu thập thông tin ở mức tối thiểu cần thiết cho giao dịch và hỗ trợ khách hàng; không bán hoặc chuyển giao dữ liệu cá nhân cho bên thứ ba vì mục đích thương mại. Dữ liệu được bảo vệ theo chính sách bảo mật và quy định pháp luật hiện hành.
                  </p>
                  <h3 className={styles["support-page-page__modal-column-header-title"]} style={{ marginBottom: 8 }}>Bất khả kháng</h3>
                  <p className={styles["support-page-page__modal-overview-duration-description"]} style={{ marginBottom: 12 }}>
                    Các bên được miễn trách nhiệm trong trường hợp bất khả kháng (thiên tai, dịch bệnh, chiến sự, sự cố hạ tầng hoặc lỗi kỹ thuật ngoài kiểm soát). Khi xảy ra, Đức Uy sẽ thông báo và có thể gia hạn thời gian thực hiện nếu khả thi.
                  </p>
                  <h3 className={styles["support-page-page__modal-column-header-title"]} style={{ marginBottom: 8 }}>Chấm dứt và tranh chấp</h3>
                  <p className={styles["support-page-page__modal-overview-duration-description"]}>
                    Mọi tranh chấp ưu tiên giải quyết bằng thương lượng. Không giải quyết được, áp dụng pháp luật Việt Nam; Tòa án hoặc Trọng tài có thẩm quyền theo quy định.
                  </p>
                </div>
              </div>
              <section className={styles["support-page-page__modal-support"]}>
                <div className={styles["support-page-page__modal-support-inner"]}>
                  <div className={styles["support-page-page__modal-support-left"]}>
                    <div className={styles["support-page-page__modal-support-agent"]}><span aria-hidden="true"><MdSupportAgent /></span></div>
                    <div>
                      <h4 className={styles["support-page-page__modal-support-title"]}>Câu hỏi về điều khoản?</h4>
                      <p className={styles["support-page-page__modal-support-description"]}>Liên hệ để được giải đáp</p>
                    </div>
                  </div>
                  <div className={styles["support-page-page__modal-support-actions"]}>
                    <a href="tel:1900889900" className={styles["support-page-page__modal-support-primary"]}>
                      <MdCall aria-hidden="true" /><span>Hotline: 1900 88 99 00</span>
                    </a>
                    <button type="button" className={styles["support-page-page__modal-support-secondary"]} onClick={() => { setIsTermsModalOpen(false); scrollToContact(); }}>
                      <MdChat aria-hidden="true" /><span>Liên hệ</span>
                    </button>
                  </div>
                </div>
              </section>
            </div>
            <footer className={styles["support-page-page__modal-footer"]}>
              <span>© 2024 Đức Uy Audio - Hi-End Excellence</span>
              <span>Cập nhật lần cuối: 03/2024</span>
            </footer>
          </div>
        </div>
      )}

      {/* Modal Khuyến mãi */}
      {isPromoModalOpen && (
        <div
          className={styles["support-page-page__modal-backdrop"]}
          role="dialog"
          aria-modal="true"
          aria-labelledby="support-promo-modal-title"
          onClick={(e) => e.target === e.currentTarget && setIsPromoModalOpen(false)}
        >
          <div className={styles["support-page-page__modal"]} onClick={(e) => e.stopPropagation()}>
            <header className={styles["support-page-page__modal-header"]}>
              <div className={styles["support-page-page__modal-header-left"]}>
                <div className={styles["support-page-page__modal-header-icon"]} aria-hidden="true">
                  <MdSell />
                </div>
                <div>
                  <h1 id="support-promo-modal-title" className={styles["support-page-page__modal-title"]}>
                    Mã giảm giá & Khuyến mãi
                  </h1>
                  <p className={styles["support-page-page__modal-subtitle"]}>
                    ƯU ĐÃI THƯỜNG XUYÊN TẠI ĐỨC UY AUDIO
                  </p>
                </div>
              </div>
              <button type="button" className={styles["support-page-page__modal-close"]} onClick={() => setIsPromoModalOpen(false)} aria-label="Đóng khuyến mãi">
                <MdClose />
              </button>
            </header>
            <div className={styles["support-page-page__modal-body"]}>
              <section className={styles["support-page-page__modal-overview"]}>
                <div className={styles["support-page-page__modal-overview-duration"]}>
                  <span className={styles["support-page-page__modal-overview-duration-icon"]} aria-hidden="true"><MdSell /></span>
                  <h2 className={styles["support-page-page__modal-overview-duration-title"]}>Chương trình khuyến mãi</h2>
                  <p className={styles["support-page-page__modal-overview-duration-description"]}>
                    Đức Uy Audio thường xuyên có mã giảm giá, giảm theo đơn hàng, quà tặng kèm và ưu đãi dành cho khách hàng. Nhập mã tại bước thanh toán; mỗi chương trình có điều kiện riêng (giá trị đơn tối thiểu, sản phẩm áp dụng, thời hạn). Mỗi đơn thường chỉ áp dụng một mã, trừ khi chương trình cho phép cộng dồn.
                  </p>
                </div>
                <div className={styles["support-page-page__modal-overview-visual"]}>
                  <div className={styles["support-page-page__modal-overview-visual-image"]} />
                  <div className={styles["support-page-page__modal-overview-visual-chip"]}>Promo</div>
                </div>
              </section>
              <div className={styles["support-page-page__modal-columns"]}>
                <div className={styles["support-page-page__modal-column"]}>
                  <div className={styles["support-page-page__modal-column-header"]}>
                    <span className={styles["support-page-page__modal-column-header-icon--success"]} aria-hidden="true"><MdChecklist /></span>
                    <h3 className={styles["support-page-page__modal-column-header-title"]}>Cách áp dụng & loại ưu đãi</h3>
                  </div>
                  <ul className={styles["support-page-page__modal-list"]}>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span className={styles["support-page-page__modal-list-icon--success"]} aria-hidden="true"><MdCheckCircle /></span>
                      <span>Mã giảm giá theo % hoặc số tiền cố định; giảm theo giá trị đơn (ví dụ đơn từ 10 triệu giảm 5%); quà tặng kèm; combo giá đặc biệt.</span>
                    </li>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span className={styles["support-page-page__modal-list-icon--success"]} aria-hidden="true"><MdCheckCircle /></span>
                      <span>Nhập mã tại ô &quot;Mã giảm giá&quot; khi thanh toán, bấm &quot;Áp dụng&quot;; hệ thống kiểm tra điều kiện (đơn tối thiểu, sản phẩm, thời hạn).</span>
                    </li>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span className={styles["support-page-page__modal-list-icon--success"]} aria-hidden="true"><MdCheckCircle /></span>
                      <span>Xem chi tiết từng chương trình, mã và thời hạn tại trang Khuyến mãi.</span>
                    </li>
                  </ul>
                </div>
                <div className={styles["support-page-page__modal-column"]}>
                  <div className={styles["support-page-page__modal-column-header"]}>
                    <span className={styles["support-page-page__modal-column-header-icon--danger"]} aria-hidden="true"><MdWarning /></span>
                    <h3 className={styles["support-page-page__modal-column-header-title"]}>Lưu ý & lỗi thường gặp</h3>
                  </div>
                  <ul className={styles["support-page-page__modal-list"]}>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span className={styles["support-page-page__modal-list-icon--danger"]} aria-hidden="true"><MdCancel /></span>
                      <span>Mã hết hạn hoặc hết lượt sử dụng sẽ không áp dụng được.</span>
                    </li>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span className={styles["support-page-page__modal-list-icon--danger"]} aria-hidden="true"><MdCancel /></span>
                      <span>Đơn chưa đạt giá trị tối thiểu hoặc sản phẩm không thuộc danh mục áp dụng.</span>
                    </li>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span className={styles["support-page-page__modal-list-icon--danger"]} aria-hidden="true"><MdCancel /></span>
                      <span>Mã không cộng dồn với nhau trừ khi chương trình ghi rõ.</span>
                    </li>
                  </ul>
                </div>
              </div>
              <section className={styles["support-page-page__modal-steps"]}>
                <h3 className={styles["support-page-page__modal-steps-title"]}>Quy trình áp dụng mã giảm giá</h3>
                <div className={styles["support-page-page__modal-steps-track"]} aria-hidden="true" />
                <div className={styles["support-page-page__modal-steps-grid"]}>
                  <div className={styles["support-page-page__modal-step-card"]}>
                    <div className={styles["support-page-page__modal-step-number"]}>1</div>
                    <span className={styles["support-page-page__modal-step-title"]}>Xem chương trình</span>
                    <span className={styles["support-page-page__modal-step-description"]}>Truy cập trang Khuyến mãi để xem mã và điều kiện áp dụng.</span>
                  </div>
                  <div className={styles["support-page-page__modal-step-card"]}>
                    <div className={styles["support-page-page__modal-step-number"]}>2</div>
                    <span className={styles["support-page-page__modal-step-title"]}>Chọn sản phẩm</span>
                    <span className={styles["support-page-page__modal-step-description"]}>Chọn sản phẩm đủ điều kiện, thêm vào giỏ hàng.</span>
                  </div>
                  <div className={styles["support-page-page__modal-step-card"]}>
                    <div className={styles["support-page-page__modal-step-number"]}>3</div>
                    <span className={styles["support-page-page__modal-step-title"]}>Vào thanh toán</span>
                    <span className={styles["support-page-page__modal-step-description"]}>Vào giỏ hàng, chọn Thanh toán và điền thông tin giao hàng.</span>
                  </div>
                  <div className={styles["support-page-page__modal-step-card"]}>
                    <div className={styles["support-page-page__modal-step-number"]}>4</div>
                    <span className={styles["support-page-page__modal-step-title"]}>Nhập mã & áp dụng</span>
                    <span className={styles["support-page-page__modal-step-description"]}>Nhập mã tại ô &quot;Mã giảm giá&quot;, bấm Áp dụng; kiểm tra số tiền giảm và hoàn tất đơn.</span>
                  </div>
                </div>
              </section>
              <section className={styles["support-page-page__modal-support"]}>
                <div className={styles["support-page-page__modal-support-inner"]}>
                  <div className={styles["support-page-page__modal-support-left"]}>
                    <div className={styles["support-page-page__modal-support-agent"]}><span aria-hidden="true"><MdSell /></span></div>
                    <div>
                      <h4 className={styles["support-page-page__modal-support-title"]}>Xem tất cả khuyến mãi</h4>
                      <p className={styles["support-page-page__modal-support-description"]}>Cập nhật mã và chương trình mới nhất</p>
                    </div>
                  </div>
                  <div className={styles["support-page-page__modal-support-actions"]}>
                    <button
                      type="button"
                      className={styles["support-page-page__modal-support-primary"]}
                      onClick={() => { setIsPromoModalOpen(false); router.push("/promotions"); }}
                    >
                      <MdArrowForward aria-hidden="true" /><span>Đến trang Khuyến mãi</span>
                    </button>
                  </div>
                </div>
              </section>
            </div>
            <footer className={styles["support-page-page__modal-footer"]}>
              <span>© 2024 Đức Uy Audio - Hi-End Excellence</span>
              <span>Cập nhật lần cuối: 03/2024</span>
            </footer>
          </div>
        </div>
      )}

      {/* Modal Hỗ trợ kỹ thuật */}
      {isTechSupportModalOpen && (
        <div
          className={styles["support-page-page__modal-backdrop"]}
          role="dialog"
          aria-modal="true"
          aria-labelledby="support-tech-modal-title"
          onClick={(e) => e.target === e.currentTarget && setIsTechSupportModalOpen(false)}
        >
          <div className={styles["support-page-page__modal"]} onClick={(e) => e.stopPropagation()}>
            <header className={styles["support-page-page__modal-header"]}>
              <div className={styles["support-page-page__modal-header-left"]}>
                <div className={styles["support-page-page__modal-header-icon"]} aria-hidden="true">
                  <MdSettingsSuggest />
                </div>
                <div>
                  <h1 id="support-tech-modal-title" className={styles["support-page-page__modal-title"]}>
                    Hỗ trợ kỹ thuật
                  </h1>
                  <p className={styles["support-page-page__modal-subtitle"]}>
                    TƯ VẤN SETUP – SỬA CHỮA – BẢO HÀNH
                  </p>
                </div>
              </div>
              <button type="button" className={styles["support-page-page__modal-close"]} onClick={() => setIsTechSupportModalOpen(false)} aria-label="Đóng hỗ trợ kỹ thuật">
                <MdClose />
              </button>
            </header>
            <div className={styles["support-page-page__modal-body"]}>
              <section className={styles["support-page-page__modal-overview"]}>
                <div className={styles["support-page-page__modal-overview-duration"]}>
                  <span className={styles["support-page-page__modal-overview-duration-icon"]} aria-hidden="true"><MdSettingsSuggest /></span>
                  <h2 className={styles["support-page-page__modal-overview-duration-title"]}>Dịch vụ hỗ trợ kỹ thuật</h2>
                  <p className={styles["support-page-page__modal-overview-duration-description"]}>
                    Đội ngũ Đức Uy Audio hỗ trợ tư vấn setup dàn âm thanh, lắp đặt tại nhà, hướng dẫn sử dụng, xử lý lỗi kỹ thuật và tiếp nhận bảo hành/sửa chữa. Liên hệ qua Hotline, Zalo, email hoặc form &quot;Gửi yêu cầu hỗ trợ&quot; trên trang này; phản hồi trong 2–4 giờ làm việc (trong giờ hành chính).
                  </p>
                </div>
                <div className={styles["support-page-page__modal-overview-visual"]}>
                  <div className={styles["support-page-page__modal-overview-visual-image"]} />
                  <div className={styles["support-page-page__modal-overview-visual-chip"]}>Support</div>
                </div>
              </section>
              <div className={styles["support-page-page__modal-columns"]}>
                <div className={styles["support-page-page__modal-column"]}>
                  <div className={styles["support-page-page__modal-column-header"]}>
                    <span className={styles["support-page-page__modal-column-header-icon--success"]} aria-hidden="true"><MdChecklist /></span>
                    <h3 className={styles["support-page-page__modal-column-header-title"]}>Phạm vi hỗ trợ</h3>
                  </div>
                  <ul className={styles["support-page-page__modal-list"]}>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span className={styles["support-page-page__modal-list-icon--success"]} aria-hidden="true"><MdCheckCircle /></span>
                      <span>Tư vấn chọn thiết bị, setup phòng nghe theo ngân sách và diện tích.</span>
                    </li>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span className={styles["support-page-page__modal-list-icon--success"]} aria-hidden="true"><MdCheckCircle /></span>
                      <span>Hướng dẫn kết nối, cài đặt driver, nâng cấp firmware.</span>
                    </li>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span className={styles["support-page-page__modal-list-icon--success"]} aria-hidden="true"><MdCheckCircle /></span>
                      <span>Lắp đặt tại nhà theo lịch hẹn (một số khu vực xa có thể phát sinh phụ phí di chuyển).</span>
                    </li>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span className={styles["support-page-page__modal-list-icon--success"]} aria-hidden="true"><MdCheckCircle /></span>
                      <span>Xử lý lỗi kỹ thuật: không ra tiếng, méo tiếng, nhiễu; hướng dẫn từ xa hoặc hẹn kiểm tra.</span>
                    </li>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span className={styles["support-page-page__modal-list-icon--success"]} aria-hidden="true"><MdCheckCircle /></span>
                      <span>Tiếp nhận bảo hành, sửa chữa theo chính sách và quy định từng thương hiệu.</span>
                    </li>
                  </ul>
                </div>
                <div className={styles["support-page-page__modal-column"]}>
                  <div className={styles["support-page-page__modal-column-header"]}>
                    <span className={styles["support-page-page__modal-column-header-icon--success"]} aria-hidden="true"><MdSchedule /></span>
                    <h3 className={styles["support-page-page__modal-column-header-title"]}>Kênh liên hệ & thời gian</h3>
                  </div>
                  <ul className={styles["support-page-page__modal-list"]}>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span className={styles["support-page-page__modal-list-icon--success"]} aria-hidden="true"><MdCheckCircle /></span>
                      <span>Hotline: 1900 88 99 00.</span>
                    </li>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span className={styles["support-page-page__modal-list-icon--success"]} aria-hidden="true"><MdCheckCircle /></span>
                      <span>Zalo Official Account: Đức Uy Audio (OA).</span>
                    </li>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span className={styles["support-page-page__modal-list-icon--success"]} aria-hidden="true"><MdCheckCircle /></span>
                      <span>Email: support@ducuyaudio.vn.</span>
                    </li>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span className={styles["support-page-page__modal-list-icon--success"]} aria-hidden="true"><MdCheckCircle /></span>
                      <span>Form &quot;Gửi yêu cầu hỗ trợ&quot; ngay trên trang Hỗ trợ.</span>
                    </li>
                    <li className={styles["support-page-page__modal-list-item"]}>
                      <span className={styles["support-page-page__modal-list-icon--success"]} aria-hidden="true"><MdCheckCircle /></span>
                      <span>Giờ làm việc: 08:00–21:00 (Thứ 2 – Chủ nhật). Phản hồi dự kiến trong 2–4 giờ làm việc.</span>
                    </li>
                  </ul>
                </div>
              </div>
              <section className={styles["support-page-page__modal-steps"]}>
                <h3 className={styles["support-page-page__modal-steps-title"]}>Quy trình hỗ trợ</h3>
                <div className={styles["support-page-page__modal-steps-track"]} aria-hidden="true" />
                <div className={styles["support-page-page__modal-steps-grid"]}>
                  <div className={styles["support-page-page__modal-step-card"]}>
                    <div className={styles["support-page-page__modal-step-number"]}>1</div>
                    <span className={styles["support-page-page__modal-step-title"]}>Liên hệ</span>
                    <span className={styles["support-page-page__modal-step-description"]}>Gọi Hotline, nhắn Zalo hoặc gửi form &quot;Gửi yêu cầu hỗ trợ&quot; với nội dung ngắn gọn.</span>
                  </div>
                  <div className={styles["support-page-page__modal-step-card"]}>
                    <div className={styles["support-page-page__modal-step-number"]}>2</div>
                    <span className={styles["support-page-page__modal-step-title"]}>Mô tả vấn đề</span>
                    <span className={styles["support-page-page__modal-step-description"]}>Cung cấp mã đơn hàng hoặc serial thiết bị (nếu có), ảnh hoặc video minh họa lỗi để kỹ thuật nắm nhanh.</span>
                  </div>
                  <div className={styles["support-page-page__modal-step-card"]}>
                    <div className={styles["support-page-page__modal-step-number"]}>3</div>
                    <span className={styles["support-page-page__modal-step-title"]}>Hướng dẫn / Kiểm tra</span>
                    <span className={styles["support-page-page__modal-step-description"]}>Kỹ thuật viên hướng dẫn từ xa hoặc hẹn lịch kiểm tra, lắp đặt tại nhà tùy tình huống.</span>
                  </div>
                  <div className={styles["support-page-page__modal-step-card"]}>
                    <div className={styles["support-page-page__modal-step-number"]}>4</div>
                    <span className={styles["support-page-page__modal-step-title"]}>Giải quyết & bàn giao</span>
                    <span className={styles["support-page-page__modal-step-description"]}>Sửa chữa, bảo hành hoặc thay thế theo chính sách; bàn giao lại và hướng dẫn sử dụng nếu cần.</span>
                  </div>
                </div>
              </section>
              <section className={styles["support-page-page__modal-support"]}>
                <div className={styles["support-page-page__modal-support-inner"]}>
                  <div className={styles["support-page-page__modal-support-left"]}>
                    <div className={styles["support-page-page__modal-support-agent"]}><span aria-hidden="true"><MdSupportAgent /></span></div>
                    <div>
                      <h4 className={styles["support-page-page__modal-support-title"]}>Liên hệ ngay</h4>
                      <p className={styles["support-page-page__modal-support-description"]}>Hotline, Zalo hoặc form bên dưới</p>
                    </div>
                  </div>
                  <div className={styles["support-page-page__modal-support-actions"]}>
                    <a href="tel:1900889900" className={styles["support-page-page__modal-support-primary"]}>
                      <MdCall aria-hidden="true" /><span>Hotline: 1900 88 99 00</span>
                    </a>
                    <button type="button" className={styles["support-page-page__modal-support-secondary"]} onClick={() => { setIsTechSupportModalOpen(false); scrollToContact(); }}>
                      <MdChat aria-hidden="true" /><span>Cuộn đến form liên hệ</span>
                    </button>
                  </div>
                </div>
              </section>
            </div>
            <footer className={styles["support-page-page__modal-footer"]}>
              <span>© 2024 Đức Uy Audio - Hi-End Excellence</span>
              <span>Cập nhật lần cuối: 03/2024</span>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SupportPageRoute() {
  return (
    <Suspense fallback={null}>
      <SupportPage />
    </Suspense>
  );
}
