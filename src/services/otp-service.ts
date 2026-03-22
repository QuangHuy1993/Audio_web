import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const OTP_LENGTH = 8;
const OTP_TTL_MINUTES = 10;
const OTP_SALT_ROUNDS = 10;

// Lưu ý: Prisma Client trong môi trường lint hiện tại
// chưa cập nhật enum OtpType, nên dùng union string
// khớp với giá trị enum trong schema.prisma để tránh lỗi type.
export type OtpTypeString = "ACCOUNT_ACTIVATION" | "PASSWORD_RESET";

type CreateOtpParams = {
  email: string;
  userId?: string;
  type: OtpTypeString;
  ttlMinutes?: number;
};

type PrismaOtpDelegate = {
  updateMany: (...args: unknown[]) => Promise<unknown>;
  create: (...args: unknown[]) => Promise<{
    id: string;
    expiresAt: Date;
  }>;
  findFirst: (...args: unknown[]) => Promise<{
    id: string;
    email: string;
    userId: string | null;
    codeHash: string;
    expiresAt: Date;
    attempts: number;
    maxAttempts: number;
    consumedAt: Date | null;
    verifiedAt: Date | null;
  } | null>;
  update: (...args: unknown[]) => Promise<unknown>;
};

const prismaOtp: PrismaOtpDelegate = (prisma as unknown as {
  otpCode: PrismaOtpDelegate;
}).otpCode;

export type OtpVerificationResult =
  | { success: true; reason: null }
  | {
      success: false;
      reason: "NOT_FOUND" | "EXPIRED" | "INVALID" | "TOO_MANY_ATTEMPTS";
    };

export function generateOtpCode(): string {
  const digits = "0123456789";
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  let code = "";

  for (let i = 0; i < OTP_LENGTH; i += 1) {
    const isEvenIndex = i % 2 === 0;

    if (isEvenIndex) {
      const dIndex = Math.floor(Math.random() * digits.length);
      code += digits[dIndex];
    } else {
      const lIndex = Math.floor(Math.random() * letters.length);
      code += letters[lIndex];
    }
  }

  return code;
}

export async function createOtp(params: CreateOtpParams) {
  const { email, userId, type } = params;
  const ttlMinutes = params.ttlMinutes ?? OTP_TTL_MINUTES;

  const code = generateOtpCode();
  const codeHash = await bcrypt.hash(code, OTP_SALT_ROUNDS);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

  await prismaOtp.updateMany({
    where: {
      email,
      type,
      consumedAt: null,
    },
    data: {
      consumedAt: now,
    },
  });

  const record = await prismaOtp.create({
    data: {
      email,
      userId,
      type,
      codeHash,
      expiresAt,
    },
  });

  return {
    otpId: record.id,
    code,
    expiresAt,
  };
}

export async function verifyOtp(
  email: string,
  type: OtpTypeString,
  code: string,
  userId?: string,
): Promise<OtpVerificationResult> {
  const now = new Date();

  const otpRecord = await prismaOtp.findFirst({
    where: {
      email,
      type,
      consumedAt: null,
      userId: userId ?? undefined,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!otpRecord) {
    return { success: false, reason: "NOT_FOUND" };
  }

  if (otpRecord.attempts >= otpRecord.maxAttempts) {
    await prismaOtp.update({
      where: { id: otpRecord.id },
      data: {
        consumedAt: otpRecord.consumedAt ?? now,
      },
    });

    return { success: false, reason: "TOO_MANY_ATTEMPTS" };
  }

  if (now > otpRecord.expiresAt) {
    await prismaOtp.update({
      where: { id: otpRecord.id },
      data: {
        consumedAt: now,
      },
    });

    return { success: false, reason: "EXPIRED" };
  }

  const isMatch = await bcrypt.compare(code, otpRecord.codeHash);

  if (!isMatch) {
    const nextAttempts = otpRecord.attempts + 1;
    await prismaOtp.update({
      where: { id: otpRecord.id },
      data: {
        attempts: nextAttempts,
        consumedAt:
          nextAttempts >= otpRecord.maxAttempts
            ? otpRecord.consumedAt ?? now
            : otpRecord.consumedAt,
      },
    });

    return { success: false, reason: "INVALID" };
  }

  await prismaOtp.update({
    where: { id: otpRecord.id },
    data: {
      verifiedAt: now,
      consumedAt: now,
    },
  });

  return { success: true, reason: null };
}

