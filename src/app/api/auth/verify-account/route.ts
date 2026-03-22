import { NextResponse } from "next/server";

import {
  AuthError,
  verifyAccountOtpAndActivateUser,
} from "@/features/auth/auth-service";
import type { VerifyAccountRequestDto } from "@/types/auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<VerifyAccountRequestDto>;

    if (typeof body.email !== "string" || typeof body.code !== "string") {
      return NextResponse.json(
        {
          message: "Dữ liệu gửi lên không hợp lệ.",
        },
        { status: 400 },
      );
    }

    const result = await verifyAccountOtpAndActivateUser({
      email: body.email,
      code: body.code,
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

    console.error("[POST /api/auth/verify-account] Unexpected error", error);

    return NextResponse.json(
      {
        message: "Đã xảy ra lỗi, vui lòng thử lại sau.",
      },
      { status: 500 },
    );
  }
}

