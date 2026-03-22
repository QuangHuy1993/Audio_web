# Workflow: AI Tư Vấn Sản Phẩm – Đức Uy Audio

Tài liệu mô tả thiết kế, kiến trúc và kế hoạch triển khai toàn diện cho tính năng AI tư vấn sản phẩm tại trang chi tiết sản phẩm (`/products/[id]`), bao gồm: xây dựng API multi-turn, thiết kế system prompt có ngữ cảnh phong phú, lưu trữ lịch sử chat qua navigation, gợi ý sản phẩm tích hợp, và log AiSession.

---

## 1. Tổng quan tính năng

### 1.1. Mục tiêu

- Người dùng vào trang chi tiết sản phẩm, click tab "AI Tư Vấn" và hỏi bất kỳ câu gì bằng ngôn ngữ tự nhiên về sản phẩm.
- AI hiểu câu hỏi, trả lời chuyên sâu dựa trên ngữ cảnh sản phẩm, brand, category (bao gồm các trường `aiDescription`, `aiTags` từ DB).
- Lịch sử hội thoại được giữ lại khi người dùng click sang sản phẩm gợi ý và quay lại.
- Mỗi phiên tư vấn được log vào `AiSession` để phân tích.

### 1.2. Hiện trạng

| Thành phần | Trạng thái |
|---|---|
| UI chat trong `ProductDetailPage.tsx` | Có sẵn (tab "AI Tư vấn") |
| API route `POST /api/ai/product-advice` | **Chưa tồn tại** – đang gây 404 |
| Multi-turn conversation (gửi lịch sử) | Chưa có – mỗi lần hỏi độc lập |
| System prompt với đầy đủ ngữ cảnh product/brand/category | Chưa có |
| Lưu chat khi chuyển trang (navigation) | Chưa có – state mất khi rời trang |
| Log AiSession | Chưa có – service `ai-session-service.ts` chưa tạo |
| Gợi ý sản phẩm trong phản hồi AI | Chưa có |

### 1.3. Dữ liệu từ Schema hỗ trợ AI

Từ `prisma/schema.prisma`, mỗi sản phẩm đã có đầy đủ ngữ cảnh AI:

```
Product {
  id, name, slug, description
  price, salePrice, stock, status
  aiDescription   -- Mô tả ngữ nghĩa cho chatbot: không gian, gu nhạc, điểm mạnh
  aiTags[]        -- Tags slug: [home-cinema, hi-end, phong-20-30m2, 2-kenh, bolero, ...]

  brand {
    name, slug
    aiDescription  -- Triết lý âm thanh, phân khúc, đặc trưng thương hiệu
    aiTags[]       -- Tags của brand: [hi-end, made-in-uk, tube-amp, ...]
  }

  category {
    name, slug
    aiDescription  -- Mô tả loại sản phẩm, use case
    aiTags[]       -- Tags danh mục: [loa-bookshelf, ampli-den, dac-amp, ...]
  }
}
```

---

## 2. Kiến trúc tổng thể

```
[Client: ProductDetailPage]
  |
  |-- Tab "AI Tư vấn" mở
  |     |
  |     |-- Hiển thị lịch sử chat từ AiChatContext (nếu đã hỏi trước đó)
  |     |-- Người dùng gõ câu hỏi → handleAiSend()
  |     |
  |     |-- POST /api/shop/ai/product-advice
  |     |     Body: { productId, messages: [...lịch sử] }
  |     |
  |     |-- [Server: API Route Handler]
  |     |     1. Fetch product + brand + category context từ DB (Prisma)
  |     |     2. Build system prompt phong phú
  |     |     3. Gửi [system + lịch sử messages] lên Groq API
  |     |     4. Parse response, trích xuất gợi ý sản phẩm (nếu có)
  |     |     5. Log AiSession vào DB (fire-and-forget)
  |     |     6. Trả về { answer, suggestedProducts? }
  |     |
  |     |-- Hiển thị AI bubble + product suggestion cards
  |     |-- Cập nhật AiChatContext (lưu lịch sử theo productId)
  |
  |-- Người dùng click vào sản phẩm gợi ý
        |-- Navigate sang /products/[newId]
        |-- AiChatContext vẫn giữ lịch sử của sản phẩm cũ
        |-- Trang mới mở với lịch sử chat riêng của newId (hoặc rỗng)
```

---

## 3. Thiết kế API

### 3.1. Endpoint

```
POST /api/shop/ai/product-advice
```

