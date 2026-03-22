/**
 * Cloudinary URL transformation utility.
 *
 * Cloudinary URL structure:
 *   https://res.cloudinary.com/{cloud}/{resource_type}/upload/{transformations}/{version}/{public_id}
 *
 * Cách dùng: truyền URL gốc từ DB + các tùy chọn kích thước/chất lượng,
 * hàm sẽ chèn đúng transformation params vào giữa URL để Cloudinary
 * tự render/compress/convert format phù hợp với browser — không cần
 * Next.js image optimizer re-process thêm lần nữa.
 */

type CloudinaryTransformOptions = {
  /** Chiều rộng tối đa (px). Cloudinary không upscale nếu ảnh nhỏ hơn. */
  width?: number;
  /**
   * Mức chất lượng Cloudinary:
   *   - "auto:eco"  → nén mạnh, phù hợp thumbnail/listing
   *   - "auto:good" → cân bằng (default)
   *   - "auto:best" → chất lượng cao, dùng cho detail page
   */
  quality?: "auto:eco" | "auto:good" | "auto:best";
};

const CLOUDINARY_HOST = "res.cloudinary.com";
// Dấu hiệu phân tách trước phần public_id (sau /upload/)
const UPLOAD_SEGMENT = "/upload/";

/**
 * Chèn Cloudinary transformation vào URL ảnh.
 * - Nếu URL không phải Cloudinary, trả về nguyên bản.
 * - f_auto: Cloudinary tự chọn WebP / AVIF / JPEG tùy browser.
 * - q_auto: nén thông minh theo nội dung ảnh.
 * - c_limit: giữ nguyên aspect ratio, chỉ scale xuống nếu > width.
 */
export function getCloudinaryUrl(
  url: string | null | undefined,
  { width = 800, quality = "auto:good" }: CloudinaryTransformOptions = {},
): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes(CLOUDINARY_HOST)) return url;

    const uploadIndex = parsed.pathname.indexOf(UPLOAD_SEGMENT);
    if (uploadIndex === -1) return url;

    const beforeUpload = parsed.pathname.slice(
      0,
      uploadIndex + UPLOAD_SEGMENT.length,
    );
    const afterUpload = parsed.pathname.slice(
      uploadIndex + UPLOAD_SEGMENT.length,
    );

    // Nếu đã có transformation (không bắt đầu bằng "v" + digit hoặc tên file trực tiếp)
    // thì không thêm nữa để tránh duplicate
    const alreadyTransformed = /^[a-z_]+[^/]*\//.test(afterUpload);
    if (alreadyTransformed) return url;

    const transforms = `f_auto,q_${quality},w_${width},c_limit`;

    parsed.pathname = `${beforeUpload}${transforms}/${afterUpload}`;
    return parsed.toString();
  } catch {
    return url;
  }
}
