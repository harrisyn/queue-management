import Anthropic from '@anthropic-ai/sdk';
import type { AiMessage, ChatRequest, ChatResult, LlmProvider, ProviderSettings, StopReason, ToolCall } from '../types';
import { AiProviderError } from '../types';

export const ANTHROPIC_DEFAULT_MODEL = 'claude-opus-5';

// Server-side refusal fallback: if the model declines on policy grounds, the
// API re-runs the request on Anthropic's recommended fallback model within the
// same call instead of returning the refusal.
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

function toAnthropicMessages(messages: AiMessage[]): Anthropic.Beta.BetaMessageParam[] {
  const out: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of messages) {
    if (m.role === 'user') {
      out.push({ role: 'user', content: m.content });
    } else if (m.role === 'assistant') {
      if (m.rawProvider === 'anthropic' && Array.isArray(m.raw)) {
        // Replay the full content (thinking + tool_use blocks) unchanged.
        out.push({ role: 'assistant', content: m.raw as Anthropic.Beta.BetaContentBlockParam[] });
      } else {
        const content: Anthropic.Beta.BetaContentBlockParam[] = [];
        if (m.text) content.push({ type: 'text', text: m.text });
        for (const call of m.toolCalls) content.push({ type: 'tool_use', id: call.id, name: call.name, input: call.args });
        out.push({ role: 'assistant', content });
      }
    } else {
      // All results for one assistant turn go back in a single user message.
      out.push({
        role: 'user',
        content: m.results.map((r) => ({
          type: 'tool_result' as const,
          tool_use_id: r.callId,
          content: r.content,
          ...(r.isError ? { is_error: true } : {}),
        })),
      });
    }
  }
  return out;
}

function mapStop(reason: string | null | undefined): StopReason {
  switch (reason) {
    case 'end_turn':
    case 'stop_sequence':
      return 'end';
    case 'tool_use':
      return 'tool_use';
    case 'max_tokens':
      return 'length';
    case 'refusal':
      return 'refusal';
    default:
      return 'other';
  }
}

export function createAnthropicProvider(settings: ProviderSettings): LlmProvider {
  const client = new Anthropic({ apiKey: settings.apiKey, ...(settings.baseUrl ? { baseURL: settings.baseUrl } : {}) });
  const model = settings.model || ANTHROPIC_DEFAULT_MODEL;

  return {
    name: 'anthropic',
    model,
    async chat(request: ChatRequest): Promise<ChatResult> {
      try {
        const response = await client.beta.messages.create({
          model,
          max_tokens: request.maxTokens ?? 16000,
          betas: [FALLBACK_BETA],
          fallbacks: 'default',
          thinking: { type: 'adaptive' },
          system: [{ type: 'text', text: request.system, cache_control: { type: 'ephemeral' } }],
          tools: request.tools.map((t) => ({
            name: t.name,
            description: t.description,
            input_schema: t.parameters as Anthropic.Beta.BetaTool.InputSchema,
          })),
          messages: toAnthropicMessages(request.messages),
        });

        const toolCalls: ToolCall[] = [];
        const texts: string[] = [];
        for (const block of response.content) {
          if (block.type === 'text') texts.push(block.text);
          else if (block.type === 'tool_use') {
            // Always parse via the SDK's decoded object, never string-match.
            toolCalls.push({ id: block.id, name: block.name, args: (block.input ?? {}) as Record<string, unknown> });
          }
        }

        return {
          text: texts.join('\n').trim(),
          toolCalls,
          stop: mapStop(response.stop_reason),
          model: response.model,
          usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
          raw: response.content,
        };
      } catch (error) {
        if (error instanceof Anthropic.AuthenticationError) throw new AiProviderError('The Anthropic API key was rejected', 400);
        if (error instanceof Anthropic.RateLimitError) throw new AiProviderError('The AI provider is rate limiting requests; try again shortly', 429);
        if (error instanceof Anthropic.BadRequestError) throw new AiProviderError(`Anthropic rejected the request: ${error.message}`, 400);
        if (error instanceof Anthropic.APIError) throw new AiProviderError(`Anthropic API error ${error.status}`, 502);
        throw error;
      }
    },
  };
}