**Lý do dùng `/api/shop/` thay vì `/api/ai/`**: Nhất quán với cấu trúc route shop hiện có (`/api/shop/products`, `/api/shop/orders`, ...). Route `/api/ai/product-advice` hiện đang được `ProductDetailPage.tsx` gọi sai – cần sửa lại sau khi tạo API.

### 3.2. Request Body

```typescript
// src/types/ai.ts
export type ProductAdviceMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ProductAdviceRequestDto = {
  productId: string;
  messages: ProductAdviceMessage[]; // Toàn bộ lịch sử hội thoại (không kể system prompt)
};
```

**Giải thích `messages`**:
- Mảng các tin nhắn theo thứ tự thời gian: `[user, assistant, user, assistant, ...]`
- Không bao gồm system prompt – server tự build.
- Giới hạn: tối đa 20 tin nhắn (10 lượt hỏi-đáp) để tránh context quá dài. Server cắt bỏ tin cũ nhất nếu vượt quá.

### 3.3. Response Body

```typescript
export type ProductAdviceResponseDto = {
  answer: string;                    // Phản hồi text từ AI (markdown)
  suggestedProducts?: SuggestedProductDto[]; // Sản phẩm gợi ý (nếu AI nhắc đến)
};

export type SuggestedProductDto = {
  id: string;
  name: string;
  slug: string;
  price: number;
  salePrice: number | null;
  primaryImageUrl: string | null;
};
```

### 3.4. Xử lý lỗi

| HTTP Status | Tình huống |
|---|---|
| 400 | productId rỗng, messages không phải mảng, tin nhắn cuối không phải role "user" |
| 404 | Sản phẩm không tồn tại hoặc không ACTIVE |
| 429 | Rate limit: user gửi quá 10 request/phút (header `X-RateLimit-*`) |
| 503 | Groq API timeout hoặc không khả dụng |
| 500 | Lỗi không xác định |

---

## 4. System Prompt – Thiết kế chi tiết

### 4.1. Nguyên tắc

- **Nhất quán**: AI luôn tư vấn dưới danh nghĩa "Đức Uy Audio".
- **Ngữ cảnh đầy đủ**: Truyền vào `aiDescription` và `aiTags` của product, brand, category – đây là dữ liệu đã được tinh chế bởi Groq trước đó để phù hợp cho tư vấn.
- **Không hallucinate giá**: Truyền giá thực tế từ DB, nhắc AI chỉ dùng giá này.
- **Graceful fallback**: Khi không đủ thông tin, AI thừa nhận thay vì bịa đặt.
- **Ngôn ngữ**: Tiếng Việt, thân thiện, chuyên nghiệp như chuyên viên tư vấn âm thanh thực sự.
- **Temperature thấp**: 0.3 – 0.5 để câu trả lời nhất quán, không quá sáng tạo.

### 4.2. Cấu trúc System Prompt

