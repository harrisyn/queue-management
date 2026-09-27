import prisma from '../../lib/prisma';
import { decrypt } from '../../lib/encryption';
import { createAnthropicProvider } from './providers/anthropic';
import { createOpenAiProvider } from './providers/openai';
import { createGeminiProvider } from './providers/gemini';
import type { LlmProvider, ProviderName, ProviderSettings } from './types';
import { PROVIDER_NAMES } from './types';

export * from './types';

/** Builds an adapter for the given settings. */
export function buildProvider(settings: ProviderSettings): LlmProvider {
  switch (settings.provider) {
    case 'anthropic':
      return createAnthropicProvider(settings);
    case 'openai':
      return createOpenAiProvider(settings, 'openai');
    case 'openai_compatible':
      if (!settings.baseUrl) throw new Error('openai_compatible needs a base URL');
      return createOpenAiProvider(settings, 'openai_compatible');
    case 'gemini':
      return createGeminiProvider(settings);
  }
}

const ENV_KEYS: Record<ProviderName, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
  openai_compatible: 'AI_API_KEY',
};

/**
 * The active provider: the superadmin's saved config if one is active,
 * otherwise environment configuration (AI_PROVIDER, default "anthropic",
 * plus that provider's key and optional AI_MODEL / AI_BASE_URL). Returns null
 * when nothing is configured.
 */
export async function getActiveProviderSettings(): Promise<ProviderSettings | null> {
  const saved = await prisma.aiProviderConfig.findFirst({ where: { isActive: true } });
  if (saved && PROVIDER_NAMES.includes(saved.provider as ProviderName)) {
    return {
      provider: saved.provider as ProviderName,
      apiKey: decrypt(saved.encryptedApiKey),
      model: saved.model,
      baseUrl: saved.baseUrl,
    };
  }

  const provider = (process.env.AI_PROVIDER || 'anthropic') as ProviderName;
  if (!PROVIDER_NAMES.includes(provider)) return null;
  const apiKey = process.env[ENV_KEYS[provider]] || process.env.AI_API_KEY;
  if (!apiKey) return null;
  return { provider, apiKey, model: process.env.AI_MODEL || null, baseUrl: process.env.AI_BASE_URL || null };
}

export async function getAiProvider(): Promise<LlmProvider | null> {
  const settings = await getActiveProviderSettings();
  return settings ? buildProvider(settings) : null;
}
