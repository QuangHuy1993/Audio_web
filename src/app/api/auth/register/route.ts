import { NextResponse } from "next/server";

import {
  registerUserAndSendActivationOtp,
  AuthError,
} from "@/features/auth/auth-service";
import type { RegisterRequestDto } from "@/types/auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<RegisterRequestDto>;

    if (
      typeof body.fullName !== "string" ||
      typeof body.email !== "string" ||
      typeof body.password !== "string"
    ) {
      return NextResponse.json(
        {
          message: "Dữ liệu gửi lên không hợp lệ.",
        },
        { status: 400 },
      );
    }

    const result = await registerUserAndSendActivationOtp({
      fullName: body.fullName,
      email: body.email,
      password: body.password,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      let status = 400;

      if (error.code === "EMAIL_ALREADY_IN_USE") {
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

    console.error("[POST /api/auth/register] Unexpected error", error);

    return NextResponse.json(
      {
        message: "Đã xảy ra lỗi, vui lòng thử lại sau.",
      },
      { status: 500 },
    );
  }
}