```
PHẦN 1: Vai trò & Persona
────────────────────────────────
Bạn là trợ lý tư vấn âm thanh của Đức Uy Audio – hệ thống thương mại điện tử 
chuyên thiết bị âm thanh cao cấp tại Việt Nam. Tên của bạn là "Đức Uy AI".

Phong cách tư vấn:
- Thân thiện, chuyên nghiệp như một chuyên viên audiophile có kinh nghiệm.
- Trả lời bằng tiếng Việt, rõ ràng, súc tích. Không dùng thuật ngữ kỹ thuật
  quá phức tạp nếu người dùng không hỏi về kỹ thuật.
- Luôn trả lời trong phạm vi tư vấn âm thanh và sản phẩm của cửa hàng.
- Nếu câu hỏi nằm ngoài phạm vi, nhẹ nhàng hướng người dùng quay lại chủ đề.

PHẦN 2: Sản phẩm đang được hỏi
────────────────────────────────
Người dùng đang xem sản phẩm: {product.name}

Thông tin sản phẩm:
- Tên: {product.name}
- Danh mục: {category.name} ({category.slug})
- Thương hiệu: {brand.name}
- Giá niêm yết: {formatPrice(product.price)}
- Giá ưu đãi: {product.salePrice ? formatPrice(product.salePrice) : "Không có"}
- Tình trạng: {stock > 0 ? "Còn hàng" : "Hết hàng"}
- Mô tả sản phẩm: {product.description.slice(0, 1000)}

Thông tin AI sản phẩm (đặc tính, không gian, gu nghe):
{product.aiDescription ?? "Không có thông tin bổ sung."}

Tags AI sản phẩm (không gian, use case, phân khúc):
{product.aiTags.join(", ")}

PHẦN 3: Ngữ cảnh thương hiệu
────────────────────────────────
Thương hiệu: {brand.name}
Đặc trưng & triết lý: {brand.aiDescription ?? "Chưa có thông tin."}
Tags thương hiệu: {brand.aiTags.join(", ")}

PHẦN 4: Ngữ cảnh danh mục
────────────────────────────────
Danh mục: {category.name}
Đặc điểm danh mục: {category.aiDescription ?? "Chưa có thông tin."}
Tags danh mục: {category.aiTags.join(", ")}

PHẦN 5: Quy tắc trả lời
────────────────────────────────
1. Ưu tiên sử dụng thông tin từ các phần trên khi trả lời.
2. Khi nói về giá, chỉ dùng giá đã cung cấp. Không đưa ra giá khác.
3. Khi người dùng hỏi về phối ghép, gợi ý thiết bị bổ trợ phù hợp với phân khúc
   của sản phẩm này (không cần đặt tên model cụ thể nếu không có trong dữ liệu).
4. Khi gợi ý sản phẩm thay thế hoặc bổ trợ, nếu có tên sản phẩm trong kho, 
   đề xuất bằng cách viết: [GỢI Ý: tên sản phẩm cụ thể]
5. Nếu câu hỏi quá mơ hồ, hỏi lại để làm rõ nhu cầu (phòng bao nhiêu m², 
   ngân sách, gu nghe, đang dùng thiết bị gì).
6. Cuối câu trả lời, nếu phù hợp, thêm một câu hỏi mở để tiếp tục cuộc hội thoại.
7. Không bịa thông số kỹ thuật. Nếu không có, ghi rõ "Tôi không có thông tin 
   chính xác về thông số này, bạn có thể liên hệ Đức Uy Audio để hỏi thêm."
```

### 4.3. Message Array gửi lên Groq

```typescript
const messages = [
  { role: "system", content: buildSystemPrompt(product, brand, category) },
  // Lịch sử hội thoại (tối đa 20 tin nhắn = 10 lượt)
  ...conversationHistory.slice(-20),
  // Tin nhắn mới nhất của user (đã có trong conversationHistory cuối)
];
```

---

## 5. Xử lý gợi ý sản phẩm (Product Suggestions)

### 5.1. Vấn đề

Khi người dùng hỏi "Loa này phối ghép với ampli nào tốt?" hoặc "Có sản phẩm nào rẻ hơn tương tự không?", AI cần có khả năng đề xuất sản phẩm cụ thể trong kho. Nhưng không thể dump toàn bộ catalog vào system prompt.

### 5.2. Giải pháp: Tag-based Matching

**Bước 1**: AI phản hồi text tự nhiên, có thể nhắc tên loại sản phẩm hoặc đặc tính.

**Bước 2**: Server phân tích tags của sản phẩm hiện tại và query DB tìm sản phẩm liên quan:
- Cùng `categoryId` hoặc tags chung trong `aiTags[]`
- Khác `productId` hiện tại
- `status: ACTIVE`, `stock > 0`
- Lấy tối đa 3 sản phẩm

**Bước 3**: Trả kèm `suggestedProducts` trong response nếu câu hỏi liên quan đến so sánh hoặc phối ghép.

### 5.3. Logic xác định khi nào hiển thị gợi ý

```typescript
// Các keyword trong câu hỏi user → trigger product suggestion
const SUGGESTION_TRIGGERS = [
  "phối ghép", "kết hợp", "cùng với", "bộ dàn",
  "thay thế", "rẻ hơn", "đắt hơn", "so sánh",
  "ampli nào", "loa nào", "dac nào", "gợi ý",
  "tương tự", "cùng tầm", "upgrade",
];

function shouldFetchSuggestions(userMessage: string): boolean {
  const lower = userMessage.toLowerCase();
  return SUGGESTION_TRIGGERS.some(trigger => lower.includes(trigger));
}
```

---

## 6. Lưu giữ lịch sử chat qua Navigation

### 6.1. Vấn đề

Hiện tại `aiMessages` là local state trong `ProductDetailPage.tsx`. Khi người dùng click sang trang sản phẩm khác (từ sản phẩm gợi ý), state bị reset. Cần giữ lịch sử chat theo từng `productId`.

### 6.2. Giải pháp: AiChatContext

**Tạo context toàn app** trong `src/features/shop/context/AiChatContext.tsx`:

