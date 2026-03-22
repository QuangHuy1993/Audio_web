/**
 * POST /api/admin/ai/demo-products/generate
 *
 * Sinh mảng sản phẩm âm thanh thực tế cho 1 combo (brand × category) bằng Groq.
 * Không lưu DB — client tự gọi POST /api/admin/products để lưu từng sản phẩm.
 *
 * Request body:
 *   { brandId, brandName, categoryId, categoryName, count (1-8), status }
 *
 * Response:
 *   { products: GeneratedProduct[], brandId, categoryId }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type GenerateRequestBody = {
  brandId?: string;
  brandName?: string;
  categoryId?: string;
  categoryName?: string;
  count?: number;
  status?: "ACTIVE" | "DRAFT";
};

export type GeneratedDemoProduct = {
  name: string;
  slug: string;
  description: string;
  priceVnd: number;
  aiDescription: string;
  aiTags: string[];
  seoTitle: string;
  seoDescription: string;
};

type GroqProductsResult = {
  products?: unknown[];
  [key: string]: unknown;
};

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

/**
 * Gọi Groq với auto-retry khi bị rate limit (429 / TPM exceeded).
 * Parse thời gian "retry-in" từ error body và wait đúng thời gian đó.
 * Tối đa MAX_RETRIES lần thử lại, tổng thời gian chờ tối đa ~20s.
 */
async function callGroqWithRetry(
  apiKey: string,
  model: string,
  prompt: string,
  maxTokens: number,
  maxRetries = 3,
): Promise<GroqProductsResult | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_completion_tokens: maxTokens,
        temperature: 0.4,
      }),
    });

    if (response.ok) {
      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | null } }>;
      };
      const rawText = json.choices?.[0]?.message?.content?.trim() ?? "";
      if (!rawText) return null;
      try {
        return JSON.parse(rawText) as GroqProductsResult;
      } catch {
        return null;
      }
    }

    if (response.status === 429 && attempt < maxRetries) {
      // Parse "Please try again in X.XXs" từ Groq error body
      let waitMs = (attempt + 1) * 6000; // fallback: 6s, 12s, 18s
      try {
        const errorBody = await response.text();
        const match = /try again in ([\d.]+)s/i.exec(errorBody);
        if (match?.[1]) {
          waitMs = Math.ceil(parseFloat(match[1]) * 1000) + 500; // +500ms buffer
        }
        console.warn(`[DemoProducts/generate] Rate limit (attempt ${attempt + 1}/${maxRetries}), waiting ${waitMs}ms...`);
      } catch {
        // ignore parse error, dùng fallback waitMs
      }
      await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
      continue;
    }

    // Lỗi khác (không phải 429) → dừng retry
    const errorText = await response.text().catch(() => "");
    console.error(`[DemoProducts/generate] request failed`, {
      status: response.status,
      statusText: response.statusText,
      body: errorText.slice(0, 500),
    });
    return null;
  }

  return null;
}

