# Workflow: Log phiên AI (AiSession)

Tài liệu mô tả mục đích model `AiSession` trong DB, nguyên tắc ghi/đọc, thiết kế service, API và truy vấn tối ưu để triển khai sau.

---

## 1. Mục đích AiSession trong dự án

- **AiSession** dùng để **ghi log mỗi lần người dùng (phía shop) tương tác với tính năng AI** của Đức Uy Audio:
  - **ADVICE**: Tư vấn sản phẩm theo ngân sách, không gian, mục đích sử dụng.
  - **RECOMMENDATION**: Gợi ý sản phẩm liên quan.
  - **COMPARISON**: So sánh thiết bị âm thanh.
  - **SEARCH**: Tìm kiếm thông minh (semantic / natural language).
- **Không dùng** cho các luồng AI nội bộ admin (gợi ý coupon, SEO brand/category/product): những luồng đó không cần lưu từng phiên vào AiSession.
- **Lợi ích**:
  - Phân tích hành vi: loại tương tác nào được dùng nhiều, theo thời gian.
  - Audit: ai (userId) dùng gì, khi nào (nếu đăng nhập).
  - Cải thiện prompt và model dựa trên input/output thực tế.
  - (Tuỳ chọn) Hiển thị "Lịch sử tư vấn AI" cho user đăng nhập.

---

## 2. Schema và index hiện tại (prisma/schema.prisma)

Trích lược:

```prisma
enum AiSessionType {
  ADVICE
  RECOMMENDATION
  COMPARISON
  SEARCH
}

model AiSession {
  id        String        @id @default(cuid())
  userId    String?       // null = khách vãng lai
  type      AiSessionType
  input     String        // Câu hỏi / từ khoá / context user gửi
  output    String        // Phản hồi từ AI (text hoặc JSON string)
  model     String?       // Tên model đã gọi (vd: "llama-3.1-8b-instant")
  metadata  Json?         // Dữ liệu bổ sung: productIds gợi ý, token count, latency ms, v.v.

  user      User?         @relation(fields: [userId], references: [id])

  createdAt DateTime      @default(now())

  @@index([userId, createdAt])
  @@index([type, createdAt])
}
```

- **userId nullable**: Cho phép ghi session khi khách chưa đăng nhập; khi đăng nhập có thể gán `userId` để truy vấn theo user.
- **input / output**: Lưu dạng text; nếu output là cấu trúc (vd danh sách productId), có thể lưu JSON string hoặc đưa vào `metadata`.
- **metadata**: Linh hoạt cho analytics (số token, thời gian phản hồi, productIds trả về, lỗi hay không).
- **Index**:
  - `[userId, createdAt]`: Truy vấn "lịch sử AI của user X", phân trang theo thời gian.
  - `[type, createdAt]`: Truy vấn "tất cả phiên ADVICE/SEARCH/... trong khoảng thời gian", báo cáo admin.

---

## 3. Nguyên tắc thiết kế workflow

- **Ghi log đúng thời điểm**: Chỉ ghi **sau khi** đã có kết quả AI thành công (hoặc sau khi đã xử lý lỗi và quyết định lưu hay không). Không ghi khi request mới vào.
- **Một nguồn ghi**: Mọi ghi AiSession đều đi qua **một service** (vd `ai-session-service.ts`) để thống nhất format input/output/metadata và tránh rải rác logic.
- **Không block luồng chính**: Ghi log nên **không** làm chậm response trả về user. Có thể:
  - Ghi đồng bộ nhưng nhanh (insert đơn giản), hoặc
  - Ghi bất đồng bộ (fire-and-forget / queue) nếu sau này volume lớn.
- **Giới hạn kích thước**: Đặt giới hạn độ dài `input` và `output` (vd 5000 ký tự mỗi trường) để tránh blob quá lớn ảnh hưởng DB và truy vấn. Cắt bớt hoặc lưu tóm tắt nếu vượt.
- **Phân biệt shop vs admin**: API/shop (tư vấn, gợi ý, so sánh, tìm kiếm) sau khi gọi AI **gọi service ghi AiSession**. API admin (coupon AI, brand/category/product SEO) **không** ghi AiSession.

---

## 4. Service đề xuất: `ai-session-service.ts`

File gợi ý: `src/services/ai-session-service.ts`.

### 4.1. Kiểu dữ liệu