```typescript
type AiChatSession = {
  productId: string;
  productName: string;
  messages: AiMessage[];           // Bao gồm cả tin nhắn khởi tạo
  conversationHistory: ProductAdviceMessage[]; // Chỉ user + assistant (gửi lên API)
  lastUpdated: number;             // timestamp ms
};

type AiChatContextValue = {
  sessions: Record<string, AiChatSession>; // key = productId
  getOrCreateSession: (productId: string, productName: string) => AiChatSession;
  appendMessage: (productId: string, message: AiMessage, historyMsg?: ProductAdviceMessage) => void;
  clearSession: (productId: string) => void;
  clearAllSessions: () => void;
};
```

**Mount trong layout shop** (`src/app/layout.tsx` hoặc layout shop):
- Wrap với `<AiChatProvider>`.
- Context sử dụng `sessionStorage` để persist khi refresh trang trong cùng tab.
- Xóa session cũ hơn 2 giờ (cleanup) để tránh sessionStorage quá nặng.

### 6.3. Sơ đồ luồng session

```
User vào /products/A
  → AiChatContext.getOrCreateSession("A", "Loa KEF Q350")
  → Tạo session mới với initMessage "Xin chào! Tôi là trợ lý AI..."
  → Hiển thị chat

User hỏi: "Loa này phòng 25m2 có ổn không?"
  → appendMessage("A", userMsg)
  → Gọi API → nhận answer
  → appendMessage("A", aiMsg)
  → conversationHistory của session "A" = [user, assistant]

User click sản phẩm gợi ý /products/B
  → Session "A" được giữ nguyên trong AiChatContext
  → AiChatContext.getOrCreateSession("B", "Ampli Denon PMA-900HNE")
  → Tạo session mới cho B (hoặc dùng session B cũ nếu đã tồn tại)

User quay lại /products/A (browser back hoặc click)
  → AiChatContext.getOrCreateSession("A", "Loa KEF Q350")
  → Trả về session cũ: đã có lịch sử chat
  → Hiển thị lại hội thoại
```

### 6.4. Persist với sessionStorage

```typescript
// Trong AiChatProvider
useEffect(() => {
  // Hydrate từ sessionStorage khi mount (client-side only)
  const stored = sessionStorage.getItem("ai-chat-sessions");
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Record<string, AiChatSession>;
      // Lọc bỏ session quá cũ (> 2 giờ)
      const now = Date.now();
      const valid = Object.fromEntries(
        Object.entries(parsed).filter(
          ([, s]) => now - s.lastUpdated < 2 * 60 * 60 * 1000
        )
      );
      setSessions(valid);
    } catch {
      // Bỏ qua nếu parse lỗi
    }
  }
}, []);

useEffect(() => {
  // Sync sang sessionStorage khi sessions thay đổi
  sessionStorage.setItem("ai-chat-sessions", JSON.stringify(sessions));
}, [sessions]);
```

---

## 7. Thay đổi cần thiết trong ProductDetailPage.tsx

### 7.1. Dùng AiChatContext thay vì local state

```typescript
// Trước (local state):
const [aiMessages, setAiMessages] = useState<AiMessage[]>([...initMsg]);
const [aiInput, setAiInput] = useState("");

// Sau (từ context):
const { getOrCreateSession, appendMessage } = useAiChatContext();
const session = getOrCreateSession(product.id, product.name);
const aiMessages = session.messages;
```

### 7.2. Gửi conversationHistory lên API

```typescript
const handleAiSend = async () => {
  const text = aiInput.trim();
  if (!text || aiLoading || !product) return;

  // Thêm user message vào context
  const userAiMsg: AiMessage = { id: `u-${Date.now()}`, role: "user", text };
  const userHistMsg: ProductAdviceMessage = { role: "user", content: text };
  appendMessage(product.id, userAiMsg, userHistMsg);
  setAiInput("");
  setAiLoading(true);

  try {
    const currentHistory = session.conversationHistory;
    // Thêm tin nhắn mới nhất vào lịch sử trước khi gửi
    const messagesForApi = [...currentHistory, userHistMsg];

    const res = await fetch("/api/shop/ai/product-advice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: product.id,
        messages: messagesForApi,
      }),
    });

    if (!res.ok) throw new Error("AI không phản hồi được.");

    const data = await res.json() as ProductAdviceResponseDto;

    // Thêm AI response vào context
    const aiAiMsg: AiMessage = { id: `a-${Date.now()}`, role: "ai", text: data.answer };
    const aiHistMsg: ProductAdviceMessage = { role: "assistant", content: data.answer };
    appendMessage(product.id, aiAiMsg, aiHistMsg);

    // Hiển thị sản phẩm gợi ý nếu có
    if (data.suggestedProducts && data.suggestedProducts.length > 0) {
      setSuggestedProducts(data.suggestedProducts);
    }
  } catch {
    const errMsg: AiMessage = {
      id: `err-${Date.now()}`,
      role: "ai",
      text: "Xin lỗi, tôi gặp sự cố khi xử lý câu hỏi của bạn. Vui lòng thử lại sau.",
    };
    appendMessage(product.id, errMsg);
  } finally {
    setAiLoading(false);
  }
};
```

