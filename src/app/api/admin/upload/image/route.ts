import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  uploadImage,
  validateImageFile,
  CLOUDINARY_MAX_FILE_SIZE_BYTES,
} from "@/services/cloudinary-service";

export const runtime = "nodejs";

const CLOUDINARY_UPLOAD_FOLDER = "audio-ai/brands";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Bạn không có quyền upload ảnh." },
      { status: 403 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Dữ liệu gửi lên không hợp lệ." },
      { status: 400 },
    );
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return NextResponse.json(
      { error: "Chưa chọn file ảnh." },
      { status: 400 },
    );
  }

  const validation = validateImageFile(file.type, file.size, {
    maxSizeBytes: CLOUDINARY_MAX_FILE_SIZE_BYTES,
  });
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const result = await uploadImage(buffer, {
      folder: CLOUDINARY_UPLOAD_FOLDER,
    });
    return NextResponse.json({
      secureUrl: result.secureUrl,
      publicId: result.publicId,
    });
  } catch (e) {
    console.error("[POST /api/admin/upload/image]", e);
    return NextResponse.json(
      { error: "Không thể tải ảnh lên. Vui lòng thử lại." },
      { status: 500 },
    );
  }
}
