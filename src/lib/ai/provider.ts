import { env } from "@/lib/env";

/**
 * Minimal text-generation abstraction so the AI vendor can be swapped via
 * environment variables. Add a provider by implementing TextProvider and
 * registering it in getTextProvider().
 */
export interface GenerateTextArgs {
  system: string;
  prompt: string;
  maxTokens?: number;
}

export interface TextProvider {
  readonly name: string;
  readonly model: string;
  generateText(args: GenerateTextArgs): Promise<string>;
}

export class AIConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIConfigError";
  }
}

export interface ProviderStatus {
  provider: string;
  model: string;
  configured: boolean;
  detail: string;
}

export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5";
export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

/** Describe the current configuration without creating a client (for the admin page). */
export function getProviderStatus(): ProviderStatus {
  const provider = env.aiProvider;
  if (provider === "anthropic") {
    const configured = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
    return {
      provider,
      model: env.aiModel ?? DEFAULT_ANTHROPIC_MODEL,
      configured,
      detail: configured ? "Anthropic API key found" : "Set ANTHROPIC_API_KEY to enable generation",
    };
  }
  if (provider === "openai-compatible") {
    const configured = Boolean(process.env.OPENAI_API_KEY);
    return {
      provider,
      model: env.aiModel ?? DEFAULT_OPENAI_MODEL,
      configured,
      detail: configured
        ? `Using ${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}`
        : "Set OPENAI_API_KEY (and optionally OPENAI_BASE_URL) to enable generation",
    };
  }
  return { provider, model: env.aiModel ?? "?", configured: false, detail: `Unknown AI_PROVIDER "${provider}"` };
}

export async function getTextProvider(): Promise<TextProvider> {
  const provider = env.aiProvider;
  if (provider === "anthropic") {
    const { AnthropicProvider } = await import("./anthropic");
    return new AnthropicProvider(env.aiModel ?? DEFAULT_ANTHROPIC_MODEL);
  }
  if (provider === "openai-compatible") {
    const { OpenAICompatibleProvider } = await import("./openai-compatible");
    return new OpenAICompatibleProvider(env.aiModel ?? DEFAULT_OPENAI_MODEL);
  }
  throw new AIConfigError(`Unknown AI_PROVIDER "${provider}". Use "anthropic" or "openai-compatible".`);
}
