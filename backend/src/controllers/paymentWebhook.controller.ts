import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { getProvider } from '../services/payments';
import { wasAlreadyProcessed, markProcessed } from '../services/payments/idempotency';
import { ProviderName } from '../services/payments/types';

async function handleWebhook(providerName: ProviderName, req: Request, res: Response) {
  let provider;
  try {
    provider = await getProvider(providerName);
  } catch (err) {
    console.error(`Webhook received for inactive provider "${providerName}"`, err);
    return res.status(400).json({ error: 'Provider not configured' });
  }

  const signatureHeader = providerName === 'stripe'
    ? (req.headers['stripe-signature'] as string)
    : (req.headers['x-paystack-signature'] as string);

  const rawBody = req.body as Buffer; // populated by express.raw() on this route
  const event = provider.verifyWebhookSignature(rawBody, signatureHeader);

  if (!event) {
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  if (await wasAlreadyProcessed(providerName, event.eventId)) {
    // Already handled — acknowledge without reprocessing (safe retry)
    return res.status(200).json({ ok: true, duplicate: true });
  }

  try {
    await applyWebhookEvent(providerName, event);
    await markProcessed(providerName, event.eventId);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(`Failed to apply ${providerName} webhook event ${event.eventId}:`, err);
    // 500 so the provider retries later; markProcessed was NOT called, so retry will reprocess
    return res.status(500).json({ error: 'Failed to process webhook' });
  }
}

async function applyWebhookEvent(
  providerName: ProviderName,
  event: { type: string; organizationId: string | null; externalSubscriptionId: string | null; currentPeriodEnd: Date | null }
) {
  let organizationId = event.organizationId;

  // Renewal/cancellation events identify the org by externalProviderSubscriptionId instead
  if (!organizationId && event.externalSubscriptionId) {
    const existing = await prisma.organizationSubscription.findFirst({
      where: { externalProviderSubscriptionId: event.externalSubscriptionId },
      include: { organizations: true },
    });
    organizationId = existing?.organizations[0]?.id ?? null;
  }

  if (!organizationId) {
    console.warn(`Webhook event ${event.type} could not be matched to an organization — ignoring`);
    return;
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { subscription: true },
  });
  if (!org) {
    console.warn(`Webhook event ${event.type} references unknown organization ${organizationId} — ignoring`);
    return;
  }

  switch (event.type) {
    case 'checkout_completed':
    case 'renewal_succeeded': {
      const periodEnd = event.currentPeriodEnd ?? (() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        return d;
      })();

      if (org.subscription) {
        await prisma.organizationSubscription.update({
          where: { id: org.subscription.id },
          data: {
            status: 'ACTIVE',
            provider: providerName,
            externalProviderSubscriptionId: event.externalSubscriptionId ?? org.subscription.externalProviderSubscriptionId,
            currentPeriodEnd: periodEnd,
          },
        });
      } else {
        console.warn(`Webhook ${event.type} for org ${organizationId} but org has no subscription row yet — skipping (expected to be created by checkout flow before webhook arrives in normal operation)`);
      }
      break;
    }
    case 'renewal_failed': {
      if (org.subscription) {
        await prisma.organizationSubscription.update({
          where: { id: org.subscription.id },
          data: { status: 'PAST_DUE' },
        });
      }
      break;
    }
    case 'subscription_cancelled': {
      if (org.subscription) {
        await prisma.organizationSubscription.update({
          where: { id: org.subscription.id },
          data: { status: 'CANCELLED', cancelledAt: new Date() },
        });
      }
      break;
    }
  }
}

export const handleStripeWebhook = (req: Request, res: Response) => handleWebhook('stripe', req, res);
export const handlePaystackWebhook = (req: Request, res: Response) => handleWebhook('paystack', req, res);
