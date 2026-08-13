import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { encrypt, decrypt, mask } from '../lib/encryption';
import { getProvider, ProviderNotActiveError } from '../services/payments';
import { ProviderName } from '../services/payments/types';

const VALID_PROVIDERS: ProviderName[] = ['stripe', 'paystack'];

export const listPaymentProviders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const configs = await prisma.paymentProviderConfig.findMany();
    const byProvider = new Map(configs.map(c => [c.provider, c]));

    const result = VALID_PROVIDERS.map(provider => {
      const config = byProvider.get(provider);
      if (!config) {
        return { provider, configured: false, isActive: false, publicKey: null, secretKeyMasked: null, updatedAt: null };
      }
      return {
        provider,
        configured: true,
        isActive: config.isActive,
        publicKey: config.publicKey,
        secretKeyMasked: mask(decrypt(config.secretKey)),
        updatedAt: config.updatedAt,
      };
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const upsertPaymentProvider = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { provider } = req.params;
    if (!VALID_PROVIDERS.includes(provider as ProviderName)) {
      return res.status(400).json({ error: 'Unknown provider' });
    }

    const { publicKey, secretKey, webhookSecret, isActive } = req.body;
    if (!secretKey || !webhookSecret) {
      return res.status(400).json({ error: 'secretKey and webhookSecret are required' });
    }

    const config = await prisma.paymentProviderConfig.upsert({
      where: { provider },
      create: {
        provider,
        publicKey: publicKey || null,
        secretKey: encrypt(secretKey),
        webhookSecret: encrypt(webhookSecret),
        isActive: Boolean(isActive),
      },
      update: {
        publicKey: publicKey || null,
        secretKey: encrypt(secretKey),
        webhookSecret: encrypt(webhookSecret),
        isActive: Boolean(isActive),
      },
    });

    res.json({
      provider: config.provider,
      configured: true,
      isActive: config.isActive,
      publicKey: config.publicKey,
      secretKeyMasked: mask(secretKey),
      updatedAt: config.updatedAt,
    });
  } catch (error) {
    next(error);
  }
};

export const testPaymentProvider = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { provider } = req.params;
    if (!VALID_PROVIDERS.includes(provider as ProviderName)) {
      return res.status(400).json({ error: 'Unknown provider' });
    }

    try {
      // Constructing the provider (which decrypts and instantiates the SDK client) is
      // enough for Stripe/Paystack to reject a malformed key immediately. A full API call
      // is deferred to real usage rather than added here — see spec's open items.
      await getProvider(provider as ProviderName);
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof ProviderNotActiveError) {
        return res.status(400).json({ ok: false, error: err.message });
      }
      return res.status(400).json({ ok: false, error: 'Provider key validation failed' });
    }
  } catch (error) {
    next(error);
  }
};
