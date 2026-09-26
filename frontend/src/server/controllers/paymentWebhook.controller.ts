import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { getProvider } from '../services/payments';
import { wasAlreadyProcessed, markProcessed } from '../services/payments/idempotency';
import { ProviderName, PaymentWebhookEvent } from '../services/payments/types';

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

async function applyWebhookEvent(providerName: ProviderName, event: PaymentWebhookEvent) {
  if (event.type === 'checkout_completed' && event.kind === 'addon') {
    await applyAddOnCheckoutCompleted(providerName, event);
    return;
  }

  // Renewal/cancellation events don't reliably know their own kind at the
  // provider layer (see stripe.provider.ts) - dispatched here by checking
  // which table externalSubscriptionId actually belongs to.
  if (event.type !== 'checkout_completed' && event.externalSubscriptionId) {
    const handledAsAddOn = await applyAddOnLifecycleEvent(event);
    if (handledAsAddOn) return;
  }

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
        // On checkout_completed, the org must actually move onto the plan the
        // customer just paid for — not just have its existing (often Free)
        // subscription row flipped to ACTIVE. Renewal events don't carry a
        // planId (the org is already on the right plan by then), so only
        // apply it when present.
        await prisma.organizationSubscription.update({
          where: { id: org.subscription.id },
          data: {
            status: 'ACTIVE',
            provider: providerName,
            externalProviderSubscriptionId: event.externalSubscriptionId ?? org.subscription.externalProviderSubscriptionId,
            currentPeriodEnd: periodEnd,
            ...(event.planId ? { planId: event.planId } : {}),
            ...(event.billingCycle ? { billingCycle: event.billingCycle } : {}),
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

function nextMonth(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d;
}

async function applyAddOnCheckoutCompleted(providerName: ProviderName, event: PaymentWebhookEvent) {
  if (!event.organizationId || !event.addOn) {
    console.warn('Add-on checkout_completed event missing organizationId or addOn details — ignoring');
    return;
  }

  if (event.addOn.billingMode === 'recurring' && event.externalSubscriptionId) {
    // Paystack fires charge.success for every renewal charge too, not just
    // the first one - if a row already exists for this subscription, this
    // is a renewal, not a new purchase.
    const existing = await prisma.organizationAddOn.findFirst({
      where: { externalSubscriptionId: event.externalSubscriptionId, status: 'ACTIVE' },
    });
    if (existing) {
      await prisma.organizationAddOn.update({
        where: { id: existing.id },
        data: { currentPeriodEnd: nextMonth() },
      });
      return;
    }
  }

  await prisma.organizationAddOn.create({
    data: {
      organizationId: event.organizationId,
      resourceType: event.addOn.resourceType,
      quantity: event.addOn.quantity,
      billingMode: event.addOn.billingMode === 'recurring' ? 'RECURRING' : 'ONE_OFF',
      status: 'ACTIVE',
      provider: providerName,
      externalSubscriptionId: event.addOn.billingMode === 'recurring' ? event.externalSubscriptionId : null,
      currentPeriodEnd: event.addOn.billingMode === 'recurring' ? nextMonth() : null,
    },
  });
}

// Handles renewal_succeeded / renewal_failed / subscription_cancelled for an
// add-on's own recurring subscription, matched by externalSubscriptionId.
// Returns true if this event belonged to an add-on (caller should stop),
// false if no matching add-on was found (caller falls back to plan handling).
async function applyAddOnLifecycleEvent(event: PaymentWebhookEvent): Promise<boolean> {
  if (!event.externalSubscriptionId) return false;

  const addOn = await prisma.organizationAddOn.findFirst({
    where: { externalSubscriptionId: event.externalSubscriptionId },
  });
  if (!addOn) return false;

  switch (event.type) {
    case 'renewal_succeeded':
      await prisma.organizationAddOn.update({
        where: { id: addOn.id },
        data: { currentPeriodEnd: event.currentPeriodEnd ?? nextMonth() },
      });
      break;
    case 'renewal_failed':
      // No PAST_DUE concept for add-ons in v1 - a failed renewal charge on a
      // small add-on is lower-stakes than a failed plan renewal; the
      // provider's own dunning/retry handles most cases. Revisit if this
      // proves insufficient in practice.
      console.warn(`Add-on ${addOn.id} renewal charge failed - left ACTIVE`);
      break;
    case 'subscription_cancelled':
      await prisma.organizationAddOn.update({
        where: { id: addOn.id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
      break;
  }

  return true;
}

export const handleStripeWebhook = (req: Request, res: Response) => handleWebhook('stripe', req, res);
export const handlePaystackWebhook = (req: Request, res: Response) => handleWebhook('paystack', req, res);
