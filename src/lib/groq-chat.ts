/**
 * Helper gọi Groq Chat Completions cho hội thoại multi-turn (text output).
 * Khác với groq-json.ts (dùng response_format json_object cho một lượt),
 * helper này nhận mảng messages đầy đủ và trả về text thuần.
 *
 * Luồng: nhận [system, ...history, userMsg] → gọi Groq → trả answer string.
 */

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

export type GroqChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type CallGroqChatParams = {
  apiKey: string;
  model: string;
  messages: GroqChatMessage[];
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  debugLabel?: string;
};

/**
 * Gọi Groq Chat Completions với danh sách messages đầy đủ.
 * Trả về nội dung text từ assistant, hoặc null nếu lỗi/timeout.
 */
export async function callGroqChat(
  params: CallGroqChatParams,
): Promise<string | null> {
  const {
    apiKey,
    model,
    messages,
    maxTokens = 1024,
    temperature = 0.4,
    timeoutMs = 30_000,
    debugLabel = "[GroqChat]",
  } = params;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const isDebugEnabled = process.env.GROQ_DEBUG === "true";

  try {
    const response = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_completion_tokens: maxTokens,
        temperature,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => null);
      console.error(`${debugLabel} Groq request failed`, {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      return null;
    }

    const json = (await response.json()) as {
      choices?: Array<{
        message?: { content?: string | null };
        finish_reason?: string;
      }>;
    };

    if (isDebugEnabled) {
      console.log(
        `${debugLabel} Response:`,
        JSON.stringify(json.choices?.[0], null, 2),
      );
    }

    const content = json.choices?.[0]?.message?.content?.trim() ?? null;
    return content && content.length > 0 ? content : null;
  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as Error)?.name === "AbortError") {
      console.error(`${debugLabel} Request timed out after ${timeoutMs}ms`);
    } else {
      console.error(`${debugLabel} Error while calling Groq`, error);
    }
    return null;
  }
}