- **CreateAiSessionInput** (nội bộ service / gọi từ API):
  - `userId?: string | null` – từ session, null nếu khách.
  - `type: AiSessionType` – ADVICE | RECOMMENDATION | COMPARISON | SEARCH.
  - `input: string` – đã cắt/trim theo giới hạn (vd 5000).
  - `output: string` – đã cắt theo giới hạn.
  - `model?: string | null`.
  - `metadata?: Record<string, unknown> | null` – object JSON nhẹ (không lưu blob lớn).

- **ListAiSessionsInput** (cho API list):
  - `userId?: string | null` – nếu có: lọc theo user (cho "lịch sử của tôi"); nếu admin: có thể không truyền để xem tất cả.
  - `type?: AiSessionType | null` – lọc theo loại.
  - `fromAt?: Date | null`, `toAt?: Date | null` – khoảng thời gian (dùng cho index `createdAt`).
  - `page: number`, `pageSize: number` – phân trang (pageSize tối đa vd 50).

- **AiSessionListItem** (DTO trả về cho list):
  - `id`, `userId`, `type`, `createdAt`.
  - `inputPreview`: 100–200 ký tự đầu của `input` (không trả full input/output trong list để nhẹ).
  - (Tuỳ chọn) `outputPreview` hoặc bỏ để giảm payload.

### 4.2. Hàm chính

- **createAiSession(data: CreateAiSessionInput): Promise<AiSession>**
  - Trim và cắt `input`/`output` tối đa N ký tự (vd 5000).
  - Nếu `metadata` có trường quá lớn, bỏ qua hoặc chỉ lưu vài key quan trọng.
  - `prisma.aiSession.create({ data: { userId, type, input, output, model, metadata } })`.
  - Trả về bản ghi vừa tạo (hoặc chỉ id nếu không cần).

- **listAiSessions(params: ListAiSessionsInput): Promise<{ items: AiSessionListItem[], total: number }>**
  - Build `where`:
    - Nếu có `userId`: `where.userId = userId`.
    - Nếu có `type`: `where.type = type`.
    - Nếu có `fromAt`: `where.createdAt >= fromAt`.
    - Nếu có `toAt`: `where.createdAt <= toAt`.
  - Dùng `orderBy: { createdAt: 'desc' }` để dùng index.
  - Phân trang: `skip: (page - 1) * pageSize`, `take: pageSize`.
  - Select đủ để map sang AiSessionListItem (có thể dùng raw `input.substring(0, 200)` ở tầng DB hoặc cắt ở app sau khi select).
  - Đếm tổng: `prisma.aiSession.count({ where })` với cùng `where` (có thể tách query để tránh select quá nặng).

### 4.3. Giới hạn kích thước và bảo vệ

- Hằng số: `MAX_INPUT_LENGTH = 5000`, `MAX_OUTPUT_LENGTH = 5000` (hoặc 10000 nếu cần).
- Trước khi `create`: `input = input.slice(0, MAX_INPUT_LENGTH)`, `output = output.slice(0, MAX_OUTPUT_LENGTH)`.
- `metadata`: Giới hạn số key (vd 20) và độ sâu (vd 2), không lưu file/base64.

---

## 5. API đề xuất

### 5.1. Ghi log (gọi nội bộ từ API AI shop)

- **Không** tạo route POST công khai cho client gửi log. Việc ghi log do **server** thực hiện sau khi gọi AI.
- Luồng gợi ý:
  1. Client gọi API shop AI, vd `POST /api/shop/ai/advice` (body: câu hỏi, ngân sách, v.v.).
  2. Handler:
     - Gọi service AI (advice) để sinh output.
     - Nếu thành công: gọi `createAiSession({ userId: session?.user?.id ?? null, type: 'ADVICE', input, output, model, metadata })`.
     - Trả response cho client (output AI).
  - Tương tự cho RECOMMENDATION, COMPARISON, SEARCH khi có các route tương ứng.

### 5.2. Lịch sử phiên AI của user (shop)

- **GET /api/shop/ai/sessions** (hoặc `/api/me/ai-sessions` nếu có nhóm /me).
  - Chỉ dành cho user đăng nhập (session có userId).
  - Query: `page`, `pageSize`, `type?` (ADVICE | RECOMMENDATION | COMPARISON | SEARCH).
  - Gọi `listAiSessions({ userId: session.user.id, type, page, pageSize })`.
  - Trả về `{ items: AiSessionListItem[], total }` (có thể thêm `page`, `pageSize` cho client).
  - Không trả full `output` nếu list dài; có thể có route GET chi tiết một session sau.

### 5.3. Admin – Xem / phân tích log AI (read-only)

