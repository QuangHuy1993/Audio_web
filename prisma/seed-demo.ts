import { PrismaClient } from "@prisma/client";

/**
 * Script tạo sản phẩm mẫu âm thanh thực tế bằng AI (Groq) cho mục đích demo.
 *
 * Cách dùng:
 *   npx tsx prisma/seed-demo.ts
 *
 * Yêu cầu:
 *   - Biến môi trường GROQ_API_KEY và DATABASE_URL phải được set.
 *   - Brand và Category đã tồn tại trong DB (tên phải khớp chính xác với PRODUCT_SPECS).
 *
 * Luồng:
 *   1. Đọc tất cả Brand và Category từ DB → build lookup map theo tên.
 *   2. Loop qua PRODUCT_SPECS (brand × category × count).
 *   3. Gọi Groq để sinh mảng sản phẩm thực tế dạng { products: [...] }.
 *   4. Upsert từng sản phẩm vào DB theo slug (chạy lại không bị trùng).
 *   5. Log tiến độ chi tiết.
 */

const prisma = new PrismaClient();

const GROQ_API_KEY = process.env.GROQ_API_KEY ?? "";
const GROQ_MODEL = process.env.GROQ_MODEL_NAME ?? "llama-3.1-8b-instant";
const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const DELAY_MS = 1200;

type ProductSpec = {
  brandName: string;
  categoryName: string;
  count: number;
};

const PRODUCT_SPECS: ProductSpec[] = [
  { brandName: "Denon", categoryName: "Ampli", count: 4 },
  { brandName: "Denon", categoryName: "Đầu phát", count: 3 },
  { brandName: "Marantz", categoryName: "Ampli", count: 4 },
  { brandName: "Marantz", categoryName: "Đầu phát", count: 3 },
  { brandName: "Yamaha", categoryName: "Ampli", count: 4 },
  { brandName: "Yamaha", categoryName: "Loa", count: 3 },
  { brandName: "JBL", categoryName: "Loa", count: 4 },
  { brandName: "KEF", categoryName: "Loa", count: 3 },
  { brandName: "Polk Audio", categoryName: "Loa", count: 4 },
  { brandName: "Focal", categoryName: "Loa", count: 3 },
  { brandName: "Cambridge Audio", categoryName: "Ampli", count: 3 },
  { brandName: "Rega", categoryName: "Mâm đĩa than", count: 3 },
  { brandName: "Sennheiser", categoryName: "Tai nghe", count: 4 },
  { brandName: "Naim", categoryName: "Ampli", count: 3 },
];

type GeneratedProduct = {
  name: string;
  slug: string;
  description: string;
  priceVnd: number;
  aiDescription: string;
  aiTags: string[];
  seoTitle: string;
  seoDescription: string;
};

type GroqResponse = {
  products: GeneratedProduct[];
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

async function callGroq(prompt: string): Promise<GroqResponse | null> {
  try {
    const response = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_completion_tokens: 3000,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(`[Groq] Request failed: ${response.status} ${response.statusText}`, errorText.slice(0, 300));
      return null;
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };

    const rawText = json.choices?.[0]?.message?.content?.trim() ?? "";
    if (!rawText) return null;

    const parsed = JSON.parse(rawText) as GroqResponse;
    if (!parsed || !Array.isArray(parsed.products)) return null;
    return parsed;
  } catch (err) {
    console.error("[Groq] Error:", err);
    return null;
  }
}

function buildPrompt(brandName: string, brandAiDescription: string | null, categoryName: string, count: number): string {
  const brandContext = brandAiDescription
    ? `\nThông tin thương hiệu: ${brandAiDescription.slice(0, 300)}`
    : "";

  return `Bạn là chuyên gia thiết bị âm thanh Hi-End. Tạo đúng ${count} sản phẩm thực tế của thương hiệu "${brandName}" thuộc danh mục "${categoryName}" cho cửa hàng Đức Uy Audio tại Việt Nam.${brandContext}

Yêu cầu bắt buộc:
- Tên sản phẩm: model THỰC TẾ đang/đã bán trên thị trường (không bịa đặt).
- slug: kebab-case từ tên sản phẩm, chỉ dùng chữ thường a-z, số 0-9 và dấu gạch ngang.
- description: 150-200 từ tiếng Việt, mô tả kỹ thuật chuyên nghiệp, nêu thông số quan trọng.
- priceVnd: giá niêm yết thực tế trên thị trường Việt Nam năm 2023-2024, đơn vị VND, số nguyên.
- aiDescription: 2-3 câu (80-100 từ), dùng cho chatbot tư vấn, nhấn mạnh không gian sử dụng và điểm nổi bật.
- aiTags: mảng 5-7 string không dấu lowercase, mô tả đặc tính/phân khúc/không gian, dùng dấu gạch ngang nối từ.
- seoTitle: dưới 70 ký tự, bao gồm tên thương hiệu, model và loại thiết bị.
- seoDescription: 150-160 ký tự chuẩn SEO.

Trả về JSON object hợp lệ, KHÔNG có text ngoài JSON:
{"products":[{"name","slug","description","priceVnd","aiDescription","aiTags","seoTitle","seoDescription"}]}`;
}

