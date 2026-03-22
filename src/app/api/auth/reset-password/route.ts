import { NextResponse } from "next/server";

import {
  AuthError,
  resetPasswordWithOtp,
} from "@/features/auth/auth-service";
import type { ResetPasswordRequestDto } from "@/types/auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<ResetPasswordRequestDto>;

    if (
      typeof body.email !== "string" ||
      typeof body.code !== "string" ||
      typeof body.newPassword !== "string"
    ) {
      return NextResponse.json(
        {
          message: "Dữ liệu gửi lên không hợp lệ.",
        },
        { status: 400 },
      );
    }

    const result = await resetPasswordWithOtp({
      email: body.email,
      code: body.code,
      newPassword: body.newPassword,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof AuthError) {
      let status = 400;

      switch (error.code) {
        case "OTP_NOT_FOUND":
        case "OTP_INVALID":
        case "INVALID_INPUT":
          status = 400;
          break;
        case "OTP_EXPIRED":
          status = 400;
          break;
        case "OTP_TOO_MANY_ATTEMPTS":
          status = 429;
          break;
        case "USER_NOT_FOUND":
          status = 400;
          break;
        default:
          status = 400;
      }

      return NextResponse.json(
        {
          message: error.message,
          code: error.code,
        },
        { status },
      );
    }

    console.error("[POST /api/auth/reset-password] Unexpected error", error);

    return NextResponse.json(
      {
        message: "Đã xảy ra lỗi, vui lòng thử lại sau.",
      },
      { status: 500 },
    );
  }
}

