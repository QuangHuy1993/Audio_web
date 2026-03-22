import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { createOtp, verifyOtp } from "@/services/otp-service";
import {
  sendAccountActivationEmail,
  sendPasswordResetEmail,
} from "@/services/email-resend-service";
import type {
  RegisterRequestDto,
  RegisterResponseDto,
  ResendActivationOtpResponseDto,
  VerifyAccountRequestDto,
  VerifyAccountResponseDto,
} from "@/types/auth";

type AuthErrorCode =
  | "INVALID_INPUT"
  | "EMAIL_ALREADY_IN_USE"
  | "USER_NOT_FOUND"
  | "EMAIL_NOT_FOUND"
  | "USER_ALREADY_ACTIVATED"
  | "OTP_NOT_FOUND"
  | "OTP_INVALID"
  | "OTP_EXPIRED"
  | "OTP_TOO_MANY_ATTEMPTS";

export class AuthError extends Error {
  code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "AuthError";
  }
}

const MIN_PASSWORD_LENGTH = 8;
const ACTIVATION_OTP_TTL_MINUTES = 10;

function normalizeEmail(rawEmail: string): string {
  return rawEmail.trim().toLowerCase();
}

function validateRegisterInput(body: RegisterRequestDto): RegisterRequestDto {
  const fullName = body.fullName?.trim() ?? "";
  const email = body.email?.trim() ?? "";
  const password = body.password?.trim() ?? "";

  if (!fullName || !email || !password) {
    throw new AuthError(
      "INVALID_INPUT",
      "Vui lòng điền đầy đủ họ tên, email và mật khẩu.",
    );
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    throw new AuthError(
      "INVALID_INPUT",
      "Địa chỉ email không hợp lệ. Vui lòng kiểm tra lại.",
    );
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new AuthError(
      "INVALID_INPUT",
      "Mật khẩu phải có ít nhất 8 ký tự.",
    );
  }

  return {
    fullName,
    email,
    password,
  };
}

function validateVerifyAccountInput(
  body: VerifyAccountRequestDto,
): VerifyAccountRequestDto {
  const email = body.email?.trim() ?? "";
  const code = body.code?.trim().toUpperCase() ?? "";

  if (!email || !code) {
    throw new AuthError(
      "INVALID_INPUT",
      "Email và mã OTP không được để trống.",
    );
  }

  if (code.length !== 8) {
    throw new AuthError(
      "INVALID_INPUT",
      "Mã OTP phải gồm 8 ký tự. Vui lòng kiểm tra lại.",
    );
  }

  return {
    email,
    code,
  };
}

export async function registerUserAndSendActivationOtp(
  rawBody: RegisterRequestDto,
): Promise<RegisterResponseDto> {
  const { fullName, email, password } = validateRegisterInput(rawBody);
  const normalizedEmail = normalizeEmail(email);

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    throw new AuthError(
      "EMAIL_ALREADY_IN_USE",
      "Email này đã được sử dụng cho một tài khoản khác.",
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name: fullName,
      email: normalizedEmail,
      passwordHash,
      role: "USER",
      emailVerified: null,
    },
  });

  const { code, expiresAt } = await createOtp({
    email: normalizedEmail,
    userId: user.id,
    type: "ACCOUNT_ACTIVATION",
    ttlMinutes: ACTIVATION_OTP_TTL_MINUTES,
  });

  const now = new Date();
  const ttlMinutes =
    (expiresAt.getTime() - now.getTime()) / (60 * 1000) ||
    ACTIVATION_OTP_TTL_MINUTES;

  await sendAccountActivationEmail({
    toEmail: normalizedEmail,
    fullName,
    otpCode: code,
    expiresMinutes: Math.round(ttlMinutes),
  });

  return {
    email: normalizedEmail,
    fullName,
  };
}

export async function verifyAccountOtpAndActivateUser(
  rawBody: VerifyAccountRequestDto,
): Promise<VerifyAccountResponseDto> {
  const { email, code } = validateVerifyAccountInput(rawBody);
  const normalizedEmail = normalizeEmail(email);

  const verificationResult = await verifyOtp(
    normalizedEmail,
    "ACCOUNT_ACTIVATION",
    code,
  );

  if (!verificationResult.success) {
    switch (verificationResult.reason) {
      case "NOT_FOUND":
        throw new AuthError(
          "OTP_NOT_FOUND",
          "Mã OTP không hợp lệ. Vui lòng kiểm tra lại.",
        );
      case "INVALID":
        throw new AuthError(
          "OTP_INVALID",
          "Mã OTP không chính xác. Vui lòng thử lại.",
        );
      case "EXPIRED":
        throw new AuthError(
          "OTP_EXPIRED",
          "Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.",
        );
      case "TOO_MANY_ATTEMPTS":
        throw new AuthError(
          "OTP_TOO_MANY_ATTEMPTS",
          "Bạn đã nhập sai mã OTP quá số lần cho phép. Vui lòng yêu cầu mã mới.",
        );
      default:
        throw new AuthError(
          "INVALID_INPUT",
          "Mã OTP không hợp lệ. Vui lòng thử lại.",
        );
    }
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    throw new AuthError(
      "USER_NOT_FOUND",
      "Không tìm thấy tài khoản tương ứng với email này.",
    );
  }

  if (user.emailVerified) {
    return { status: "activated" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: new Date(),
    },
  });

  return { status: "activated" };
}

