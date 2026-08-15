export type ProviderName = 'stripe' | 'paystack';

export interface CreateCheckoutParams {
  organizationId: string;
  planId: string;
  planCode: string;
  planName: string;
  amount: number; // in the plan's base currency unit (e.g. dollars, not cents)
  currency: string;
  billingCycle: 'monthly' | 'quarterly' | 'yearly';
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutResult {
  redirectUrl: string;
}

export type PaymentWebhookEventType =
  | 'checkout_completed'
  | 'renewal_succeeded'
  | 'renewal_failed'
  | 'subscription_cancelled';

export interface PaymentWebhookEvent {
  eventId: string;
  type: PaymentWebhookEventType;
  organizationId: string | null;
  externalSubscriptionId: string | null;
  currentPeriodEnd: Date | null;
  planId: string | null;
  billingCycle: 'monthly' | 'quarterly' | 'yearly' | null;
}

export interface PaymentProvider {
  name: ProviderName;
  createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutResult>;
  verifyWebhookSignature(rawBody: Buffer, signatureHeader: string): PaymentWebhookEvent | null;
  cancelSubscription(externalSubscriptionId: string): Promise<void>;
}

export class ProviderNotActiveError extends Error {
  constructor(provider: string) {
    super(`Payment provider "${provider}" is not configured or not active`);
    this.name = 'ProviderNotActiveError';
  }
}