### 7.3. Hiển thị product suggestion cards trong chat

Sau mỗi AI message có `suggestedProducts`, render cards nhỏ:

```
┌──────────────────────────────────────────────────────┐
│ [AI bubble] Bạn có thể cân nhắc kết hợp với ampli... │
├──────────────────────────────────────────────────────┤
│ Sản phẩm gợi ý:                                      │
│  ┌────────┐  ┌────────┐                              │
│  │ [img]  │  │ [img]  │                              │
│  │ Ampli  │  │ DAC    │                              │
│  │ Denon  │  │ FiiO   │                              │
│  │45tr    │  │12tr    │                              │
│  [Xem →]  │  [Xem →]  │                              │
│  └────────┘  └────────┘                              │
└──────────────────────────────────────────────────────┘
```

Cards này click vào → navigate sang sản phẩm mới, chat history của sản phẩm cũ vẫn giữ nguyên.

---

## 8. Triển khai API Route

### 8.1. File: `src/app/api/shop/ai/product-advice/route.ts`

**Luồng xử lý**:

```
1. Parse & validate body { productId, messages }
   → 400 nếu thiếu productId hoặc messages không hợp lệ
   → 400 nếu tin nhắn cuối không phải role "user"

2. Fetch product từ DB (Prisma):
   prisma.product.findUnique({
     where: { id: productId, status: "ACTIVE" },
     select: {
       id, name, slug, description, price, salePrice, stock,
       aiDescription, aiTags,
       brand: { select: { name, slug, aiDescription, aiTags } },
       category: { select: { name, slug, aiDescription, aiTags } },
     }
   })
   → 404 nếu không tìm thấy

3. Build system prompt (xem mục 4.2)

4. Cắt ngắn messages nếu > 20 tin nhắn:
   const trimmedMessages = messages.slice(-20)

5. Xác định có cần fetch suggested products không:
   const needSuggestions = shouldFetchSuggestions(lastUserMessage)

6. Gọi Groq API:
   - URL: https://api.groq.com/openai/v1/chat/completions
   - Model: process.env.GROQ_MODEL_NAME ?? "llama-3.1-8b-instant"
   - Messages: [{ role: "system", content: systemPrompt }, ...trimmedMessages]
   - Temperature: 0.4
   - Max tokens: 1024
   - Timeout: 30s

7. Parse response → lấy answer text

8. Nếu needSuggestions: query DB tìm related products
   prisma.product.findMany({
     where: {
       id: { not: productId },
       status: "ACTIVE",
       stock: { gt: 0 },
       OR: [
         { categoryId: product.categoryId },
         { aiTags: { hasSome: product.aiTags.slice(0, 3) } }
       ]
     },
     select: { id, name, slug, price, salePrice, images: { where: { isPrimary: true } } },
     take: 3,
   })

9. Fire-and-forget: gọi createAiSession() để log
   (không await, bọc trong try/catch để không block response)

10. Trả về { answer, suggestedProducts? }
```

### 8.2. Rate Limiting

Tránh abuse: middleware hoặc trong route handler kiểm tra request/phút.

Đơn giản nhất: dùng header `X-Forwarded-For` hoặc userId (nếu có session) làm key, store trong Map in-memory với TTL 60s. Giới hạn 10 request/phút mỗi IP/user.

---

## 9. AiSession Logging

### 9.1. Service: `src/services/ai-session-service.ts`

Theo thiết kế trong `workflowAiSession.md`:

```typescript
export async function createAiSession(data: CreateAiSessionInput): Promise<void> {
  try {
    await prisma.aiSession.create({
      data: {
        userId: data.userId ?? null,
        type: "ADVICE",
        input: data.input.slice(0, 5000),
        output: data.output.slice(0, 5000),
        model: data.model ?? null,
        metadata: data.metadata ?? null,
      },
    });
  } catch (error) {
    // Log server-side nhưng không throw – không ảnh hưởng response
    console.error("[AiSession] Failed to log session:", error);
  }
}
```