async function main() {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY chưa được set. Vui lòng set biến môi trường trước khi chạy script.");
  }

  console.log("=== Seed Demo Products ===");
  console.log(`Model: ${GROQ_MODEL}`);
  console.log(`Tổng batch: ${PRODUCT_SPECS.length}`);
  console.log("");

  // Đọc tất cả brand và category từ DB
  const [allBrands, allCategories] = await Promise.all([
    prisma.brand.findMany({ select: { id: true, name: true, aiDescription: true } }),
    prisma.category.findMany({ select: { id: true, name: true } }),
  ]);

  const brandMap = new Map(allBrands.map((b) => [b.name.toLowerCase(), b]));
  const categoryMap = new Map(allCategories.map((c) => [c.name.toLowerCase(), c]));

  console.log(`Tìm thấy ${allBrands.length} brand, ${allCategories.length} category trong DB.`);
  console.log("");

  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  for (let i = 0; i < PRODUCT_SPECS.length; i++) {
    const spec = PRODUCT_SPECS[i];

    const brand = brandMap.get(spec.brandName.toLowerCase());
    const category = categoryMap.get(spec.categoryName.toLowerCase());

    if (!brand) {
      console.warn(`[${i + 1}/${PRODUCT_SPECS.length}] SKIP: Brand "${spec.brandName}" không có trong DB.`);
      totalSkipped++;
      continue;
    }

    if (!category) {
      console.warn(`[${i + 1}/${PRODUCT_SPECS.length}] SKIP: Category "${spec.categoryName}" không có trong DB.`);
      totalSkipped++;
      continue;
    }

    console.log(`[${i + 1}/${PRODUCT_SPECS.length}] Đang sinh ${spec.count} SP: ${spec.brandName} × ${spec.categoryName}...`);

    const prompt = buildPrompt(brand.name, brand.aiDescription, category.name, spec.count);
    const result = await callGroq(prompt);

    if (!result || result.products.length === 0) {
      console.error(`  → Groq không trả về sản phẩm cho batch này.`);
      totalSkipped++;
      await delay(DELAY_MS);
      continue;
    }

    let batchCreated = 0;
    let batchUpdated = 0;

    for (const product of result.products) {
      if (!product.name?.trim() || !product.description?.trim() || !product.priceVnd || product.priceVnd <= 0) {
        console.warn(`  → Bỏ qua sản phẩm thiếu dữ liệu: ${product.name ?? "(no name)"}`);
        continue;
      }

      const rawSlug = product.slug?.trim() || sanitizeSlug(product.name);
      const slug = rawSlug.replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

      if (!slug) {
        console.warn(`  → Bỏ qua sản phẩm không thể tạo slug: ${product.name}`);
        continue;
      }

      try {
        const productData = {
          name: product.name.trim(),
          description: product.description.trim(),
          price: product.priceVnd,
          stock: 5,
          status: "ACTIVE" as const,
          brandId: brand.id,
          categoryId: category.id,
          aiDescription: product.aiDescription?.trim() || null,
          aiTags: Array.isArray(product.aiTags) ? product.aiTags.filter((t: string) => typeof t === "string" && t.length > 0) : [],
          seoTitle: product.seoTitle?.trim() || null,
          seoDescription: product.seoDescription?.trim() || null,
        };

        const existing = await prisma.product.findUnique({ where: { slug }, select: { id: true } });

        if (existing) {
          await prisma.product.update({ where: { slug }, data: productData });
          batchUpdated++;
        } else {
          await prisma.product.create({ data: { ...productData, slug } });
          batchCreated++;
        }
      } catch (err) {
        console.error(`  → Lỗi khi lưu "${product.name}":`, err instanceof Error ? err.message : err);
      }
    }

    totalCreated += batchCreated;
    totalUpdated += batchUpdated;

    console.log(`  → Tạo mới: ${batchCreated}, Cập nhật: ${batchUpdated}`);

    if (i < PRODUCT_SPECS.length - 1) {
      await delay(DELAY_MS);
    }
  }

  console.log("");
  console.log("=== Hoàn thành ===");
  console.log(`Tạo mới:  ${totalCreated} sản phẩm`);
  console.log(`Cập nhật: ${totalUpdated} sản phẩm`);
  console.log(`Bỏ qua:   ${totalSkipped} batch`);
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Lỗi khi chạy seed-demo:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
