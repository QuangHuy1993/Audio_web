# Workflow: Chuẩn hoá icon về react-icons

**Mục tiêu:**  
Loại bỏ hoàn toàn việc dùng icon dạng font (đặc biệt `material-symbols-outlined` / Material Icons inline) trong dự án, chuyển toàn bộ sang `react-icons` để:
- Đồng bộ stack UI
- Dễ kiểm soát tree-shaking / bundle size
- Không phụ thuộc CSS/font ngoài (như CDN của Google/Meta)

---

## 1. Scan hiện trạng – nơi đang dùng icon font

Dưới đây là những nơi hiện tại còn dùng icon kiểu Material / font, không phải `react-icons`.

### 1.1 `src/app/not-found.tsx`

```73:84:src/app/not-found.tsx
<span className={`material-symbols-outlined ${styles["not-found-page__icon"]}`}>
  sentiment_dissatisfied
</span>
...
<span className={`material-symbols-outlined ${styles["not-found-page__icon"]}`}>
  home
</span>
```

- Sử dụng `material-symbols-outlined` trực tiếp trong JSX.
- Class CSS `not-found-page__icon` hiện style icon theo font Material.

### 1.2 `src/components/shared/FloatingAiChatButton.tsx` + CSS

```49:51:src/components/shared/FloatingAiChatButton.tsx
<span className="material-symbols-outlined">auto_awesome</span>
```

```51:55:src/components/shared/FloatingAiChatButton.module.css
.floating-ai-chat-button__icon .material-symbols-outlined {
  font-size: 20px;
  line-height: 1;
}
```

- Nút AI chat nổi đang dùng span Material Icons, trong khi phần còn lại của UI thường dùng `react-icons` (Md*, Fa*).

### 1.3 `src/app/support/page.tsx`

```1525:1718:src/app/support/page.tsx
<span
  className={styles["support-page-page__modal-overview-duration-icon"]}
  aria-hidden="true"
>
  …
</span>
...
<span className={styles["support-page-page__modal-overview-duration-icon"]} aria-hidden="true">
  <MdSell />
</span>
<span className={styles["support-page-page__modal-overview-duration-icon"]} aria-hidden="true">
  <MdSettingsSuggest />
</span>
```

- Một số chỗ trong modal support dùng `span` rỗng chỉ để chứa icon React (OK).
- Tuy nhiên CSS có thể đang giả định font icon; cần kiểm tra `page.module.css` để đảm bảo không còn rule dành riêng cho `material-symbols-outlined`. (Hiện tại kết quả grep không thấy chuỗi đó trong file CSS support, nên phần này chủ yếu là đặt tên class, không phải font icon.)

### 1.4 `src/app/checkout/qr-debug` (đã xoá)

File debug cũ đã bị xoá, bên trong có nhiều `material-symbols-outlined`. Không còn ảnh hưởng sau khi xoá route:
- `src/app/checkout/qr-debug/page.tsx`
- `src/app/checkout/qr-debug/page.module.css`

> Không cần xử lý thêm trong workflow này.

---

## 2. Chuẩn hoá target – chỉ dùng react-icons ở đâu?

Quy ước cho toàn dự án:

- **Thư viện icon duy nhất**: `react-icons`.
- Set chủ đạo:
  - Material Icons: `react-icons/md` (Md…)
  - Feather / outline tuỳ chọn: `react-icons/fi` / `react-icons/ai` / `react-icons/fa` tuỳ ngữ cảnh.
- Không dùng:
  - `<span className="material-symbols-outlined">…</span>`
  - `<i className="fa fa-…"/>` (hiện chưa thấy, nhưng quy ước là không được dùng).
- Với những icon trong design tài liệu (Google Material) → map sang icon gần nghĩa nhất trong `react-icons/md`.

---

## 3. Mapping đề xuất từ Material font → react-icons

### 3.1 `not-found` page

| Vị trí | Hiện tại (Material text) | react-icons đề xuất (`react-icons/md`) |
|-------|---------------------------|----------------------------------------|
| Icon lớn 404 | `sentiment_dissatisfied` | `MdSentimentDissatisfied` |
| Icon home | `home` | `MdHome` |

### 3.2 `FloatingAiChatButton`

| Vị trí | Hiện tại | react-icons đề xuất |
|--------|----------|----------------------|
| Biểu tượng AI sparkles | `auto_awesome` | `MdAutoAwesome` (hoặc `MdPsychology`, `MdAutoFixHigh` tuỳ style, nhưng repo đã dùng `MdAutoFixHigh` ở chỗ khác) |

- Để đồng bộ với phần còn lại (nút AI ở admin đang dùng `MdAutoFixHigh` / `MdPsychology`), có thể chọn:
  - `MdAutoAwesome` cho cảm giác “magic sparkles”, hoặc
  - `MdPsychology` nếu muốn bám theme “AI tư vấn”.

Ở đây đề xuất:
- `FloatingAiChatButton` dùng `MdAutoAwesome` (nhấn mạnh hiệu ứng “auto suggestion”).

---

## 4. Kế hoạch chỉnh sửa chi tiết

### 4.1 `src/app/not-found.tsx`

**Mục tiêu:** bỏ hoàn toàn `material-symbols-outlined`, dùng `react-icons/md`.

**Bước thực hiện:**

1. Thêm import:

```tsx
import { MdSentimentDissatisfied, MdHome } from "react-icons/md";
```

2. Thay các span:

```tsx
// Trước
<span className={`material-symbols-outlined ${styles["not-found-page__icon"]}`}>
  sentiment_dissatisfied
</span>

// Sau
<span className={styles["not-found-page__icon"]} aria-hidden="true">
  <MdSentimentDissatisfied />
</span>
```

