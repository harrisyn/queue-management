import prisma from '../../lib/prisma';
import { getAiProvider } from './index';
import type { AiMessage, ToolCall, ToolSpec } from './types';
import { AiProviderError } from './types';
import {
  listSites,
  periodSummary,
  hourlyPattern,
  dailyTrend,
  transfers,
  liveStatus,
  appointmentStats,
  Scope,
} from './metrics';
import { forecastService } from './forecast';

/**
 * AI analytics agent. Works with any provider (see ./providers): the model
 * gets read-only tools that return org-scoped aggregates, and every tool
 * result is kept as a "source" so answers can be checked against the numbers.
 */

const MAX_ROUNDS = 6;
const MAX_SOURCE_CHARS = 20_000;

const dateParam = { type: 'string', description: 'YYYY-MM-DD' };
const scopeParams = {
  locationId: { type: 'string', description: 'Limit to one location (id from list_sites). Omit for all locations.' },
  serviceId: { type: 'string', description: 'Limit to one service (id from list_sites). Omit for all services.' },
};

export const TOOLS: ToolSpec[] = [
  {
    name: 'list_sites',
    description: 'Lists the organization\'s locations and their services with ids. Call this first to resolve names to ids.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_period_summary',
    description:
      'Totals for a date range: tickets joined, served, cancelled, no-shows, no-show rate, wait and service time (avg/median/p90 minutes), busiest day, and a per-service breakdown. Default range is the last 7 days.',
    parameters: {
      type: 'object',
      properties: { ...scopeParams, startDate: dateParam, endDate: dateParam },
      additionalProperties: false,
    },
  },
  {
    name: 'get_hourly_pattern',
    description: 'Average arrivals per day and average wait by hour of day and by weekday over the last N days (default 28, max 90).',
    parameters: {
      type: 'object',
      properties: { ...scopeParams, days: { type: 'integer', minimum: 1, maximum: 90 } },
      additionalProperties: false,
    },
  },
  {
    name: 'get_daily_trend',
    description: 'Per-day joined, served, no-shows and average wait for the last N days (default 14, max 90).',
    parameters: {
      type: 'object',
      properties: { ...scopeParams, days: { type: 'integer', minimum: 1, maximum: 90 } },
      additionalProperties: false,
    },
  },
  {
    name: 'get_transfers',
    description: 'Patient movements between services (e.g. Reception -> Doctor) in a date range, with counts and average wait at the next service.',
    parameters: {
      type: 'object',
      properties: { locationId: scopeParams.locationId, startDate: dateParam, endDate: dateParam },
      additionalProperties: false,
    },
  },
  {
    name: 'get_live_status',
    description: 'Right now: per service, people waiting, being served, longest current wait, and queue status.',
    parameters: { type: 'object', properties: scopeParams, additionalProperties: false },
  },
  {
    name: 'get_wait_forecast',
    description:
      'Statistical forecast for one service: predicted wait for someone joining now, typical and busy wait for this hour, typical service time, and expected arrivals for the rest of today.',
    parameters: {
      type: 'object',
      properties: { serviceId: scopeParams.serviceId },
      required: ['serviceId'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_appointment_stats',
    description: 'Appointment counts by status in a date range, plus past appointments that were never checked in.',
    parameters: {
      type: 'object',
      properties: { ...scopeParams, startDate: dateParam, endDate: dateParam },
      additionalProperties: false,
    },
  },
];

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const int = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback);

async function runTool(organizationId: string, call: ToolCall): Promise<unknown> {
  const a = call.args || {};
  const scope: Scope = { organizationId, locationId: str(a.locationId), serviceId: str(a.serviceId) };
  switch (call.name) {
    case 'list_sites':
      return listSites(organizationId);
    case 'get_period_summary':
      return periodSummary(scope, a.startDate, a.endDate);
    case 'get_hourly_pattern':
      return hourlyPattern(scope, int(a.days, 28));
    case 'get_daily_trend':
      return dailyTrend(scope, int(a.days, 14));
    case 'get_transfers':
      return transfers(scope, a.startDate, a.endDate);
    case 'get_live_status':
      return liveStatus(scope);
    case 'get_wait_forecast': {
      const serviceId = str(a.serviceId);
      if (!serviceId) throw new Error('serviceId is required');
      const result = await forecastService(organizationId, serviceId);
      if (!result) throw new Error('No such service in this organization');
      return result;
    }
    case 'get_appointment_stats':
      return appointmentStats(scope, a.startDate, a.endDate);
    default:
      throw new Error(`Unknown tool ${call.name}`);
  }
}

function systemPrompt(orgName: string, today: string) {
  return `You are the operations analyst for ${orgName}, which uses a queue and appointment system to serve patients or customers across one or more locations. Today is ${today}.

Answer the staff member's question using the tools, which return live and historical aggregates for this organization only. Base every number you state on a tool result; if the data can't answer the question, say what's missing rather than estimating. Resolve location and service names with list_sites before filtering by id.

Write for a busy clinic or office manager: lead with the direct answer, then the two to four numbers that support it, then at most three practical suggestions (staffing, opening hours, service flow, reminders) when the data points to one. Keep it under 200 words, use short paragraphs or bullets, and give time periods explicitly. The data contains no patient identities; never speculate about individuals.`;
}

export interface AgentSource {
  tool: string;
  input: Record<string, unknown>;
  output: unknown;
}

export interface AgentAnswer {
  answer: string;
  sources: AgentSource[];
  model: string;
  provider: string;
  usage: { inputTokens: number; outputTokens: number };
}

export class AiNotConfiguredError extends Error {}

export async function runAnalyticsAgent(organizationId: string, question: string): Promise<AgentAnswer> {
  const provider = await getAiProvider();
  if (!provider) throw new AiNotConfiguredError('No AI provider is configured');

  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } });
  const system = systemPrompt(org?.name ?? 'this organization', new Date().toISOString().slice(0, 10));
  const messages: AiMessage[] = [{ role: 'user', content: question }];
  const sources: AgentSource[] = [];
  const usage = { inputTokens: 0, outputTokens: 0 };
  let model = provider.model;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const result = await provider.chat({ system, messages, tools: TOOLS });
    usage.inputTokens += result.usage.inputTokens;
    usage.outputTokens += result.usage.outputTokens;
    model = result.model;

    if (result.stop === 'refusal') {
      return { answer: 'The AI provider declined to answer this question. Try rephrasing it around queue and service data.', sources, model, provider: provider.name, usage };
    }
    if (result.toolCalls.length === 0) {
      const answer = result.text || (result.stop === 'length' ? 'The answer was cut off. Try a narrower question.' : 'No answer was produced.');
      return { answer, sources, model, provider: provider.name, usage };
    }

    messages.push({ role: 'assistant', text: result.text, toolCalls: result.toolCalls, raw: result.raw, rawProvider: provider.name });

    // Run this turn's calls concurrently; return every result together.
    const results = await Promise.all(
      result.toolCalls.map(async (call) => {
        try {
          const output = await runTool(organizationId, call);
          sources.push({ tool: call.name, input: call.args, output });
          const content = JSON.stringify(output);
          return { callId: call.id, name: call.name, content: content.length > MAX_SOURCE_CHARS ? content.slice(0, MAX_SOURCE_CHARS) + '…(truncated)' : content };
        } catch (error) {
          return { callId: call.id, name: call.name, content: `Error: ${error instanceof Error ? error.message : 'tool failed'}`, isError: true };
        }
      })
    );
    messages.push({ role: 'tool', results });
  }

  throw new AiProviderError('The analysis took too many steps. Try a more specific question.', 422);
}

export const DIGEST_QUESTION =
  "Write yesterday's operations digest. Cover: volume vs the previous 7-day average, average and worst waits by service, no-show rate, any service or hour that was a bottleneck, and transfers between services if any. End with up to three concrete suggestions for today. If there was no activity yesterday, say so in one sentence.";
