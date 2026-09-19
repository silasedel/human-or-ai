import { AIConfigError, type GenerateTextArgs, type TextProvider } from "./provider";

/**
 * Generic provider for any OpenAI-compatible chat completions endpoint
 * (OpenAI, Groq, Together, Ollama, LM Studio, ...). Configure with
 * AI_PROVIDER=openai-compatible, OPENAI_API_KEY, OPENAI_BASE_URL and AI_MODEL.
 */
export class OpenAICompatibleProvider implements TextProvider {
  readonly name = "openai-compatible";
  private baseUrl: string;
  private apiKey: string;

  constructor(readonly model: string) {
    this.baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
    this.apiKey = process.env.OPENAI_API_KEY ?? "";
    if (!this.apiKey && !this.baseUrl.includes("localhost") && !this.baseUrl.includes("127.0.0.1")) {
      throw new AIConfigError("OPENAI_API_KEY is not set.");
    }
  }

  async generateText({ system, prompt, maxTokens = 4000 }: GenerateTextArgs): Promise<string> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        temperature: 1,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 401) throw new AIConfigError("The OpenAI-compatible endpoint rejected the API key.");
      throw new Error(`Provider error ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("Provider returned no text");
    return content;
  }
}
