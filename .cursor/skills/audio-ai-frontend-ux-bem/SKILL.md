---
name: audio-ai-frontend-ux-bem
description: Guides the agent to design and implement modern, accessible UI for the Audio AI Shop project using Next.js and React, applying BEM-based CSS naming, shadcn UI components, and project-specific UX patterns without using emojis.
---

# Audio AI Frontend UX & BEM

## Mục đích

Hướng dẫn agent khi làm việc với phần frontend/UI của Audio AI Shop:
- Thiết kế giao diện hiện đại, dễ dùng cho trang bán thiết bị âm thanh.
- Áp dụng CSS BEM với quy tắc gắn tên block với tên file và chức năng.
- Sử dụng shadcn UI, Framer Motion, Skeleton theo đúng tinh thần dự án.
- Đảm bảo không dùng emoji trong text UI, comment, hoặc mô tả.

Skill này luôn phải tuân theo rule gốc `audio-ai-shop-core.mdc`.

## Khi nào dùng skill này

Agent nên áp dụng skill này khi:
- Người dùng yêu cầu:
  - Thiết kế hoặc cải thiện UI/UX của một trang hoặc component.
  - Thêm component mới cho sản phẩm, giỏ hàng, đánh giá, AI tư vấn, admin dashboard.
  - Chỉnh sửa hoặc tối ưu layout, responsive, alignment, spacing.
- Cần hướng dẫn rõ ràng về:
  - Đặt tên BEM.
  - Tổ chức component UI theo `components/` và `features/`.
  - Cách dùng shadcn UI và Framer Motion một cách hợp lý.

## Nguyên tắc UI/UX cho Audio AI Shop

- Giao diện:
  - Tập trung vào **thiết bị âm thanh**: hình ảnh sắc nét, thông tin chính (tên, giá, rating, công suất, loại thiết bị).
  - Nhấn mạnh tính năng **AI tư vấn / gợi ý / so sánh** như một điểm nổi bật.
  - Layout rõ ràng: header, navigation, nội dung chính, footer.
- Trải nghiệm:
  - Hành động chính (thêm giỏ hàng, nhận tư vấn AI, so sánh) phải dễ nhìn và dễ bấm.
  - Loading state có skeleton, tránh nháy layout đột ngột.
  - Thông báo lỗi hoặc empty phải rõ ràng, không mơ hồ.
- Ngôn ngữ:
  - Không sử dụng emoji.
  - Text ngắn gọn, dễ đọc, thống nhất giọng điệu.

## Quy tắc CSS BEM cho dự án

- Block:
  - Dùng dạng `{ten-file-khong-duoi}-{chuc-nang}`, tất cả chữ thường, kebab-case.
  - Ví dụ:
    - File `product-card.tsx` dùng block `product-card-card`.
    - File `ai-advice-panel.tsx` dùng block `ai-advice-panel-panel`.
- Element:
  - `{block}__{ten-element}`, ví dụ: `product-card-card__image`, `ai-advice-panel-panel__header`.
- Modifier:
  - `{block}--{modifier}` hoặc `{block}__{element}--{modifier}`.
  - Ví dụ: `product-card-card--featured`, `product-card-card__price--highlight`.
- File CSS/module:
  - Mỗi component chính nên có file CSS/module gắn với tên file của component.
  - Không để style tự do trong global trừ khi thực sự là global (body, html, root layout).
- Không dùng selector quá rộng, tránh ảnh hưởng ngoài ý muốn:
  - Hạn chế dùng selector kiểu `div > p`, `section h2` cho component cụ thể; ưu tiên class BEM.

## Tổ chức component frontend

- `src/components/ui`:
  - Chứa các component nền tảng, thường là wrapper hoặc custom hóa từ shadcn UI.
  - Ví dụ: button, input, select, card base, modal, drawer.
- `src/components/layout`:
  - Chứa layout chung như header, footer, navbar, sidebar, shell admin.
- `src/components/shared`:
  - Component dùng lại giữa nhiều domain: breadcrumb, section title, grid wrapper.
- `src/features/<domain>/components`:
  - Component gắn với domain cụ thể như `product`, `cart`, `ai`, `order`, `auth`.
  - Ví dụ:
    - `src/features/product/components/ProductCard.tsx`
    - `src/features/cart/components/CartItem.tsx`
    - `src/features/ai/components/AiAdvicePanel.tsx`

## shadcn UI, Framer Motion, Skeleton

- shadcn UI:
  - Dùng làm nền cho form, button, card, table, dialog, v.v.
  - Không chỉnh sửa trực tiếp file thư viện; nếu cần cấu hình mặc định, tạo wrapper trong `components/ui`.
  - Kết hợp với BEM bằng cách:
    - Bọc component shadcn bằng một wrapper có class BEM của domain.
    - Không override style của shadcn bằng selector toàn cục.
- Framer Motion:
  - Dùng cho:
    - Hover effect mượt cho card.
    - Animation khi mở/đóng panel tư vấn AI, modal, drawer.
    - Transition khi filter/tìm kiếm sản phẩm.
  - Không lạm dụng: mỗi trang chỉ nên có vài animation rõ ràng, tránh gây phân tâm.
- Skeleton:
  - Mỗi màn chính nên có một bộ skeleton riêng:
    - Danh sách sản phẩm, chi tiết sản phẩm, giỏ hàng, đơn hàng, màn AI tư vấn.
  - Implement skeleton dưới dạng component riêng để dễ tái sử dụng.

## Checklist khi tạo/chỉnh sửa UI

Khi agent làm việc với UI mới hoặc refactor:

1. **Tên component và file**
   - Tên file phản ánh domain + chức năng (không dùng `component.tsx`, `index.tsx` chung chung).
   - Tên component là PascalCase và mô tả rõ (ví dụ `ProductFilterBar`, `AiComparisonPanel`).
2. **BEM**
   - Đã chọn block dựa trên tên file + chức năng.
   - Element và modifier đặt đúng quy tắc.
   - Không dùng class tên chung chung như `.wrapper`, `.container` mà không gắn với block.
3. **Layout & UX**
   - Kiểm tra trạng thái loading, empty, error.
   - Đảm bảo các hành động chính rõ ràng, dễ click trên desktop và mobile.
4. **Tương tác**
   - Khi dùng Framer Motion, đảm bảo animation không làm nặng UI.
   - Các interaction (hover, focus, click) đều nhất quán.
5. **Text và accessibility**
   - Không dùng emoji.
   - Sử dụng heading hợp lý (h1–h3), alt text cho ảnh quan trọng, aria-label khi cần.

## Ví dụ tình huống sử dụng

- Người dùng yêu cầu:
  - “Thiết kế lại trang danh sách sản phẩm cho đẹp và rõ ràng hơn.”
  - “Thêm panel tư vấn AI bên phải trang chi tiết sản phẩm.”
  - “Refactor CSS cho component giỏ hàng để tránh trùng class.”
- Agent:
  - Dùng skill này để:
    - Chọn cấu trúc component, đặt tên file, đặt BEM class.
    - Quyết định chỗ dùng shadcn UI, chỗ cần Framer Motion, chỗ dùng skeleton.
    - Đảm bảo tuân thủ toàn bộ quy tắc UI/UX và BEM đã đặt ra.