function buildPrompt(
  brandName: string,
  brandAiDescription: string | null,
  brandAiTags: string[],
  categoryName: string,
  count: number,
): string {
  const brandContext = [
    brandAiDescription ? `Đặc trưng thương hiệu: ${brandAiDescription.slice(0, 300)}` : null,
    brandAiTags.length > 0 ? `Tags thương hiệu: ${brandAiTags.slice(0, 5).join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `Bạn là chuyên gia thiết bị âm thanh Hi-End tại Việt Nam. Tạo đúng ${count} sản phẩm thực tế của thương hiệu "${brandName}" thuộc danh mục "${categoryName}" cho cửa hàng Đức Uy Audio.
${brandContext ? `\n${brandContext}\n` : ""}
Yêu cầu bắt buộc:
- name: tên model THỰC TẾ đang/đã bán trên thị trường (không bịa đặt, ví dụ: "Denon PMA-600NE").
- slug: kebab-case từ tên sản phẩm, chỉ dùng ký tự a-z, 0-9 và dấu gạch ngang, ví dụ: "denon-pma-600ne".
- description: 150-200 từ tiếng Việt, mô tả kỹ thuật chuyên nghiệp, đề cập thông số nổi bật (công suất, trở kháng, dải tần, kết nối...).
- priceVnd: giá niêm yết thực tế thị trường Việt Nam 2023-2024, đơn vị VND, số nguyên (ví dụ: 12900000).
- aiDescription: 2-3 câu (80-100 từ) dùng cho chatbot tư vấn, nhấn mạnh không gian phù hợp và điểm nổi bật.
- aiTags: mảng 5-7 string không dấu lowercase, mô tả đặc tính/phân khúc/không gian, dùng dấu gạch ngang nối từ (ví dụ: ["ampli-integrated", "hi-fi", "phong-khach"]).
- seoTitle: dưới 70 ký tự, bao gồm tên brand, model và loại thiết bị, kết thúc bằng "| Đức Uy Audio".
- seoDescription: 150-160 ký tự chuẩn on-page SEO, đề cập tính năng nổi bật và kêu gọi hành động.

Trả về JSON object hợp lệ duy nhất, KHÔNG có text ngoài JSON:
{"products":[{"name":"...","slug":"...","description":"...","priceVnd":0,"aiDescription":"...","aiTags":[],"seoTitle":"...","seoDescription":"..."}]}`;
}

function sanitizeGeneratedProduct(raw: unknown): GeneratedDemoProduct | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;

  const name = typeof p.name === "string" ? p.name.trim() : "";
  const description = typeof p.description === "string" ? p.description.trim() : "";
  const priceVnd = typeof p.priceVnd === "number" ? Math.round(p.priceVnd) : 0;

  if (!name || !description || priceVnd <= 0) return null;

  const rawSlug = typeof p.slug === "string" ? p.slug.trim() : "";
  const slug = rawSlug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!slug) return null;

  const aiDescription = typeof p.aiDescription === "string" ? p.aiDescription.trim() : "";
  const aiTags = Array.isArray(p.aiTags)
    ? (p.aiTags as unknown[]).filter((t): t is string => typeof t === "string" && t.length > 0)
    : [];
  const seoTitle = typeof p.seoTitle === "string" ? p.seoTitle.trim() : "";
  const seoDescription = typeof p.seoDescription === "string" ? p.seoDescription.trim() : "";

  return { name, slug, description, priceVnd, aiDescription, aiTags, seoTitle, seoDescription };
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Bạn không có quyền thực hiện thao tác này." }, { status: 403 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Dịch vụ AI chưa được cấu hình (thiếu API key)." }, { status: 503 });
  }

  let body: GenerateRequestBody;
  try {
    body = (await request.json()) as GenerateRequestBody;
  } catch {
    return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
  }

  const brandId = body.brandId?.trim() ?? "";
  const categoryId = body.categoryId?.trim() ?? "";
  const count = typeof body.count === "number" && body.count >= 1 && body.count <= 8 ? Math.round(body.count) : 0;

  if (!brandId || !categoryId) {
    return NextResponse.json({ error: "brandId và categoryId là bắt buộc." }, { status: 400 });
  }

  if (!count) {
    return NextResponse.json({ error: "count phải là số nguyên từ 1 đến 8." }, { status: 400 });
  }

  // Fetch brand từ DB để lấy ngữ cảnh cho prompt
  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { name: true, aiDescription: true, aiTags: true },
  });

  if (!brand) {
    return NextResponse.json({ error: "Không tìm thấy brand." }, { status: 404 });
  }

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { name: true },
  });

  if (!category) {
    return NextResponse.json({ error: "Không tìm thấy category." }, { status: 404 });
  }

  const model = process.env.GROQ_MODEL_NAME ?? "llama-3.1-8b-instant";
  const prompt = buildPrompt(brand.name, brand.aiDescription, brand.aiTags, category.name, count);

  const result = await callGroqWithRetry(apiKey, model, prompt, 3000);

  if (!result || !Array.isArray(result.products) || result.products.length === 0) {
    return NextResponse.json(
      { error: "AI không sinh được sản phẩm cho combo này. Vui lòng thử lại." },
      { status: 503 },
    );
  }

  const products: GeneratedDemoProduct[] = result.products
    .map(sanitizeGeneratedProduct)
    .filter((p): p is GeneratedDemoProduct => p !== null);

  if (products.length === 0) {
    return NextResponse.json(
      { error: "Dữ liệu AI trả về không đủ yêu cầu (thiếu name, description hoặc giá)." },
      { status: 503 },
    );
  }

  return NextResponse.json({ products, brandId, categoryId });
}
