import Anthropic from "@anthropic-ai/sdk";
import { AIConfigError, type GenerateTextArgs, type TextProvider } from "./provider";

/**
 * Anthropic Claude provider. Credentials are resolved by the SDK from
 * ANTHROPIC_API_KEY (or ANTHROPIC_AUTH_TOKEN / an `ant auth login` profile).
 */
export class AnthropicProvider implements TextProvider {
  readonly name = "anthropic";
  private client: Anthropic;

  constructor(readonly model: string) {
    try {
      this.client = new Anthropic({ maxRetries: 2, timeout: 120_000 });
    } catch (err) {
      throw new AIConfigError(
        `Anthropic client could not be created (${(err as Error).message}). Set ANTHROPIC_API_KEY in your .env.`,
      );
    }
  }

  async generateText({ system, prompt, maxTokens = 4000 }: GenerateTextArgs): Promise<string> {
    let response: Anthropic.Message;
    try {
      response = await this.client.messages.create({
        model: this.model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: prompt }],
      });
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError) {
        throw new AIConfigError("Anthropic rejected the API key. Check ANTHROPIC_API_KEY.");
      }
      if (err instanceof Anthropic.NotFoundError) {
        throw new AIConfigError(`Model "${this.model}" was not found. Check AI_MODEL.`);
      }
      if (err instanceof Anthropic.RateLimitError) {
        throw new Error("Anthropic rate limit hit. Wait a moment and try again.");
      }
      if (err instanceof Anthropic.APIError) {
        throw new Error(`Anthropic API error ${err.status}: ${err.message}`);
      }
      throw err;
    }

    if (response.stop_reason === "refusal") {
      throw new Error("The model declined to generate this batch.");
    }
    return response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");
  }
}
