import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { encrypt, decrypt, mask } from '../lib/encryption';
import { loadCaller } from '../middleware/tenantScope.middleware';
import { getOrganizationFeatures, consumeCredits } from '../middleware/subscription.middleware';
import { runAnalyticsAgent, AiNotConfiguredError, DIGEST_QUESTION } from '../services/ai/agent';
import { forecastService, locationAlerts } from '../services/ai/forecast';
import { buildProvider, getActiveProviderSettings, PROVIDER_NAMES, ProviderName, AiProviderError } from '../services/ai';
import { ANTHROPIC_DEFAULT_MODEL } from '../services/ai/providers/anthropic';

async function callerOrgId(req: Request): Promise<string | null> {
  const caller = await loadCaller(req);
  return caller?.organizationId ?? null;
}

/** Why AI can't run for an org right now, or null if it can. */
async function aiBlocker(organizationId: string): Promise<{ status: number; code: string; message: string } | null> {
  const [features, org, settings] = await Promise.all([
    getOrganizationFeatures(organizationId),
    prisma.organization.findUnique({ where: { id: organizationId }, select: { aiEnabled: true } }),
    getActiveProviderSettings(),
  ]);
  if (!features.ai) return { status: 403, code: 'PLAN', message: 'AI-assisted analytics is not included in your plan.' };
  if (!org?.aiEnabled) return { status: 403, code: 'DISABLED', message: 'AI-assisted analytics is turned off for your organization.' };
  if (!settings) return { status: 503, code: 'PROVIDER', message: 'AI is not set up on this platform yet.' };
  return null;
}

export const getAiStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const organizationId = await callerOrgId(req);
    if (!organizationId) return res.status(404).json({ error: 'Not found' });
    const [features, org, settings] = await Promise.all([
      getOrganizationFeatures(organizationId),
      prisma.organization.findUnique({ where: { id: organizationId }, select: { aiEnabled: true } }),
      getActiveProviderSettings(),
    ]);
    res.json({
      planIncludesAi: !!features.ai,
      enabled: !!org?.aiEnabled,
      providerConfigured: !!settings,
      provider: settings?.provider ?? null,
    });
  } catch (error) {
    next(error);
  }
};

export const updateAiSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const organizationId = await callerOrgId(req);
    if (!organizationId) return res.status(404).json({ error: 'Not found' });
    const enabled = Boolean(req.body?.enabled);
    if (enabled) {
      const features = await getOrganizationFeatures(organizationId);
      if (!features.ai) return res.status(403).json({ error: 'AI-assisted analytics is not included in your plan.', upgradeRequired: true });
    }
    await prisma.organization.update({ where: { id: organizationId }, data: { aiEnabled: enabled } });
    res.json({ enabled });
  } catch (error) {
    next(error);
  }
};

export const askAi = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const organizationId = await callerOrgId(req);
    if (!organizationId) return res.status(404).json({ error: 'Not found' });
    const question = String(req.body?.question || '').trim();
    if (question.length < 3) return res.status(400).json({ error: 'Ask a question about your queues.' });
    if (question.length > 1000) return res.status(400).json({ error: 'Keep the question under 1000 characters.' });

    const blocker = await aiBlocker(organizationId);
    if (blocker) return res.status(blocker.status).json({ error: blocker.message, code: blocker.code });

    const credit = await consumeCredits(organizationId, 'AI', 1, 'AI analytics question');
    if (!credit.allowed) {
      return res.status(402).json({ error: 'Your AI credits for this billing period are used up.', code: 'CREDITS' });
    }

    const result = await runAnalyticsAgent(organizationId, question);
    const insight = await prisma.aiInsight.create({
      data: {
        organizationId,
        kind: 'ASK',
        locationId: req.body?.locationId || null,
        question,
        answer: result.answer,
        sources: result.sources as any,
        model: `${result.provider}:${result.model}`,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        createdBy: req.user?.userId ?? null,
      },
    });
    res.json({ ...insight, creditsRemaining: credit.remaining });
  } catch (error) {
    if (error instanceof AiNotConfiguredError) return res.status(503).json({ error: 'AI is not set up on this platform yet.' });
    if (error instanceof AiProviderError) return res.status(error.status).json({ error: error.message });
    next(error);
  }
};

export const listInsights = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const organizationId = await callerOrgId(req);
    if (!organizationId) return res.status(404).json({ error: 'Not found' });
    const kind = req.query.kind === 'DIGEST' ? 'DIGEST' : req.query.kind === 'ASK' ? 'ASK' : undefined;
    const insights = await prisma.aiInsight.findMany({
      where: { organizationId, ...(kind ? { kind } : {}) },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(req.query.limit) || 10, 50),
    });
    res.json(insights);
  } catch (error) {
    next(error);
  }
};