### 9.2. Metadata lưu thêm

```typescript
metadata: {
  productId: product.id,
  productName: product.name,
  brandName: product.brand?.name,
  categoryName: product.category?.name,
  turnCount: messages.length,          // Số tin nhắn trong hội thoại
  hasSuggestedProducts: suggestedProducts.length > 0,
  latencyMs: Date.now() - startTime,
}
```

---

## 10. File structure sau khi triển khai

```
src/
├── app/
│   └── api/
│       └── shop/
│           └── ai/
│               └── product-advice/
│                   └── route.ts              ← POST handler (MỚI)
│
├── features/
│   └── shop/
│       ├── context/
│       │   ├── CartContext.tsx               ← Đã có
│       │   └── AiChatContext.tsx             ← MỚI: quản lý chat sessions
│       └── components/
│           └── product-detail/
│               ├── ProductDetailPage.tsx     ← SỬA: dùng AiChatContext
│               └── ProductAiSuggestionCard.tsx ← MỚI: card gợi ý sản phẩm
│
├── services/
│   └── ai-session-service.ts                ← MỚI (hoặc bổ sung vào file)
│
├── types/
│   ├── shop.ts                              ← Đã có, bổ sung SuggestedProductDto
│   └── ai.ts                               ← MỚI: ProductAdviceMessage, RequestDto, ResponseDto
│
└── lib/
    └── groq-chat.ts                         ← MỚI: helper multi-turn (khác groq-json.ts)
```

---

## 11. Thiết kế `groq-chat.ts` – Multi-turn Helper

File `groq-json.ts` hiện có chỉ hỗ trợ single prompt + JSON output. Cần thêm helper cho multi-turn chat với text output:

```typescript
// src/lib/groq-chat.ts

export type GroqChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type CallGroqChatParams = {
  apiKey: string;
  model: string;
  messages: GroqChatMessage[];
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  debugLabel?: string;
};

export async function callGroqChat(params: CallGroqChatParams): Promise<string | null> {
  const {
    apiKey, model, messages,
    maxTokens = 1024,
    temperature = 0.4,
    timeoutMs = 30_000,
    debugLabel = "[GroqChat]",
  } = params;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_completion_tokens: maxTokens,
        temperature,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => null);
      console.error(`${debugLabel} Groq request failed`, {
        status: response.status,
        body: errorText,
      });
      return null;
    }

    const json = await response.json() as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };

    return json.choices?.[0]?.message?.content?.trim() ?? null;
  } catch (error) {
    clearTimeout(timeout);
    console.error(`${debugLabel} Error:`, error);
    return null;
  }
}
```

---

## 12. Validate & Test Cases

### 12.1. Test cases API

| # | Input | Expected Output |
|---|---|---|
| 1 | productId rỗng | 400 "productId là bắt buộc" |
| 2 | productId không tồn tại | 404 "Sản phẩm không tồn tại" |
| 3 | messages = [] | 400 "Phải có ít nhất 1 tin nhắn" |
| 4 | Tin nhắn cuối role = "assistant" | 400 "Tin nhắn cuối phải từ người dùng" |
| 5 | messages > 20 tin | Server cắt còn 20, vẫn hoạt động |
| 6 | Câu hỏi bình thường | 200, answer text, no suggestedProducts |
| 7 | Câu hỏi về phối ghép | 200, answer text, suggestedProducts có thể có |
| 8 | Groq API lỗi (mock) | 503 "Dịch vụ AI tạm thời không khả dụng" |
| 9 | product.status = HIDDEN | 404 |
| 10 | product.stock = 0 | 200, AI vẫn tư vấn, system prompt nói "Hết hàng" |
| 11 | Brand và Category không có aiDescription | 200, AI dùng name và description chính |
| 12 | Câu hỏi tiếng Anh | 200, AI trả lời tiếng Việt (quy định trong system prompt) |
| 13 | Câu hỏi không liên quan (thời tiết, v.v.) | AI từ chối nhẹ nhàng và hướng về tư vấn âm thanh |

### 12.2. Test cases Chat Persistence

| # | Scenario | Expected |
|---|---|---|
| 1 | Hỏi 3 câu ở sản phẩm A | session A có 3 lượt trong AiChatContext |
| 2 | Navigate sang sản phẩm B | session A vẫn còn, B tạo session mới |
| 3 | Quay lại sản phẩm A (browser back) | Hiển thị đủ 3 lượt hội thoại cũ |
| 4 | Refresh trang ở sản phẩm A | sessionStorage restore session A |
| 5 | Mở tab mới cùng URL | Tab mới không có chat (sessionStorage khác tab) |
| 6 | Session quá 2 giờ | Tự động xóa khi mount AiChatProvider |