- **GET /api/admin/ai-sessions**
  - Chỉ role ADMIN.
  - Query: `page`, `pageSize`, `userId?`, `type?`, `fromAt?`, `toAt?`.
  - Gọi `listAiSessions` với params tương ứng (không truyền userId nếu admin xem tất cả).
  - Trả về danh sách + total; có thể thêm cột email/user qua join User nếu cần.
- **GET /api/admin/ai-sessions/[id]** (tuỳ chọn)
  - Chi tiết một phiên: full input, output, metadata, createdAt, user.
  - Dùng cho debug và phân tích prompt.

---

## 6. Tối ưu truy vấn DB và hiệu năng

- **Insert (create)**:
  - Một lần `create` với ít trường, không join. Index không cần cho insert; index hiện tại phục vụ read.
  - Nếu sau này volume rất lớn, cân nhắc batch insert hoặc write qua queue; giai đoạn đầu insert đồng bộ đơn giản là đủ.

- **List theo user (lịch sử của tôi)**:
  - `where: { userId }` + `orderBy: { createdAt: 'desc' }` → dùng index `@@index([userId, createdAt])`.
  - Luôn có `take` (pageSize) và `skip` để phân trang, tránh load toàn bộ.

- **List theo type và thời gian (admin)**:
  - `where: { type?, createdAt: { gte, lte }? }` + `orderBy: { createdAt: 'desc' }` → dùng index `@@index([type, createdAt])`.
  - Nếu lọc cả userId (admin xem một user): vẫn dùng index `[userId, createdAt]`; nếu lọc type + khoảng ngày, index `[type, createdAt]` hỗ trợ.

- **Count**:
  - `prisma.aiSession.count({ where })` với cùng bộ filter; count trên index thường đủ nhanh. Tránh select toàn bộ rồi đếm ở app.

- **Không select `input`/`output` full trong list**:
  - List chỉ cần preview (substring) hoặc không cần nội dung; giảm dung lượng transfer và memory.

- **Retention (tuỳ chọn sau)**:
  - Chính sách xóa/archive bản ghi cũ (vd giữ 90 ngày) có thể làm bằng cron job: xóa theo `createdAt < (now - 90 days)` với batch size cố định, tránh lock bảng lâu.

---

## 7. Chi tiết từng bước triển khai (checklist)

Khi triển khai, làm lần lượt các mục dưới và đánh dấu khi xong.

### 7.1. Schema và migration

- [ ] Kiểm tra `AiSession` và `AiSessionType` trong `prisma/schema.prisma` đúng như mục 2.
- [ ] Chạy `npx prisma generate` và (nếu chưa migrate) `npx prisma migrate dev` để đảm bảo bảng và index tồn tại.

### 7.2. Service

- [ ] Tạo `src/services/ai-session-service.ts`.
- [ ] Định nghĩa type `CreateAiSessionInput`, `ListAiSessionsInput`, `AiSessionListItem` (có thể đặt trong `src/types/ai-session.ts` hoặc cùng file).
- [ ] Implement `createAiSession`: trim/cắt input-output theo MAX_LENGTH, validate type, `prisma.aiSession.create`.
- [ ] Implement `listAiSessions`: build where từ params, orderBy createdAt desc, skip/take, select hợp lý; count riêng với cùng where.
- [ ] (Tuỳ chọn) Thêm unit test hoặc integration test cho create và list.

### 7.3. Tích hợp ghi log vào API AI shop

- [ ] Khi có **POST /api/shop/ai/advice**: sau khi gọi AI thành công, lấy `userId` từ session (hoặc null), gọi `createAiSession({ userId, type: 'ADVICE', input, output, model, metadata })`.
- [ ] Tương tự khi có API **recommendation**, **comparison**, **search**: gọi `createAiSession` với `type` tương ứng.
- [ ] Đảm bảo ghi log không làm throw lỗi ra ngoài (try/catch và log lỗi server-side); response trả client vẫn là kết quả AI.

### 7.4. API lịch sử user (shop)

- [ ] Tạo **GET /api/shop/ai/sessions** (hoặc route trong nhóm /me): kiểm tra session, lấy userId, query page/pageSize/type.
- [ ] Gọi `listAiSessions({ userId, type, page, pageSize })`, trả về `{ items, total, page, pageSize }`.
- [ ] Frontend (tuỳ chọn): trang "Lịch sử tư vấn AI" dùng API này, hiển thị list có phân trang.

### 7.5. API admin (read-only)

