/**
 * Service log phiên AI (AiSession) cho các tương tác shop-facing.
 *
 * Mục đích: ghi lại mỗi lần người dùng hỏi AI (ADVICE, RECOMMENDATION,
 * COMPARISON, SEARCH) để phân tích hành vi và cải thiện prompt.
 *
 * Quy tắc:
 * - Chỉ ghi từ server sau khi API AI shop có kết quả.
 * - Không throw lỗi ra ngoài – lỗi log chỉ ghi server-side.
 * - Cắt input/output tối đa MAX_LENGTH để tránh blob quá lớn.
 */

import { AiSessionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const MAX_INPUT_LENGTH = 5000;
const MAX_OUTPUT_LENGTH = 5000;

export type CreateAiSessionInput = {
  userId?: string | null;
  type: AiSessionType;
  input: string;
  output: string;
  model?: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Tạo bản ghi AiSession trong DB.
 * Hàm này không throw – mọi lỗi đều được bắt và log server-side.
 * Dùng fire-and-forget: không cần await ở nơi gọi.
 */
export async function createAiSession(
  data: CreateAiSessionInput,
): Promise<void> {
  try {
    await prisma.aiSession.create({
      data: {
        userId: data.userId ?? null,
        type: data.type,
        input: data.input.slice(0, MAX_INPUT_LENGTH),
        output: data.output.slice(0, MAX_OUTPUT_LENGTH),
        model: data.model ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        metadata: (data.metadata as any) ?? undefined,
      },
    });
  } catch (error) {
    console.error("[AiSession] Failed to log session:", error);
  }
}