### 12.3. Test cases Product Suggestions

| # | Input | Expected |
|---|---|---|
| 1 | "Phối ghép ampli nào?" | suggestedProducts trả về (nếu có ampli cùng category hoặc tags) |
| 2 | "Loa này có hay không?" | Không trả suggestedProducts (không trigger keyword) |
| 3 | "So sánh với loa khác?" | suggestedProducts trả về |
| 4 | Không có sản phẩm phù hợp trong DB | suggestedProducts = [] hoặc không có trong response |

### 12.4. Test cases System Prompt

| # | Scenario | Expected |
|---|---|---|
| 1 | Product có đầy đủ aiDescription, brand.aiDescription, category.aiDescription | Prompt phong phú, AI tư vấn sát thực tế |
| 2 | Product không có aiDescription | Prompt dùng description gốc |
| 3 | Brand không có aiDescription | Prompt chỉ có tên brand |
| 4 | aiTags = [] | Phần tags trong prompt để trống, không crash |
| 5 | description > 1000 ký tự | Prompt cắt còn 1000 ký tự |

---

## 13. Quick Suggestion Pills – Cải thiện

### 13.1. Hiện tại

Tags từ `product.aiTags` được map cứng sang câu hỏi (tagMap trong code).

### 13.2. Cải thiện đề xuất

**Tag → Question mapping đầy đủ hơn**:

```typescript
const TAG_QUESTION_MAP: Record<string, string> = {
  "home-cinema": "Loa này dùng cho home cinema có tốt không?",
  "hi-end": "Sản phẩm này có xứng tầm Hi-end không?",
  "phong-20-30m2": "Phòng khách 25m² có phù hợp không?",
  "phong-30m2": "Phòng khách 35m² dùng được không?",
  "phong-10-15m2": "Phòng ngủ nhỏ dùng có ổn không?",
  "2-kenh": "Phối ghép với ampli 2 kênh nào tốt nhất?",
  "2-1-kenh": "Cần thêm subwoofer không?",
  "bolero": "Nghe nhạc bolero, nhạc vàng có hay không?",
  "nhac-co-dien": "Nghe nhạc cổ điển, thính phòng thế nào?",
  "nhac-jazz": "Nghe jazz, acoustic có tốt không?",
  "karaoke": "Dùng cho dàn karaoke gia đình được không?",
  "bluetooth": "Kết nối bluetooth có ổn định không?",
  "tube-amp": "Phối với ampli đèn nào phù hợp?",
  "solid-state": "Phối với ampli bán dẫn nào?",
  "tam-trung": "Tầm trung này có gì nổi bật không?",
  "entry-level": "Đây có phải lựa chọn tốt cho người mới?",
  "dac": "Cần thêm DAC ngoài không?",
  "streaming": "Tích hợp streaming như thế nào?",
};
```

**Dynamic suggestions từ AI** (tuỳ chọn nâng cao):
- Sau lần hỏi đầu tiên, AI có thể đề xuất 2–3 câu hỏi gợi ý tiếp theo dưới dạng structured output phụ.

---

## 14. UI – Cải thiện Tab AI Tư Vấn

### 14.1. Header tab

```
[sparkle icon] AI Tư vấn – Đức Uy Audio
Hỏi tôi bất cứ điều gì về {product.name}
```

Thêm nút "Xóa hội thoại" (icon thùng rác nhỏ) ở góc phải header, clear session hiện tại.

### 14.2. Trạng thái chat

**Khi session đã có lịch sử**:
- Hiển thị banner nhỏ đầu chat: "Tiếp tục hội thoại từ lần trước"
- Nút "Bắt đầu lại" để clear session

**Khi AI đang xử lý (loading)**:
- 3 chấm nhảy (đã có)
- Disable textarea và nút gửi

**Khi AI lỗi**:
- Bubble màu đỏ nhạt với icon cảnh báo
- Nút "Thử lại" tự động điền lại câu hỏi cũ

### 14.3. Product Suggestion Cards (inline trong chat)