export const getForecast = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const organizationId = await callerOrgId(req);
    if (!organizationId) return res.status(404).json({ error: 'Not found' });
    const forecast = await forecastService(organizationId, req.params.serviceId);
    if (!forecast) return res.status(404).json({ error: 'Service not found' });
    res.json(forecast);
  } catch (error) {
    next(error);
  }
};

export const getAlerts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const organizationId = await callerOrgId(req);
    if (!organizationId) return res.status(404).json({ error: 'Not found' });
    const locationId = String(req.query.locationId || '');
    if (!locationId) return res.status(400).json({ error: 'locationId is required' });
    res.json(await locationAlerts(organizationId, locationId));
  } catch (error) {
    next(error);
  }
};

/** Daily digest for one org (called by cron). Returns the insight, or null
 * when the org can't run AI or has no credits left. */
export async function createDailyDigest(organizationId: string) {
  if (await aiBlocker(organizationId)) return null;
  const credit = await consumeCredits(organizationId, 'AI', 1, 'AI daily digest');
  if (!credit.allowed) return null;
  const result = await runAnalyticsAgent(organizationId, DIGEST_QUESTION);
  return prisma.aiInsight.create({
    data: {
      organizationId,
      kind: 'DIGEST',
      question: DIGEST_QUESTION,
      answer: result.answer,
      sources: result.sources as any,
      model: `${result.provider}:${result.model}`,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
    },
  });
}

// ---------------------------------------------------------------------------
// Superadmin: provider configuration
// ---------------------------------------------------------------------------

const DEFAULT_MODELS: Partial<Record<ProviderName, string>> = { anthropic: ANTHROPIC_DEFAULT_MODEL };

export const listAiProviders = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const configs = await prisma.aiProviderConfig.findMany();
    const byProvider = new Map(configs.map((c) => [c.provider, c]));
    res.json(
      PROVIDER_NAMES.map((provider) => {
        const c = byProvider.get(provider);
        return {
          provider,
          configured: !!c,
          isActive: c?.isActive ?? false,
          model: c?.model ?? null,
          defaultModel: DEFAULT_MODELS[provider] ?? null,
          baseUrl: c?.baseUrl ?? null,
          apiKeyMasked: c ? mask(decrypt(c.encryptedApiKey)) : null,
          updatedAt: c?.updatedAt ?? null,
        };
      })
    );
  } catch (error) {
    next(error);
  }
};

export const upsertAiProvider = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const provider = req.params.provider as ProviderName;
    if (!PROVIDER_NAMES.includes(provider)) return res.status(400).json({ error: 'Unknown provider' });
    const { apiKey, model, baseUrl, isActive } = req.body;
    const existing = await prisma.aiProviderConfig.findUnique({ where: { provider } });
    if (!apiKey && !existing) return res.status(400).json({ error: 'apiKey is required' });
    if (provider !== 'anthropic' && !model) return res.status(400).json({ error: 'model is required for this provider' });
    if (provider === 'openai_compatible' && !baseUrl) return res.status(400).json({ error: 'baseUrl is required for an OpenAI-compatible provider' });

    const data = {
      model: model || null,
      baseUrl: baseUrl || null,
      isActive: Boolean(isActive),
      ...(apiKey ? { encryptedApiKey: encrypt(apiKey) } : {}),
    };
    await prisma.$transaction(async (tx) => {
      // Only one provider serves requests at a time.
      if (data.isActive) await tx.aiProviderConfig.updateMany({ where: { provider: { not: provider } }, data: { isActive: false } });
      if (existing) await tx.aiProviderConfig.update({ where: { provider }, data });
      else await tx.aiProviderConfig.create({ data: { provider, encryptedApiKey: encrypt(apiKey), model: data.model, baseUrl: data.baseUrl, isActive: data.isActive } });
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};

/** Sends a one-line prompt to the saved config (active or not). */
export const testAiProvider = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const provider = req.params.provider as ProviderName;
    const config = await prisma.aiProviderConfig.findUnique({ where: { provider } });
    if (!config) return res.status(404).json({ ok: false, error: 'Save this provider first' });
    const llm = buildProvider({ provider, apiKey: decrypt(config.encryptedApiKey), model: config.model, baseUrl: config.baseUrl });
    const result = await llm.chat({
      system: 'You are a connectivity check.',
      messages: [{ role: 'user', content: 'Reply with the single word OK.' }],
      tools: [],
      maxTokens: 1024,
    });
    res.json({ ok: result.stop !== 'refusal', model: result.model, reply: result.text.slice(0, 100) });
  } catch (error) {
    if (error instanceof AiProviderError) return res.status(400).json({ ok: false, error: error.message });
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : 'Test failed' });
  }
};
