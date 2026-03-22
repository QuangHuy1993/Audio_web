import { NextResponse } from "next/server";

import {
  AuthError,
  resendActivationOtpAndSendEmail,
} from "@/features/auth/auth-service";
import type { ResendActivationOtpRequestDto } from "@/types/auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<ResendActivationOtpRequestDto>;

    if (typeof body.email !== "string") {
      return NextResponse.json(
        {
          message: "Dữ liệu gửi lên không hợp lệ.",
        },
        { status: 400 },
      );
    }

    const result = await resendActivationOtpAndSendEmail(body.email);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof AuthError) {
      let status = 400;

      if (error.code === "USER_ALREADY_ACTIVATED") {
        status = 400;
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
      "[POST /api/auth/resend-activation-otp] Unexpected error",
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

