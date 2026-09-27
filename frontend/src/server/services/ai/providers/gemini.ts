import type { AiMessage, ChatRequest, ChatResult, LlmProvider, ProviderSettings, StopReason, ToolCall } from '../types';
import { AiProviderError } from '../types';

// Google Gemini (Generative Language API) generateContent with function
// declarations.

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

type Part =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

function toContents(messages: AiMessage[]): { role: 'user' | 'model'; parts: Part[] }[] {
  const out: { role: 'user' | 'model'; parts: Part[] }[] = [];
  for (const m of messages) {
    if (m.role === 'user') out.push({ role: 'user', parts: [{ text: m.content }] });
    else if (m.role === 'assistant') {
      if (m.rawProvider === 'gemini' && Array.isArray(m.raw)) {
        // Replay the model's own parts (keeps thought signatures intact).
        out.push({ role: 'model', parts: m.raw as Part[] });
      } else {
        const parts: Part[] = [];
        if (m.text) parts.push({ text: m.text });
        for (const c of m.toolCalls) parts.push({ functionCall: { name: c.name, args: c.args } });
        out.push({ role: 'model', parts });
      }
    } else {
      out.push({
        role: 'user',
        parts: m.results.map((r) => ({ functionResponse: { name: r.name, response: { content: r.content } } })),
      });
    }
  }
  return out;
}

// Gemini accepts an OpenAPI subset: drop JSON Schema keywords it rejects.
function toGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (!schema || typeof schema !== 'object') return schema;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema as Record<string, unknown>)) {
    if (key === 'additionalProperties' || key === '$schema') continue;
    out[key] = toGeminiSchema(value);
  }
  return out;
}

function mapStop(reason: string | undefined, hasCalls: boolean): StopReason {
  if (hasCalls) return 'tool_use';
  switch (reason) {
    case 'STOP':
      return 'end';
    case 'MAX_TOKENS':
      return 'length';
    case 'SAFETY':
    case 'PROHIBITED_CONTENT':
    case 'BLOCKLIST':
      return 'refusal';
    default:
      return 'other';
  }
}

export function createGeminiProvider(settings: ProviderSettings): LlmProvider {
  if (!settings.model) throw new AiProviderError('Set a model name for the Gemini provider', 400);
  const model = settings.model;
  const baseUrl = (settings.baseUrl || GEMINI_BASE_URL).replace(/\/$/, '');

  return {
    name: 'gemini',
    model,
    async chat(request: ChatRequest): Promise<ChatResult> {
      const res = await fetch(`${baseUrl}/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': settings.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: request.system }] },
          contents: toContents(request.messages),
          tools: [
            {
              functionDeclarations: request.tools.map((t) => ({
                name: t.name,
                description: t.description,
                parameters: toGeminiSchema(t.parameters),
              })),
            },
          ],
          generationConfig: { maxOutputTokens: request.maxTokens ?? 16000 },
        }),
      });
      const body = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) {
        const message = body?.error?.message || `HTTP ${res.status}`;
        throw new AiProviderError(`Gemini API error: ${message}`, res.status === 400 || res.status === 403 ? 400 : res.status === 429 ? 429 : 502);
      }

      const candidate = body.candidates?.[0];
      const parts: any[] = candidate?.content?.parts ?? [];
      const toolCalls: ToolCall[] = parts
        .filter((p) => p.functionCall)
        .map((p, i) => ({ id: `call_${i}_${p.functionCall.name}`, name: p.functionCall.name, args: p.functionCall.args ?? {} }));
      const text = parts.filter((p) => typeof p.text === 'string' && !p.thought).map((p) => p.text).join('').trim();

      return {
        text,
        toolCalls,
        stop: body.promptFeedback?.blockReason ? 'refusal' : mapStop(candidate?.finishReason, toolCalls.length > 0),
        model: body.modelVersion || model,
        usage: {
          inputTokens: body.usageMetadata?.promptTokenCount ?? 0,
          outputTokens: body.usageMetadata?.candidatesTokenCount ?? 0,
        },
        raw: parts,
      };
    },
  };
}
