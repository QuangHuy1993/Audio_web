import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  CLOUDINARY_MAX_FILE_SIZE_BYTES,
  uploadImage,
  validateImageFile,
} from "@/services/cloudinary-service";

export const runtime = "nodejs";

const CLOUDINARY_AVATAR_FOLDER = "audio-ai/avatars";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      folder: CLOUDINARY_AVATAR_FOLDER,
    });

    return NextResponse.json({
      secureUrl: result.secureUrl,
      publicId: result.publicId,
    });
  } catch (error) {
    console.error("[POST /api/shop/profile/upload-avatar]", error);
    return NextResponse.json(
      { error: "Không thể tải ảnh lên. Vui lòng thử lại." },
      { status: 500 },
    );
  }
}