- [ ] Tạo **GET /api/admin/ai-sessions**: kiểm tra role ADMIN, đọc query page, pageSize, userId?, type?, fromAt?, toAt?.
- [ ] Gọi `listAiSessions` với bộ params tương ứng.
- [ ] Trả về list + total; nếu cần hiển thị email, join User (select ít trường).
- [ ] (Tuỳ chọn) **GET /api/admin/ai-sessions/[id]**: chi tiết một bản ghi (full input, output, metadata) cho debug.

### 7.6. UI (tuỳ chọn theo thứ tự ưu tiên)

- [ ] Shop: Trang hoặc section "Lịch sử tư vấn AI" (chỉ khi đăng nhập), gọi GET /api/shop/ai/sessions, bảng/danh sách có phân trang.
- [ ] Admin: Trang "Log phiên AI" (vd `/admin/ai-sessions`), filter theo user/type/ngày, bảng list, link xem chi tiết từng session.

### 7.7. Hiệu năng và vệ sinh

- [ ] Kiểm tra query list có dùng đúng index (explain hoặc log query).
- [ ] Giới hạn pageSize tối đa (vd 50) ở API.
- [ ] (Sau này) Nếu cần retention: cron xóa hoặc archive bản ghi cũ theo chính sách.

---

## 8. Tóm tắt

| Thành phần | Mô tả ngắn |
|------------|------------|
| **AiSession** | Log mỗi phiên AI phía shop: ADVICE, RECOMMENDATION, COMPARISON, SEARCH. userId nullable (khách hoặc user). |
| **Index** | `[userId, createdAt]` cho lịch sử theo user; `[type, createdAt]` cho lọc theo loại và thời gian. |
| **Service** | `createAiSession`, `listAiSessions`; cắt độ dài input/output; metadata nhẹ. |
| **Ghi log** | Chỉ ghi từ server sau khi API AI shop trả kết quả; không expose endpoint cho client tự ghi. |
| **API shop** | GET sessions (lịch sử của user đăng nhập), có phân trang và filter type. |
| **API admin** | GET list (và chi tiết) read-only, filter user/type/fromAt/toAt. |
| **Hiệu năng** | List dùng index, phân trang bắt buộc, không select full input/output trong list. |

Sau khi triển khai xong từng mục, cập nhật lại trạng thái trong mục 7 (checklist) và bổ sung note nếu có thay đổi so với tài liệu này.


Ma trận test – 9 nhóm kịch bản

Mỗi nhóm gồm câu hỏi test, hành vi mong đợi, và gap hiện tại nếu có.

Nhóm 1 – Thương hiệu / sản phẩm không có trong kho







#



Câu hỏi test



Mong đợi



Gap hiện tại





T01



"Bên bạn có Samsung, Sony không?"



Từ chối, pivot ngay sang JBL đang có



Đã ổn (fix hôm qua)





T02



"Cái này giá trên Shopee rẻ hơn nhiều"



Giải thích giá trị dịch vụ, không tranh luận



Gap: không có rule về so sánh giá kênh khác





T03



"Tôi đọc review trên web bảo hàng bị lỗi"



Ghi nhận, mời liên hệ CSKH để được hỗ trợ



Gap: chưa có rule handle phàn nàn / feedback tiêu cực

Nhóm 2 – Tư vấn ngân sách cụ thể







#



Câu hỏi test



Mong đợi



Gap hiện tại





T04



"Tôi có 2 triệu muốn mua loa, có gì không?"



Kiểm tra catalog, gợi ý đúng tầm giá. Nếu không có → nói thật



Gap: AI không có hướng dẫn lọc theo ngân sách





T05



"Ngân sách 50 triệu, muốn bộ dàn hoàn chỉnh"



Tư vấn kết hợp sản phẩm phù hợp nhất từ catalog



Catalog đã inject, nên khả năng xử lý tốt





T06



"Có sản phẩm nào dưới 1 triệu không?"



Kiểm tra, nếu không có → nói thật, không gợi ý sản phẩm ngoài tầm



Gap: tương tự T04

Nhóm 3 – Mục đích / không gian sử dụng







#



Câu hỏi test



Mong đợi



Gap hiện tại





T07



"Phòng ngủ 12m2 nên dùng gì?"



Gợi ý loa nhỏ / bookshelf, có giải thích tại sao



Catalog inject giúp, nhưng cần rule về không gian





T08



"Tôi hay nghe bolero và nhạc vàng, mua gì?"



Gợi ý theo gu nghe bolero từ aiTags/aiDescription



aiTags đã có "bolero", nên AI có ngữ cảnh





T09



"Mua loa tập gym / chạy bộ"



