# Workflow: Modal chính sách và liên kết Quick/Policy cards – Trang Hỗ trợ

Tài liệu mô tả chi tiết việc gắn từng **quick action card** và **policy card** trên trang Support với modal popup hoặc scroll, đồng thời chuẩn hóa nội dung từ nghiên cứu thực tế (TMĐT Việt Nam, cửa hàng thiết bị âm thanh).

---

## 1. Tổng quan card và hành vi

| Card | Loại | Hành vi khi click |
|------|------|-------------------|
| Câu hỏi FAQ | Quick | Scroll đến section FAQ (`#support-faq`) |
| Bảo hành | Quick + Policy | Mở modal Chính sách bảo hành (đã có) |
| Thanh toán | Quick | Mở modal Chính sách thanh toán |
| Khuyến mãi | Quick | Mở modal tóm tắt khuyến mãi + CTA đến `/promotions` |
| Hỗ trợ kỹ thuật | Quick | Mở modal Hỗ trợ kỹ thuật (nội dung + CTA liên hệ) |
| Liên hệ | Quick | Scroll đến section Liên hệ (`#support-contact`) |
| Chính sách bảo hành | Policy | Mở modal Bảo hành (đã có) |
| Chính sách đổi trả | Policy | Mở modal Chính sách đổi trả |
| Điều khoản dịch vụ | Policy | Mở modal Điều khoản dịch vụ |

---

## 2. Layout modal (dùng chung)

Mọi modal chính sách dùng **cùng cấu trúc** như modal Bảo hành hiện tại:

- **Backdrop**: `support-page-page__modal-backdrop` (fixed, overlay, click outside có thể đóng).
- **Container**: `support-page-page__modal` (max-width 960px, scroll body).
- **Header**: Icon + Title + Subtitle + Nút đóng.
- **Body**: 
  - Phần overview (2 cột: text/điều kiện + visual nếu cần).
  - Hai cột “Điều kiện áp dụng” / “Trường hợp không áp dụng” (list có icon success/danger) khi phù hợp.
  - Phần “Quy trình” dạng bước 1–4 (steps) khi có.
  - Cuối: block “Hỗ trợ” (hotline + CTA).
- **Footer**: © Đức Uy Audio + “Cập nhật lần cuối”.

Đóng modal: nút close header, click backdrop (optional, có thể thêm).

---

## 3. Nội dung từng modal (research & chuẩn)

**Mức độ chi tiết:** Tất cả modal đã được triển khai với nội dung chi tiết ngang modal Bảo hành: overview rõ, hai cột điều kiện/lưu ý khi phù hợp, quy trình từng bước (steps), block hỗ trợ cuối.

### 3.1. Chính sách bảo hành (đã có)

- Thời hạn: 12–24 tháng theo thương hiệu.
- Điều kiện: tem niêm phong, thẻ bảo hành, lỗi từ NSX.
- Từ chối: hỏa hoạn, ngập nước, tự sửa, dùng sai điện áp.
- Quy trình: Tiếp nhận → Kiểm tra → Xử lý → Bàn giao.
- Modal bảo hành: Hotline thống nhất 1900 88 99 00; nút phụ “Gửi yêu cầu” scroll đến `#support-contact`.

### 3.2. Chính sách đổi trả (Returns & Refund)

Nội dung tham chiếu luật và thực tế TMĐT Việt Nam. Modal đã có:

- **Overview:** Thời hạn 07 ngày (hoặc 03 ngày theo thương hiệu), visual chip “Fair Return”.
- **Hai cột:** Điều kiện được đổi/trả (4 mục) / Trường hợp không áp dụng (3 mục).
- **Block “Chi phí vận chuyển & hình thức hoàn tiền”:** Lỗi từ Đức Uy → 100% phí ship hai chiều; đổi do khách (nếu cho phép) → khách chịu phí gửi trả. Hoàn tiền qua chuyển khoản 5–7 ngày làm việc hoặc đổi sản phẩm mới; không hoàn tiền mặt tại cửa hàng cho đơn online. Yêu cầu kèm: mã đơn, ảnh sản phẩm (tem, lỗi), hóa đơn/phiếu xuất kho; không tháo niêm phong nếu chưa có chỉ dẫn.
- **Quy trình 4 bước** (mô tả mở rộng): Liên hệ báo lỗi → Gửi ảnh/chứng từ → Kiểm tra & thông báo phương án → Hoàn tiền/Đổi hàng (5–7 ngày làm việc).

### 3.3. Chính sách thanh toán (Payment)

Nội dung tham chiếu cửa hàng thiết bị âm thanh. Modal đã có:

- **Overview + visual** chip “Secure”; hai cột “Hình thức áp dụng” / “Lưu ý”.
- **Block “Hướng dẫn chuyển khoản”:** Nội dung CK bắt buộc: mã đơn + họ tên người nhận; hoàn tất 24–48h; gửi biên lai để xác nhận; STK trong email xác nhận đơn; đơn chưa thanh toán sau 24–48h có thể bị hủy.
- **Quy trình 3 bước** (mô tả mở rộng): Đặt hàng → Thanh toán (CK/COD/Showroom) → Xác nhận & giao hàng.

### 3.4. Điều khoản dịch vụ (Terms of Service)

Layout 1 cột văn bản, nội dung chi tiết:

