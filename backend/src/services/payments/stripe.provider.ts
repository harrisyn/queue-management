import Stripe from 'stripe';
import { PaymentProvider, CreateCheckoutParams, CheckoutResult, PaymentWebhookEvent } from './types';

// Stripe's `recurring.interval` has no native "quarter" value - quarterly
// billing is expressed as 3 one-month intervals. Exported for testing.
export function resolveStripeInterval(billingCycle: 'monthly' | 'quarterly' | 'yearly'): { interval: 'month' | 'year'; interval_count: number } {
  if (billingCycle === 'yearly') return { interval: 'year', interval_count: 1 };
  if (billingCycle === 'quarterly') return { interval: 'month', interval_count: 3 };
  return { interval: 'month', interval_count: 1 };
}

export class StripeProvider implements PaymentProvider {
  name = 'stripe' as const;
  private client: Stripe;
  private webhookSecret: string;

  constructor(secretKey: string, webhookSecret: string, _publicKey?: string | null) {
    // No explicit apiVersion pinned — uses the Stripe account's configured
    // default API version, avoiding a hardcoded literal that this SDK's
    // types would otherwise force to track every Stripe API release.
    this.client = new Stripe(secretKey);
    this.webhookSecret = webhookSecret;
  }

  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutResult> {
    const session = await this.client.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price_data: {
            currency: params.currency.toLowerCase(),
            product_data: { name: `${params.planName} (${params.billingCycle})` },
            unit_amount: Math.round(params.amount * 100),
            recurring: resolveStripeInterval(params.billingCycle),
          },
          quantity: 1,
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        organizationId: params.organizationId,
        planId: params.planId,
        billingCycle: params.billingCycle,
      },
    });

    if (!session.url) {
      throw new Error('Stripe did not return a checkout URL');
    }
    return { redirectUrl: session.url };
  }

  verifyWebhookSignature(rawBody: Buffer, signatureHeader: string): PaymentWebhookEvent | null {
    let event: Stripe.Event;
    try {
      event = this.client.webhooks.constructEvent(rawBody, signatureHeader, this.webhookSecret);
    } catch (err) {
      console.error('Stripe webhook signature verification failed:', err);
      return null;
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const billingCycle = session.metadata?.billingCycle;
        return {
          eventId: event.id,
          type: 'checkout_completed',
          organizationId: session.metadata?.organizationId ?? null,
          externalSubscriptionId: typeof session.subscription === 'string' ? session.subscription : null,
          currentPeriodEnd: null,
          planId: session.metadata?.planId ?? null,
          billingCycle: billingCycle === 'monthly' || billingCycle === 'quarterly' || billingCycle === 'yearly' ? billingCycle : null,
        };
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = typeof invoice.subscription === 'string' ? invoice.subscription : null;
        return {
          eventId: event.id,
          type: 'renewal_succeeded',
          organizationId: null,
          externalSubscriptionId: subId,
          currentPeriodEnd: invoice.lines.data[0]?.period?.end
            ? new Date(invoice.lines.data[0].period.end * 1000)
            : null,
          planId: null,
          billingCycle: null,
        };
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = typeof invoice.subscription === 'string' ? invoice.subscription : null;
        return {
          eventId: event.id,
          type: 'renewal_failed',
          organizationId: null,
          externalSubscriptionId: subId,
          currentPeriodEnd: null,
          planId: null,
          billingCycle: null,
        };
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        return {
          eventId: event.id,
          type: 'subscription_cancelled',
          organizationId: null,
          externalSubscriptionId: sub.id,
          currentPeriodEnd: null,
          planId: null,
          billingCycle: null,
        };
      }
      default:
        return null;
    }
  }

  async cancelSubscription(externalSubscriptionId: string): Promise<void> {
    await this.client.subscriptions.cancel(externalSubscriptionId);
  }
}
