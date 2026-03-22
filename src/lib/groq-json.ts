/**
 * Helper gọi Groq Chat Completions với response_format json_object.
 * Dùng chung cho các service sinh nội dung SEO/AI (category, brand, product).
 */

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

export type CallGroqJsonParams = {
  apiKey: string;
  model: string;
  prompt: string;
  maxTokens: number;
  debugLabel: string;
};

export async function callGroqJson<T extends Record<string, unknown>>(
  params: CallGroqJsonParams,
): Promise<T | null> {
  const { apiKey, model, prompt, maxTokens, debugLabel } = params;
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
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_completion_tokens: maxTokens,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => null);
      console.error(`${debugLabel} request failed`, {
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
        `${debugLabel} Full JSON response:`,
        JSON.stringify(json, null, 2),
      );
    }

    const rawText = json.choices?.[0]?.message?.content?.trim() ?? "";
    const finishReason = json.choices?.[0]?.finish_reason;

    if (isDebugEnabled) {
      console.log(
        `${debugLabel} Raw text before JSON extraction:`,
        rawText,
      );
      console.log(`${debugLabel} finish_reason:`, finishReason);
    }

    if (!rawText) {
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
      if (isDebugEnabled) {
        console.log(
          `${debugLabel} Parsed JSON object:`,
          JSON.stringify(parsed, null, 2),
        );
      }
    } catch {
      console.error(`${debugLabel} Failed to parse JSON`, {
        rawTextSample: rawText.slice(0, 500),
      });
      return null;
    }

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return parsed as T;
  } catch (error) {
    console.error(`${debugLabel} Error while calling Groq`, error);
    return null;
  }
}
