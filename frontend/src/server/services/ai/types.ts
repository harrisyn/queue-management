// Provider-neutral shapes for the AI analytics agent. Each adapter in
// ./providers translates these to and from its vendor's API, so the agent
// loop, tools and prompts never depend on a particular LLM vendor.

export type ProviderName = 'anthropic' | 'openai' | 'gemini' | 'openai_compatible';

export const PROVIDER_NAMES: ProviderName[] = ['anthropic', 'openai', 'gemini', 'openai_compatible'];

/** JSON Schema (object) describing a tool's arguments. */
export interface JsonSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface ToolSpec {
  name: string;
  description: string;
  parameters: JsonSchema;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export type AiMessage =
  | { role: 'user'; content: string }
  | {
      role: 'assistant';
      text: string;
      toolCalls: ToolCall[];
      // The vendor's own response content, replayed verbatim to the same
      // provider on the next turn (e.g. Anthropic thinking blocks must be
      // echoed unchanged). Ignored by other providers.
      raw?: unknown;
      rawProvider?: ProviderName;
    }
  | { role: 'tool'; results: { callId: string; name: string; content: string; isError?: boolean }[] };

export type StopReason = 'end' | 'tool_use' | 'length' | 'refusal' | 'other';

export interface ChatRequest {
  system: string;
  messages: AiMessage[];
  tools: ToolSpec[];
  maxTokens?: number;
}

export interface ChatResult {
  text: string;
  toolCalls: ToolCall[];
  stop: StopReason;
  model: string;
  usage: { inputTokens: number; outputTokens: number };
  raw?: unknown;
}

export interface LlmProvider {
  name: ProviderName;
  model: string;
  chat(request: ChatRequest): Promise<ChatResult>;
}

export interface ProviderSettings {
  provider: ProviderName;
  apiKey: string;
  model?: string | null;
  baseUrl?: string | null;
}

export class AiProviderError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}
