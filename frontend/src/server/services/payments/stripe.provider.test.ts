import { describe, it, expect } from 'vitest';
import Stripe from 'stripe';
import { StripeProvider } from './stripe.provider';

describe('StripeProvider.verifyWebhookSignature', () => {
  const webhookSecret = 'whsec_test_secret';
  const provider = new StripeProvider('sk_test_dummy', webhookSecret);

  it('accepts a correctly-signed payload', () => {
    const payloadObj = {
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: { object: { metadata: { organizationId: 'org_1' }, subscription: 'sub_1' } },
    };
    const payload = JSON.stringify(payloadObj);
    const header = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: webhookSecret,
    });

    const result = provider.verifyWebhookSignature(Buffer.from(payload), header);
    expect(result).not.toBeNull();
    expect(result?.type).toBe('checkout_completed');
    expect(result?.organizationId).toBe('org_1');
  });

  it('rejects an invalid signature header', () => {
    const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', data: { object: {} } });
    const result = provider.verifyWebhookSignature(Buffer.from(payload), 't=1,v1=invalid');
    expect(result).toBeNull();
  });
});
