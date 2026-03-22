import { v2 as cloudinary } from "cloudinary";

/**
 * Cloudinary service: upload ảnh, xoá ảnh, thay ảnh (upload mới + xoá ảnh cũ).
 * Cấu hình qua env: CLOUDINARY_URL hoặc CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET.
 * Validate loại file và kích thước trước khi upload.
 */

export const CLOUDINARY_ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

/** Kích thước tối đa ảnh (bytes). Mặc định 5MB. */
export const CLOUDINARY_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export type CloudinaryUploadOptions = {
  /** Thư mục trên Cloudinary (ví dụ: "audio-ai/brands"). */
  folder?: string;
  /** Public ID tùy chọn (nếu không có, Cloudinary tự sinh). */
  publicId?: string;
};

export type CloudinaryUploadResult = {
  secureUrl: string;
  publicId: string;
};

function getConfig(): { cloud_name: string; api_key: string; api_secret: string } | null {
  const url = process.env.CLOUDINARY_URL;
  if (url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "cloudinary:") return null;
      const apiKey = parsed.username ? decodeURIComponent(parsed.username) : "";
      const apiSecret = parsed.password ? decodeURIComponent(parsed.password) : "";
      const cloudName = parsed.hostname || "";
      if (!cloudName || !apiKey || !apiSecret) return null;
      return { cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret };
    } catch {
      return null;
    }
  }
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret };
}

function ensureConfigured(): void {
  const config = getConfig();
  if (!config) {
    throw new Error(
      "Cloudinary chưa cấu hình. Đặt CLOUDINARY_URL hoặc CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET trong .env"
    );
  }
  cloudinary.config(config);
}

/**
 * Kiểm tra file có được phép upload không (MIME type và kích thước).
 */
export function validateImageFile(
  mimeType: string,
  sizeBytes: number,
  options?: { maxSizeBytes?: number }
): { valid: true } | { valid: false; error: string } {
  const maxSize = options?.maxSizeBytes ?? CLOUDINARY_MAX_FILE_SIZE_BYTES;
  if (!CLOUDINARY_ACCEPTED_MIME_TYPES.includes(mimeType as (typeof CLOUDINARY_ACCEPTED_MIME_TYPES)[number])) {
    return { valid: false, error: "Chỉ chấp nhận ảnh: JPEG, PNG, WebP, GIF." };
  }
  if (sizeBytes > maxSize) {
    return { valid: false, error: `Ảnh tối đa ${Math.round(maxSize / 1024 / 1024)}MB.` };
  }
  return { valid: true };
}

/**
 * Upload ảnh từ buffer lên Cloudinary.
 * Trả về secure_url và public_id để lưu DB; khi cập nhật ảnh khác dùng replaceImage để xoá ảnh cũ.
 */
export async function uploadImage(
  buffer: Buffer,
  options?: CloudinaryUploadOptions
): Promise<CloudinaryUploadResult> {
  ensureConfigured();

  const uploadOptions: Record<string, unknown> = {
    resource_type: "image",
  };
  if (options?.folder) uploadOptions.folder = options.folder;
  if (options?.publicId) uploadOptions.public_id = options.publicId;

  const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      uploadOptions,
      (err, uploadResult) => {
        if (err) {
          const e = err as { message?: string; http_code?: number };
          const msg = e?.message ?? String(err);
          if (e?.http_code === 401 && /invalid cloud_name|cloud_name/i.test(msg)) {
            return reject(
              new Error(
                `Cloudinary: Cloud name không hợp lệ (401). Hãy lấy đúng Cloud name từ Dashboard: https://console.cloudinary.com/ -> mục Dashboard hoặc Settings > Product environments (không dùng "Key name" trong API Keys). Hiện tại CLOUDINARY_CLOUD_NAME=${process.env.CLOUDINARY_CLOUD_NAME ?? "(chưa đặt)"}.`
              )
            );
          }
          return reject(err);
        }
        if (!uploadResult?.secure_url || !uploadResult?.public_id) {
          return reject(new Error("Cloudinary upload response thiếu secure_url hoặc public_id"));
        }
        resolve({ secure_url: uploadResult.secure_url, public_id: uploadResult.public_id });
      }
    ).end(buffer);
  });

  return { secureUrl: result.secure_url, publicId: result.public_id };
}

/**
 * Xoá ảnh trên Cloudinary theo public_id.
 * Nên set invalidate: true để CDN không còn trả ảnh cũ.
 */
export async function deleteImage(publicId: string): Promise<void> {
  ensureConfigured();

  await new Promise<void>((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, { invalidate: true }, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

/**
 * Thay ảnh: upload ảnh mới rồi xoá ảnh cũ (nếu có).
 * Dùng khi cập nhật logo/avatar: gửi buffer ảnh mới và publicId của ảnh cũ.
 * Trả về secure_url và public_id của ảnh mới; ảnh cũ đã bị xoá.
 */
export async function replaceImage(
  buffer: Buffer,
  oldPublicId: string | null | undefined,
  options?: CloudinaryUploadOptions
): Promise<CloudinaryUploadResult> {
  const result = await uploadImage(buffer, options);
  if (oldPublicId && oldPublicId.trim()) {
    try {
      await deleteImage(oldPublicId.trim());
    } catch (e) {
      console.warn("[cloudinary-service] replaceImage: xoá ảnh cũ thất bại:", oldPublicId, e);
    }
  }
  return result;
}