Gợi ý loa di động/bluetooth, không gợi ý loa Hi-end



Gap: AI chưa có rule phân loại theo use-case đặc biệt





T10



"Muốn hát karaoke gia đình"



Nhắc karaoke cần loa có mic-in, kiểm tra catalog



Gap: không có thông tin về tính năng karaoke

Nhóm 4 – Hỏi thông số kỹ thuật không có trong DB







#



Câu hỏi test



Mong đợi



Gap hiện tại





T11



"Loa này công suất bao nhiêu W?"



Nếu không có → thừa nhận không có dữ liệu, mời liên hệ



Rule 7 đã có, nhưng còn bịa





T12



"Trở kháng của loa này là bao nhiêu Ohm?"



Tương tự T11



Tương tự





T13



"Cách kết nối loa với TV không có cổng AUX"



Tư vấn cách kết nối thực tế (Bluetooth/HDMI ARC) – đây là kiến thức chung



Nên cho phép tư vấn kỹ thuật chung

Nhóm 5 – Câu hỏi lạc chủ đề hoàn toàn







#



Câu hỏi test



Mong đợi



Gap hiện tại





T14



"Thời tiết hôm nay thế nào?"



Từ chối nhẹ nhàng, redirect về tư vấn âm thanh



Rule hiện tại đã có nhưng kiểm tra





T15



"Bạn có thể viết CV cho tôi không?"



Tương tự T14



Tương tự





T16



"asdfgh 123"



Hỏi lại ý người dùng muốn gì



Gap: rule cho input vô nghĩa/spam





T17



"ChatGPT trả lời giỏi hơn bạn"



Không tranh luận, lịch sự hướng về tư vấn



Gap: rule handle so sánh với AI khác

Nhóm 6 – Phàn nàn / cảm xúc tiêu cực







#



Câu hỏi test



Mong đợi



Gap hiện tại





T18



"Loa tôi mua bị rè, vỡ tiếng"



Ghi nhận, hướng dẫn liên hệ CSKH / bảo hành



Gap: không có rule cho sản phẩm bị lỗi





T19



"Trả lời vòng vo quá, không giúp ích gì"



Xin lỗi, hỏi lại cụ thể để giúp tốt hơn



Gap: rule handle feedback tiêu cực về chất lượng AI





T20



"Đắt quá, giảm giá đi"



Không cam kết giảm giá, gợi ý sản phẩm cùng loại rẻ hơn nếu có



Gap: rule về giá cả / deal

Nhóm 7 – Multi-turn nâng cao







#



Câu hỏi test



Mong đợi



Gap hiện tại





T21



Turn 1: "phòng 20m2" → Turn 2: "thế còn phòng nhỏ hơn?"



Nhớ context, hiểu "phòng nhỏ hơn" là < 20m2



Multi-turn đã có, kiểm tra quality





T22



Turn 1: gợi ý loa A → Turn 2: "cái đó tôi không thích"



Không lặp lại loa A, gợi ý loa khác



Gap: AI có thể lặp lại suggestion





T23



Turn 1: tiếng Anh "what's the price?"



Trả lời tiếng Việt (theo rule) hoặc đa ngữ



Rule hiện tại chỉ nói "luôn trả lời tiếng Việt" – có thể cứng

Nhóm 8 – Mua hàng & chính sách







#



Câu hỏi test



Mong đợi



Gap hiện tại





T24



"Tôi muốn đặt mua ngay"



Hướng dẫn thêm vào giỏ hàng / liên hệ



Gap: không có rule về luồng mua hàng





T25



"Có freeship không?"



Redirect về trang hỗ trợ / liên hệ shop



Không có shop policy, cần rule





T26



"Trả góp 0% có không?"



Tương tự T25



Tương tự

Nhóm 9 – Câu hỏi mơ hồ / thiếu thông tin







#



Câu hỏi test



Mong đợi



Gap hiện tại





T27



"Cái này có tốt không?"



Hỏi lại: tốt theo tiêu chí gì? Ngân sách? Mục đích?



Rule 5 đã có nhưng kiểm tra





T28



"Tôi muốn mua loa" (không nói loại gì)



Hỏi thêm: ngân sách, không gian, gu nghe



Tương tự T27





T29



"Có cái nào ngon hơn không?"



Làm rõ "ngon hơn" theo khía cạnh nào



Tương tự





T30



"Cho tôi xem tất cả sản phẩm"



Liệt kê catalog thực tế từ DB, ngắn gọn



Gap: không có rule về liệt kê catalog