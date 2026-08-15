import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { PaystackProvider } from './paystack.provider';

describe('PaystackProvider.verifyWebhookSignature', () => {
  const webhookSecret = 'sk_test_webhooksecret';
  const provider = new PaystackProvider('sk_test_secret', webhookSecret);

  it('accepts a correctly-signed payload', () => {
    const payload = JSON.stringify({ event: 'charge.success', data: { id: 123, reference: 'ref_1', metadata: { organizationId: 'org_1' } } });
    const rawBody = Buffer.from(payload);
    const signature = crypto.createHmac('sha512', webhookSecret).update(rawBody).digest('hex');

    const result = provider.verifyWebhookSignature(rawBody, signature);
    expect(result).not.toBeNull();
    expect(result?.type).toBe('checkout_completed');
    expect(result?.organizationId).toBe('org_1');
  });

  it('rejects a tampered payload', () => {
    const payload = JSON.stringify({ event: 'charge.success', data: { id: 123, reference: 'ref_1' } });
    const rawBody = Buffer.from(payload);
    const signature = crypto.createHmac('sha512', webhookSecret).update(rawBody).digest('hex');

    const tamperedBody = Buffer.from(payload.replace('123', '456'));
    const result = provider.verifyWebhookSignature(tamperedBody, signature);
    expect(result).toBeNull();
  });

  it('rejects a signature computed with the wrong secret', () => {
    const payload = JSON.stringify({ event: 'charge.success', data: { id: 123, reference: 'ref_1' } });
    const rawBody = Buffer.from(payload);
    const wrongSignature = crypto.createHmac('sha512', 'wrong-secret').update(rawBody).digest('hex');

    const result = provider.verifyWebhookSignature(rawBody, wrongSignature);
    expect(result).toBeNull();
  });
});
