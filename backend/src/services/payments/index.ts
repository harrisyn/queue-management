import prisma from '../../lib/prisma';
import { decrypt } from '../../lib/encryption';
import { PaymentProvider, ProviderName, ProviderNotActiveError } from './types';
import { StripeProvider } from './stripe.provider';
import { PaystackProvider } from './paystack.provider';

export * from './types';

export async function getProvider(name: ProviderName): Promise<PaymentProvider> {
  const config = await prisma.paymentProviderConfig.findUnique({ where: { provider: name } });
  if (!config || !config.isActive) {
    throw new ProviderNotActiveError(name);
  }

  const secretKey = decrypt(config.secretKey);
  const webhookSecret = decrypt(config.webhookSecret);

  switch (name) {
    case 'stripe':
      return new StripeProvider(secretKey, webhookSecret, config.publicKey);
    case 'paystack':
      return new PaystackProvider(secretKey, webhookSecret);
    default:
      throw new ProviderNotActiveError(name);
  }
}

export async function getActiveProviderNames(): Promise<ProviderName[]> {
  const rows = await prisma.paymentProviderConfig.findMany({
    where: { isActive: true },
    select: { provider: true },
  });
  return rows.map(r => r.provider as ProviderName);
}