```tsx
// Trước
<span className={`material-symbols-outlined ${styles["not-found-page__icon"]}`}>
  home
</span>

// Sau
<span className={styles["not-found-page__icon"]} aria-hidden="true">
  <MdHome />
</span>
```

3. Kiểm tra `not-found.module.css`:
   - Nếu có rule nhắm vào `.material-symbols-outlined`, xoá hoặc chuyển sang style trực tiếp cho `.not-found-page__icon svg`.

Ví dụ:

```css
/* Nếu tồn tại: */
.not-found-page__icon.material-symbols-outlined { ... }

/* Chuyển thành: */
.not-found-page__icon svg {
  width: 32px;
  height: 32px;
}
```

### 4.2 `src/components/shared/FloatingAiChatButton.tsx`

**Mục tiêu:** dùng `react-icons` thay vì Material span.

**Bước thực hiện:**

1. Thêm import:

```tsx
import { MdAutoAwesome } from "react-icons/md";
```

2. Chỉnh JSX:

```tsx
// Trước
<span className="material-symbols-outlined">auto_awesome</span>

// Sau
<span className={styles["floating-ai-chat-button__icon"]} aria-hidden="true">
  <MdAutoAwesome />
</span>
```

> Lưu ý: Hiện tại code đang dùng trực tiếp class `"floating-ai-chat-button__icon"` ở wrapper ngoài; chỉ cần loại bỏ `material-symbols-outlined` khỏi markup.

3. Cập nhật CSS `FloatingAiChatButton.module.css`:

```css
/* Trước */
.floating-ai-chat-button__icon .material-symbols-outlined {
  font-size: 20px;
  line-height: 1;
}

/* Sau – áp dụng cho svg react-icons */
.floating-ai-chat-button__icon svg {
  width: 20px;
  height: 20px;
}
```

### 4.3 Support page – rà soát icon

Dù grep không thấy `material-symbols-outlined` trong CSS support, cần đảm bảo không còn icon font:

1. Mở `src/app/support/page.tsx` và `page.module.css`, kiểm tra thủ công xem có:
   - `<span className="material-symbols-outlined">...</span>`
   - `<i className=...>` hoặc `className="fa fa-..."`
2. Nếu có:
   - Map từng icon sang `react-icons/md` hoặc set khác phù hợp.
   - Xoá mọi rule CSS dùng selector `.material-symbols-outlined` / `.fa` / `.bi` và thay bằng selector `.support-page-page__xxx svg`.

Hiện tại dựa trên grep, phần support chủ yếu đã dùng `<MdSell />`, `<MdSettingsSuggest />` nên không cần đổi; bước này chỉ là checklist khi review thêm.

---

## 5. Validate & Test

### 5.1 Lint & type-check

- Chạy `npm run lint`:
  - Không còn warning `material-symbols-outlined` không dùng, không còn JSX text icon.
- TypeScript:
  - Import từ `react-icons/md` không gây lỗi.

### 5.2 Kiểm tra UI

#### TC-ICON-001: 404 page

- **Bước**:
  - Vào URL không tồn tại (`/some/non-existing-route`).
  - Quan sát icon mặt buồn và icon home.
- **Kỳ vọng**:
  - Cả hai icon vẻ ngoài tương đương trước đây (kích thước, màu).
  - Không thấy text `sentiment_dissatisfied` hoặc `home` hiện ra trên UI.

#### TC-ICON-002: Floating AI Chat Button

- **Bước**:
  - Mở trang có `FloatingAiChatButton` (ví dụ trang chính shop hoặc trang có AI chat).
  - Quan sát icon AI.
- **Kỳ vọng**:
  - Icon hiển thị là icon `MdAutoAwesome` (sparkles) hoặc icon đã chọn.
  - Không có FOUC (flash of unstyled content) do font Material tải chậm.

#### TC-ICON-003: Global asset check

- Chạy search toàn repo:

```bash
rg "material-symbols-outlined|material-icons|fa fa-|class=\\\"fa |class=\\\"bi " src
```

- **Kỳ vọng**: Không còn kết quả trùng khớp.

---

## 6. Thứ tự triển khai đề xuất

1. **not-found page**:
   - Thay icon bằng `react-icons`, cleanup CSS liên quan.
2. **FloatingAiChatButton**:
   - Thay span Material bằng `MdAutoAwesome`, chỉnh CSS.
3. **Rà soát support + các file còn lại**:
   - Search thêm trong toàn repo để bắt mọi trường hợp icon font khác (nếu có).
4. **Kiểm tra thủ công UI**:
   - 404 page, AI chat button, các page liên quan.
5. **Lint + test**:
   - `npm run lint`
   - `npm run test:run` (nếu có test liên quan đến 404 page/UI, cập nhật snapshot nếu cần).

---

## 7. Ghi chú kiến trúc

- Với `react-icons`, từng icon là một component React:
  - Có thể style trực tiếp bằng CSS (`.class svg { ... }`) hoặc `size/color` prop.
  - Tránh style dựa trên `font-size` như với icon font; tốt nhất là set `width/height` trên `svg` hoặc container.
- Về bundle size:
  - Import đúng tên cụ thể từ `react-icons/md` (không import cả module khổng lồ) đã đủ để tree-shaking.
  - Nếu sau này số lượng icon rất lớn, có thể cân nhắc lazy load theo route, nhưng hiện tại chưa cần.

---

## 8. Tiêu chí hoàn thành

- Không còn bất kỳ chuỗi `material-symbols-outlined`, `material-icons`, `class="fa ..."` trong thư mục `src/`.
- 404 page, FloatingAiChatButton, support modals vẫn hiển thị icon đúng style, không lỗi UI.
- Lint + test pass sau khi chỉnh sửa.

