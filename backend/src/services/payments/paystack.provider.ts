import crypto from 'crypto';
import { PaymentProvider, CreateCheckoutParams, CheckoutResult, PaymentWebhookEvent } from './types';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

export class PaystackProvider implements PaymentProvider {
  name = 'paystack' as const;
  private secretKey: string;
  private webhookSecret: string;

  constructor(secretKey: string, webhookSecret: string) {
    this.secretKey = secretKey;
    this.webhookSecret = webhookSecret;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    const body = await res.json();
    if (!res.ok || body.status === false) {
      throw new Error(`Paystack API error: ${body.message || res.statusText}`);
    }
    return body.data as T;
  }

  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutResult> {
    // Paystack works in the smallest currency unit (kobo for NGN, pesewas for GHS, cents for USD)
    const amountMinorUnits = Math.round(params.amount * 100);

    const data = await this.request<{ authorization_url: string }>('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        amount: amountMinorUnits,
        currency: params.currency.toUpperCase(),
        email: `org-${params.organizationId}@billing.internal`, // Paystack requires an email; a real one is collected via the hosted page if needed
        callback_url: params.successUrl,
        metadata: {
          organizationId: params.organizationId,
          planId: params.planId,
          billingCycle: params.billingCycle,
        },
      }),
    });

    return { redirectUrl: data.authorization_url };
  }

  verifyWebhookSignature(rawBody: Buffer, signatureHeader: string): PaymentWebhookEvent | null {
    const expectedSignature = crypto
      .createHmac('sha512', this.webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (expectedSignature !== signatureHeader) {
      console.error('Paystack webhook signature verification failed');
      return null;
    }

    const event = JSON.parse(rawBody.toString('utf8'));
    const eventId = event.data?.id ? String(event.data.id) : `${event.event}-${event.data?.reference}`;

    switch (event.event) {
      case 'charge.success': {
        const billingCycle = event.data?.metadata?.billingCycle;
        return {
          eventId,
          type: 'checkout_completed',
          organizationId: event.data?.metadata?.organizationId ?? null,
          externalSubscriptionId: event.data?.reference ?? null,
          currentPeriodEnd: null,
          planId: event.data?.metadata?.planId ?? null,
          billingCycle: billingCycle === 'monthly' || billingCycle === 'quarterly' || billingCycle === 'yearly' ? billingCycle : null,
        };
      }
      case 'invoice.payment_failed':
        return {
          eventId,
          type: 'renewal_failed',
          organizationId: null,
          externalSubscriptionId: event.data?.subscription?.subscription_code ?? null,
          currentPeriodEnd: null,
          planId: null,
          billingCycle: null,
        };
      case 'subscription.not_renew':
      case 'subscription.disable':
        return {
          eventId,
          type: 'subscription_cancelled',
          organizationId: null,
          externalSubscriptionId: event.data?.subscription_code ?? null,
          currentPeriodEnd: null,
          planId: null,
          billingCycle: null,
        };
      default:
        return null;
    }
  }

  async cancelSubscription(externalSubscriptionId: string): Promise<void> {
    await this.request('/subscription/disable', {
      method: 'POST',
      body: JSON.stringify({ code: externalSubscriptionId, token: externalSubscriptionId }),
    });
  }
}
