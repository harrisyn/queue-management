import type { AiMessage, ChatRequest, ChatResult, LlmProvider, ProviderSettings, StopReason, ToolCall } from '../types';
import { AiProviderError } from '../types';

// OpenAI Chat Completions with function tools. The same wire format is spoken
// by most other vendors (Mistral, xAI, Groq, DeepSeek, Together, OpenRouter,
// Azure OpenAI, local vLLM/Ollama), so `openai_compatible` reuses this adapter
// with a custom base URL.

const OPENAI_BASE_URL = 'https://api.openai.com/v1';

type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[] }
  | { role: 'tool'; tool_call_id: string; content: string };

function toChatMessages(system: string, messages: AiMessage[]): ChatMessage[] {
  const out: ChatMessage[] = [{ role: 'system', content: system }];
  for (const m of messages) {
    if (m.role === 'user') out.push({ role: 'user', content: m.content });
    else if (m.role === 'assistant') {
      out.push({
        role: 'assistant',
        content: m.text || null,
        ...(m.toolCalls.length
          ? {
              tool_calls: m.toolCalls.map((c) => ({
                id: c.id,
                type: 'function' as const,
                function: { name: c.name, arguments: JSON.stringify(c.args) },
              })),
            }
          : {}),
      });
    } else {
      for (const r of m.results) out.push({ role: 'tool', tool_call_id: r.callId, content: r.content });
    }
  }
  return out;
}

function mapStop(reason: string | undefined): StopReason {
  switch (reason) {
    case 'stop':
      return 'end';
    case 'tool_calls':
    case 'function_call':
      return 'tool_use';
    case 'length':
      return 'length';
    case 'content_filter':
      return 'refusal';
    default:
      return 'other';
  }
}

function safeParse(json: string): Record<string, unknown> {
  try {
    const value = JSON.parse(json || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

export function createOpenAiProvider(settings: ProviderSettings, name: 'openai' | 'openai_compatible' = 'openai'): LlmProvider {
  const baseUrl = (settings.baseUrl || OPENAI_BASE_URL).replace(/\/$/, '');
  if (!settings.model) throw new AiProviderError(`Set a model name for the ${name} provider`, 400);
  const model = settings.model;

  return {
    name,
    model,
    async chat(request: ChatRequest): Promise<ChatResult> {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${settings.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: toChatMessages(request.system, request.messages),
          tools: request.tools.map((t) => ({
            type: 'function',
            function: { name: t.name, description: t.description, parameters: t.parameters },
          })),
          max_completion_tokens: request.maxTokens ?? 16000,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) {
        const message = body?.error?.message || `HTTP ${res.status}`;
        throw new AiProviderError(`${name} API error: ${message}`, res.status === 401 ? 400 : res.status === 429 ? 429 : 502);
      }

      const choice = body.choices?.[0];
      const message = choice?.message ?? {};
      const toolCalls: ToolCall[] = (message.tool_calls ?? [])
        .filter((c: any) => c?.type === 'function' || c?.function)
        .map((c: any) => ({ id: c.id, name: c.function.name, args: safeParse(c.function.arguments) }));

      return {
        text: typeof message.content === 'string' ? message.content.trim() : '',
        toolCalls,
        stop: message.refusal ? 'refusal' : mapStop(choice?.finish_reason),
        model: body.model || model,
        usage: { inputTokens: body.usage?.prompt_tokens ?? 0, outputTokens: body.usage?.completion_tokens ?? 0 },
      };
    },
  };
}