```
┌─────────────────────────────────────────────────────┐
│ [AI avatar] Bạn có thể xem thêm sản phẩm phù hợp:  │
├─────────────────────────────────────────────────────┤
│ ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│ │ [thumb]  │  │ [thumb]  │  │ [thumb]  │           │
│ │Ampli     │  │ Loa sub  │  │ Cáp loa  │           │
│ │Denon 900 │  │ KEF Kube │  │ QED      │           │
│ │45.000.000│  │12.000.000│  │ 1.500.000│           │
│ │[Xem →]   │  │[Xem →]   │  │[Xem →]   │           │
│ └──────────┘  └──────────┘  └──────────┘           │
└─────────────────────────────────────────────────────┘
```

---

## 15. Checklist triển khai (theo thứ tự ưu tiên)

### Giai đoạn 1: Core API (bắt buộc để tính năng hoạt động)

- [ ] **Tạo `src/types/ai.ts`**: `ProductAdviceMessage`, `ProductAdviceRequestDto`, `ProductAdviceResponseDto`, `SuggestedProductDto`.
- [ ] **Tạo `src/lib/groq-chat.ts`**: Helper `callGroqChat()` multi-turn với timeout.
- [ ] **Tạo `src/services/ai-session-service.ts`**: `createAiSession()` (fire-and-forget, không throw).
- [ ] **Tạo `src/app/api/shop/ai/product-advice/route.ts`**:
  - Validate body, fetch product từ DB.
  - Build system prompt với đầy đủ context.
  - Gọi `callGroqChat()`.
  - Fire-and-forget `createAiSession()`.
  - Trả `{ answer }`.
- [ ] **Sửa `ProductDetailPage.tsx`**: Đổi URL gọi API từ `/api/ai/product-advice` → `/api/shop/ai/product-advice`.
- [ ] Chạy `ReadLints` và sửa tất cả lỗi.

### Giai đoạn 2: Multi-turn (quan trọng cho UX)

- [ ] **Cập nhật `ProductDetailPage.tsx`**: Gửi `conversationHistory` thay vì chỉ câu hỏi đơn.
- [ ] Trong API handler: nhận `messages[]` và build message array cho Groq đúng cách.
- [ ] Test các câu hỏi follow-up (AI hiểu ngữ cảnh câu trước).

### Giai đoạn 3: Chat Persistence (UX nâng cao)

- [ ] **Tạo `src/features/shop/context/AiChatContext.tsx`**: Context quản lý sessions theo productId.
- [ ] Mount `AiChatProvider` trong layout shop.
- [ ] **Sửa `ProductDetailPage.tsx`**: Dùng context thay vì local state.
- [ ] Persist sang `sessionStorage`, cleanup session > 2 giờ.
- [ ] Test: navigate sang sản phẩm khác và quay lại, lịch sử vẫn còn.

### Giai đoạn 4: Product Suggestions (nice-to-have)

- [ ] Thêm `shouldFetchSuggestions()` trong API handler.
- [ ] Query DB tìm related products khi cần.
- [ ] Trả `suggestedProducts` trong response.
- [ ] **Tạo `ProductAiSuggestionCard.tsx`**: Component card sản phẩm gợi ý.
- [ ] Hiển thị cards dưới AI bubble khi có gợi ý.
- [ ] Click card → navigate, chat session cũ giữ nguyên.

### Giai đoạn 5: Polish & Improvements

- [ ] Mở rộng `TAG_QUESTION_MAP` với đủ tags.
- [ ] Thêm nút "Xóa hội thoại" trong chat header.
- [ ] Thêm banner "Tiếp tục hội thoại" khi session cũ có sẵn.
- [ ] Rate limiting đơn giản (10 req/phút per IP).
- [ ] Kiểm tra ReadLints toàn bộ file đã sửa.

---

## 16. Tóm tắt quyết định thiết kế

| Quyết định | Lý do |
|---|---|
| Dùng `sessionStorage` (không `localStorage`) | Chat chỉ cần tồn tại trong 1 tab/session, không cần lưu lâu dài |
| Cắt messages > 20 tin | Tránh context quá dài, tăng latency và cost Groq |
| Fire-and-forget AiSession log | Không làm chậm response trả về user |
| Không stream response | Đơn giản hóa implementation; nếu cần UX tốt hơn, thêm streaming sau |
| Tag-based suggestion (không vector search) | Đủ tốt cho quy mô hiện tại; không cần infra phức tạp |
| Context: system prompt một lần, không lặp | Groq Prompt Caching tự động cache system prompt, giảm cost |
| Temperature = 0.4 | Cân bằng giữa nhất quán và tự nhiên trong tư vấn |
| Limit description trong prompt đến 1000 ký tự | Tránh prompt quá dài, giữ token count hợp lý |
