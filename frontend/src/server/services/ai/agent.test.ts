import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/prisma', () => ({
  default: { organization: { findUnique: vi.fn(async () => ({ name: 'Test Clinic' })) } },
}));

const chat = vi.fn();
vi.mock('./index', () => ({
  getAiProvider: vi.fn(async () => ({ name: 'openai', model: 'fake-model', chat })),
}));

const listSites = vi.fn(async (orgId: string) => ({ locations: [{ id: 'loc1', name: 'Main', orgId }] }));
vi.mock('./metrics', () => ({
  listSites: (orgId: string) => listSites(orgId),
  periodSummary: vi.fn(),
  hourlyPattern: vi.fn(),
  dailyTrend: vi.fn(),
  transfers: vi.fn(),
  liveStatus: vi.fn(),
  appointmentStats: vi.fn(),
}));
vi.mock('./forecast', () => ({ forecastService: vi.fn() }));

import { runAnalyticsAgent } from './agent';

describe('runAnalyticsAgent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('runs tools scoped to the caller org and returns the answer with sources', async () => {
    chat
      .mockResolvedValueOnce({
        text: '',
        toolCalls: [{ id: 'c1', name: 'list_sites', args: {} }],
        stop: 'tool_use',
        model: 'fake-model',
        usage: { inputTokens: 100, outputTokens: 10 },
      })
      .mockResolvedValueOnce({
        text: 'You have one location, Main.',
        toolCalls: [],
        stop: 'end',
        model: 'fake-model',
        usage: { inputTokens: 150, outputTokens: 20 },
      });

    const result = await runAnalyticsAgent('org-1', 'Which locations do we have?');

    expect(listSites).toHaveBeenCalledWith('org-1');
    expect(result.answer).toBe('You have one location, Main.');
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].tool).toBe('list_sites');
    expect(result.usage).toEqual({ inputTokens: 250, outputTokens: 30 });

    // Second call must include the tool result for the first call.
    const second = chat.mock.calls[1][0];
    const toolMsg = second.messages.find((m: any) => m.role === 'tool');
    expect(toolMsg.results[0]).toMatchObject({ callId: 'c1', name: 'list_sites' });
  });

  it('returns tool errors to the model instead of throwing', async () => {
    chat
      .mockResolvedValueOnce({ text: '', toolCalls: [{ id: 'c1', name: 'no_such_tool', args: {} }], stop: 'tool_use', model: 'm', usage: { inputTokens: 1, outputTokens: 1 } })
      .mockResolvedValueOnce({ text: 'Sorry, I could not find that.', toolCalls: [], stop: 'end', model: 'm', usage: { inputTokens: 1, outputTokens: 1 } });

    const result = await runAnalyticsAgent('org-1', 'q');
    const toolMsg = chat.mock.calls[1][0].messages.find((m: any) => m.role === 'tool');
    expect(toolMsg.results[0].isError).toBe(true);
    expect(result.answer).toBe('Sorry, I could not find that.');
  });

  it('handles a refusal without leaking provider text', async () => {
    chat.mockResolvedValueOnce({ text: '', toolCalls: [], stop: 'refusal', model: 'm', usage: { inputTokens: 1, outputTokens: 0 } });
    const result = await runAnalyticsAgent('org-1', 'q');
    expect(result.answer).toMatch(/declined/);
  });
});
