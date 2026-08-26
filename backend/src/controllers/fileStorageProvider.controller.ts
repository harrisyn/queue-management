import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { encrypt, decrypt, mask } from '../lib/encryption';
import { getFileStorageProvider, FileStorageProviderNotActiveError } from '../services/fileStorage';
import { FileStorageProviderName } from '../services/fileStorage/types';

const VALID_PROVIDERS: FileStorageProviderName[] = ['uploadcare'];

export const listFileStorageProviders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const configs = await prisma.fileStorageProviderConfig.findMany();
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

export const upsertFileStorageProvider = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { provider } = req.params;
    if (!VALID_PROVIDERS.includes(provider as FileStorageProviderName)) {
      return res.status(400).json({ error: 'Unknown provider' });
    }

    const { publicKey, secretKey, isActive } = req.body;
    if (!secretKey) {
      return res.status(400).json({ error: 'secretKey is required' });
    }

    const config = await prisma.fileStorageProviderConfig.upsert({
      where: { provider },
      create: {
        provider,
        publicKey: publicKey || null,
        secretKey: encrypt(secretKey),
        isActive: Boolean(isActive),
      },
      update: {
        publicKey: publicKey || null,
        secretKey: encrypt(secretKey),
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

export const testFileStorageProvider = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { provider } = req.params;
    if (!VALID_PROVIDERS.includes(provider as FileStorageProviderName)) {
      return res.status(400).json({ error: 'Unknown provider' });
    }

    try {
      // Constructing the provider (which decrypts the key) is enough to catch a
      // missing/malformed config immediately. A full API round-trip is deferred
      // to real usage, same tradeoff as testPaymentProvider.
      await getFileStorageProvider(provider as FileStorageProviderName);
      res.json({ ok: true });
    } catch (err) {
      if (err instanceof FileStorageProviderNotActiveError) {
        return res.status(400).json({ ok: false, error: err.message });
      }
      return res.status(400).json({ ok: false, error: 'Provider key validation failed' });
    }
  } catch (error) {
    next(error);
  }
};