export async function resendActivationOtpAndSendEmail(
  rawEmail: string,
): Promise<ResendActivationOtpResponseDto> {
  const email = rawEmail?.trim() ?? "";

  if (!email) {
    throw new AuthError(
      "INVALID_INPUT",
      "Vui lòng cung cấp địa chỉ email để gửi lại mã OTP.",
    );
  }

  const normalizedEmail = normalizeEmail(email);

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    // Không lộ thông tin tồn tại hay không, coi như xử lý thành công.
    return {
      success: true,
      message:
        "Nếu email tồn tại trong hệ thống, chúng tôi đã gửi một mã OTP mới để kích hoạt tài khoản.",
    };
  }

  if (user.emailVerified) {
    throw new AuthError(
      "USER_ALREADY_ACTIVATED",
      "Tài khoản của bạn đã được kích hoạt. Vui lòng đăng nhập để tiếp tục.",
    );
  }

  const { code, expiresAt } = await createOtp({
    email: normalizedEmail,
    userId: user.id,
    type: "ACCOUNT_ACTIVATION",
    ttlMinutes: ACTIVATION_OTP_TTL_MINUTES,
  });

  const now = new Date();
  const ttlMinutes =
    (expiresAt.getTime() - now.getTime()) / (60 * 1000) ||
    ACTIVATION_OTP_TTL_MINUTES;

  await sendAccountActivationEmail({
    toEmail: normalizedEmail,
    fullName: user.name ?? "",
    otpCode: code,
    expiresMinutes: Math.round(ttlMinutes),
  });

  return {
    success: true,
    message:
      "Chúng tôi vừa gửi một mã OTP mới đến email của bạn. Mã cũ sẽ không còn hiệu lực.",
  };
}

export async function requestPasswordResetOtpAndSendEmail(rawEmail: string) {
  const email = rawEmail?.trim() ?? "";

  if (!email) {
    throw new AuthError(
      "INVALID_INPUT",
      "Vui lòng cung cấp địa chỉ email để đặt lại mật khẩu.",
    );
  }

  const normalizedEmail = normalizeEmail(email);

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, name: true },
  });

  if (!user) {
    throw new AuthError(
      "EMAIL_NOT_FOUND",
      "Email này không tồn tại trong hệ thống. Vui lòng kiểm tra lại địa chỉ email.",
    );
  }

  const { code, expiresAt } = await createOtp({
    email: normalizedEmail,
    userId: user.id,
    type: "PASSWORD_RESET",
    ttlMinutes: 10,
  });

  const now = new Date();
  const ttlMinutes =
    (expiresAt.getTime() - now.getTime()) / (60 * 1000) || 10;

  await sendPasswordResetEmail({
    toEmail: normalizedEmail,
    fullName: user.name ?? "",
    otpCode: code,
    expiresMinutes: Math.round(ttlMinutes),
  });

  return {
    success: true,
    message:
      "Nếu email tồn tại trong hệ thống, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu đến hộp thư của bạn.",
  };
}

export async function resetPasswordWithOtp(params: {
  email: string;
  code: string;
  newPassword: string;
}): Promise<{ success: true }> {
  const email = params.email?.trim() ?? "";
  const code = params.code?.trim().toUpperCase() ?? "";
  const newPassword = params.newPassword?.trim() ?? "";

  if (!email || !code || !newPassword) {
    throw new AuthError(
      "INVALID_INPUT",
      "Vui lòng cung cấp đầy đủ email, mã OTP và mật khẩu mới.",
    );
  }

  if (code.length !== 8) {
    throw new AuthError(
      "INVALID_INPUT",
      "Mã OTP phải gồm 8 ký tự. Vui lòng kiểm tra lại.",
    );
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new AuthError(
      "INVALID_INPUT",
      "Mật khẩu mới phải có ít nhất 8 ký tự.",
    );
  }

  const normalizedEmail = normalizeEmail(email);

  const verificationResult = await verifyOtp(
    normalizedEmail,
    "PASSWORD_RESET",
    code,
  );

  if (!verificationResult.success) {
    switch (verificationResult.reason) {
      case "NOT_FOUND":
        throw new AuthError(
          "OTP_NOT_FOUND",
          "Mã OTP không hợp lệ. Vui lòng kiểm tra lại.",
        );
      case "INVALID":
        throw new AuthError(
          "OTP_INVALID",
          "Mã OTP không chính xác. Vui lòng thử lại.",
        );
      case "EXPIRED":
        throw new AuthError(
          "OTP_EXPIRED",
          "Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.",
        );
      case "TOO_MANY_ATTEMPTS":
        throw new AuthError(
          "OTP_TOO_MANY_ATTEMPTS",
          "Bạn đã nhập sai mã OTP quá số lần cho phép. Vui lòng yêu cầu mã mới.",
        );
      default:
        throw new AuthError(
          "INVALID_INPUT",
          "Mã OTP không hợp lệ. Vui lòng thử lại.",
        );
    }
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    throw new AuthError(
      "USER_NOT_FOUND",
      "Không tìm thấy tài khoản tương ứng với email này.",
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
    },
  });

  return { success: true };
}


