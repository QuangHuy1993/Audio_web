import { NextResponse } from "next/server";

import {
  AuthError,
  requestPasswordResetOtpAndSendEmail,
} from "@/features/auth/auth-service";
import type { ForgotPasswordRequestDto } from "@/types/auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<ForgotPasswordRequestDto>;

    if (typeof body.email !== "string") {
      return NextResponse.json(
        {
          message: "Dữ liệu gửi lên không hợp lệ.",
        },
        { status: 400 },
      );
    }

    const result = await requestPasswordResetOtpAndSendEmail(body.email);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof AuthError) {
      let status = 400;

      if (error.code === "EMAIL_NOT_FOUND") {
        status = 404;
      } else if (error.code === "INVALID_INPUT") {
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

    console.error(
      "[POST /api/auth/forgot-password] Unexpected error",
      error,
    );

    return NextResponse.json(
      {
        message: "Đã xảy ra lỗi, vui lòng thử lại sau.",
      },
      { status: 500 },
    );
  }
}