- **Overview:** Phạm vi áp dụng (1 đoạn).
- **Các mục:** Giá, hóa đơn (Nghị định 123/2020), thanh toán; Giao nhận và kiểm tra (số lượng, chủng loại, tình trạng; khiếu nại vận chuyển 24–48h); Bảo hành (dẫn chiếu chính sách); **Quyền và trách nhiệm** tách thành hai list: Quyền (thông tin đúng, bảo mật dữ liệu, khiếu nại); Trách nhiệm (thông tin chính xác, bảo mật tài khoản, sử dụng đúng mục đích, tuân thủ pháp luật); Bảo mật (thu thập tối thiểu, không bán thông tin); Bất khả kháng (thiên tai, dịch bệnh, chiến sự, hạ tầng; thông báo, gia hạn); Tranh chấp (thương lượng; pháp luật VN; Tòa án/Trọng tài).

### 3.5. Khuyến mãi (Promotions)

Modal đầy đủ sections như Bảo hành:

- **Overview 2 cột:** Text (loại ưu đãi, điều kiện, mỗi đơn một mã) + visual chip “Promo”.
- **Hai cột:** “Cách áp dụng & loại ưu đãi” (mã %/số tiền, giảm theo đơn, quà tặng, combo; nhập mã & Áp dụng; xem trang Khuyến mãi) / “Lưu ý & lỗi thường gặp” (mã hết hạn/hết lượt; đơn chưa đạt tối thiểu; sản phẩm không thuộc danh mục; mã không cộng dồn).
- **Quy trình 4 bước:** Xem chương trình → Chọn sản phẩm → Vào thanh toán → Nhập mã & áp dụng.
- **CTA:** “Đến trang Khuyến mãi” → `router.push('/promotions')`.

### 3.6. Hỗ trợ kỹ thuật (Technical support)

Modal đầy đủ sections như Bảo hành:

- **Overview 2 cột:** Text (tư vấn setup, lắp đặt, hướng dẫn, lỗi, bảo hành/sửa chữa; kênh liên hệ; phản hồi 2–4h) + visual chip “Support”.
- **Hai cột:** “Phạm vi hỗ trợ” (tư vấn thiết bị & setup; driver/firmware; lắp đặt tại nhà; lỗi không tiếng/méo/nhiễu; bảo hành/sửa chữa) / “Kênh liên hệ & thời gian” (Hotline, Zalo OA, email, form; giờ 08:00–21:00 T2–CN; phản hồi 2–4h).
- **Quy trình 4 bước:** Liên hệ → Mô tả vấn đề (mã đơn/serial, ảnh/video) → Hướng dẫn/Kiểm tra → Giải quyết & bàn giao.
- **CTA:** Hotline + “Cuộn đến form liên hệ”.

---

## 4. Scroll targets (ID trong page)

- Section FAQ: thêm `id="support-faq"` cho `<section className={...} support-page-page__faq-section>`.
- Section Liên hệ (policy-contact-section): thêm `id="support-contact"` cho section chứa “Liên hệ trực tiếp” và form.

Quick card “Câu hỏi FAQ” → `document.getElementById('support-faq')?.scrollIntoView({ behavior: 'smooth' })`.
Quick card “Liên hệ” → `document.getElementById('support-contact')?.scrollIntoView({ behavior: 'smooth' })`.

---

## 5. State và handler (React)

- `isWarrantyModalOpen` (đã có).
- `isReturnsModalOpen`, `isPaymentModalOpen`, `isTermsModalOpen`, `isPromoModalOpen`, `isTechSupportModalOpen`.
- Handlers:
  - Quick FAQ: scroll to `#support-faq`.
  - Quick Liên hệ: scroll to `#support-contact`.
  - Quick Bảo hành: `setIsWarrantyModalOpen(true)`.
  - Quick Thanh toán: `setIsPaymentModalOpen(true)`.
  - Quick Khuyến mãi: `setIsPromoModalOpen(true)`.
  - Quick Hỗ trợ kỹ thuật: `setIsTechSupportModalOpen(true)`.
  - Policy “Chính sách đổi trả” (Xem chi tiết): `setIsReturnsModalOpen(true)`.
  - Policy “Điều khoản dịch vụ” (Xem chi tiết): `setIsTermsModalOpen(true)`.

---

## 6. File cần chỉnh

- `src/app/support/page.tsx`: thêm state, ref/scroll, onClick từng quick/policy card; thêm 5 modal (Returns, Payment, Terms, Promo, TechSupport); thêm `id="support-faq"` và `id="support-contact"`.
- `src/app/support/page.module.css`: dùng lại toàn bộ class modal hiện có; nếu modal “Điều khoản” cần block văn bản dài có thể thêm class `support-page-page__modal-body--text` (optional).

---

## 7. Kiểm tra (test cases)

1. Click từng quick card: FAQ/Liên hệ scroll đúng section; Bảo hành/Thanh toán/Khuyến mãi/Hỗ trợ kỹ thuật mở đúng modal.
2. Click “Xem chi tiết” từng policy card: Bảo hành → warranty modal; Đổi trả → returns modal; Điều khoản → terms modal.
3. Trong modal Khuyến mãi, nút “Xem tất cả khuyến mãi” chuyển đến `/promotions`.
4. Đóng modal: nút close đóng đúng; nội dung modal đọc được, layout giống thiết kế (header, 2 cột, steps, footer).
5. Responsive: modal max-height 90vh, body scroll; trên mobile không vỡ layout.

---

## 8. Nguồn tham khảo nội dung

- Đổi trả: Luật bảo vệ quyền lợi người tiêu dùng, thực tế Shopee/Tiki (thời hạn 7–15 ngày, điều kiện sản phẩm, chi phí ship).
- Thanh toán: Các trang Hi-Sound Audio, Bảo Tín Audio, NY Audio Store (chuyển khoản, COD, quẹt thẻ, trả góp).
- Điều khoản: Mẫu điều khoản TMĐT (FPT Shop, Thư viện pháp luật), bao gồm phạm vi, giá, giao nhận, bảo mật, bất khả kháng, tranh chấp.
