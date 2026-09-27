import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { encrypt, decrypt, mask } from '../lib/encryption';
import { SMS_PROVIDERS, SmsProviderName, buildSmsProvider, clearSmsProviderCache } from '../services/sms';

const isProvider = (p: string): p is SmsProviderName => (SMS_PROVIDERS as readonly string[]).includes(p);

export const listSmsProviders = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const configs = await prisma.smsProviderConfig.findMany();
    const byProvider = new Map(configs.map((c) => [c.provider, c]));
    res.json({
      envFallback: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER),
      providers: SMS_PROVIDERS.map((provider) => {
        const c = byProvider.get(provider);
        return c
          ? { provider, configured: true, isActive: c.isActive, accountId: c.accountId, senderId: c.senderId, secretMasked: mask(decrypt(c.secret)), updatedAt: c.updatedAt }
          : { provider, configured: false, isActive: false, accountId: null, senderId: null, secretMasked: null, updatedAt: null };
      }),
    });
  } catch (error) {
    next(error);
  }
};

export const upsertSmsProvider = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { provider } = req.params;
    if (!isProvider(provider)) return res.status(400).json({ error: 'Unknown provider' });
    const accountId = String(req.body?.accountId || '').trim();
    const secret = String(req.body?.secret || '').trim();
    const senderId = String(req.body?.senderId || '').trim() || null;
    const isActive = Boolean(req.body?.isActive);
    const existing = await prisma.smsProviderConfig.findUnique({ where: { provider } });

    if (!accountId) return res.status(400).json({ error: provider === 'twilio' ? 'Enter the account SID.' : 'Enter the username.' });
    if (!secret && !existing) return res.status(400).json({ error: provider === 'twilio' ? 'Enter the auth token.' : 'Enter the API key.' });
    if (provider === 'twilio' && !senderId) return res.status(400).json({ error: 'Twilio needs a from number.' });

    const data = { accountId, senderId, isActive, ...(secret ? { secret: encrypt(secret) } : {}) };
    const config = await prisma.$transaction(async (tx) => {
      // Only one provider sends at a time.
      if (isActive) await tx.smsProviderConfig.updateMany({ where: { provider: { not: provider } }, data: { isActive: false } });
      return tx.smsProviderConfig.upsert({
        where: { provider },
        create: { provider, ...data, secret: data.secret ?? encrypt(secret) },
        update: data,
      });
    });
    clearSmsProviderCache();
    res.json({ provider, configured: true, isActive: config.isActive, accountId: config.accountId, senderId: config.senderId, secretMasked: mask(decrypt(config.secret)), updatedAt: config.updatedAt });
  } catch (error) {
    next(error);
  }
};

/** Sends a real test message to the number given. */
export const testSmsProvider = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { provider } = req.params;
    if (!isProvider(provider)) return res.status(400).json({ error: 'Unknown provider' });
    const to = String(req.body?.to || '').trim();
    if (!/^\+?[0-9 ()-]{7,20}$/.test(to)) return res.status(400).json({ error: 'Enter a phone number in international format, e.g. +233 20 000 0000.' });
    const config = await prisma.smsProviderConfig.findUnique({ where: { provider } });
    if (!config) return res.status(400).json({ error: 'Save the settings first.' });
    const sms = buildSmsProvider(config.provider, config.accountId, decrypt(config.secret), config.senderId);
    if (!sms) return res.status(400).json({ error: 'The settings are incomplete.' });
    const result = await sms.send(to.replace(/[ ()-]/g, ''), 'Test message: text alerts are set up and working.');
    if (!result.success) return res.status(502).json({ error: result.error || 'The provider rejected the message.' });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
};
