import prisma from '../../lib/prisma';
import { decrypt } from '../../lib/encryption';

// SMS delivery behind a small provider interface. The platform admin picks
// and configures a provider (Platform → Text messages); TWILIO_* env vars are
// the fallback. With neither, development logs messages and production
// sends nothing.

export interface SmsProvider {
  name: string;
  send(to: string, body: string): Promise<{ success: boolean; error?: string }>;
}

export const SMS_PROVIDERS = ['twilio', 'africastalking'] as const;
export type SmsProviderName = (typeof SMS_PROVIDERS)[number];

class TwilioProvider implements SmsProvider {
  name = 'twilio';
  constructor(private sid: string, private token: string, private from: string) {}

  async send(to: string, body: string) {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.sid}:${this.token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: this.from, Body: body }),
    });
    if (!res.ok) return { success: false, error: `Twilio ${res.status}: ${await res.text()}` };
    return { success: true };
  }
}

// Africa's Talking: common across Ghana, Kenya, Nigeria and beyond.
class AfricasTalkingProvider implements SmsProvider {
  name = 'africastalking';
  constructor(private username: string, private apiKey: string, private from?: string | null) {}

  async send(to: string, body: string) {
    const host = this.username === 'sandbox' ? 'api.sandbox.africastalking.com' : 'api.africastalking.com';
    const params = new URLSearchParams({ username: this.username, to, message: body });
    if (this.from) params.set('from', this.from);
    const res = await fetch(`https://${host}/version1/messaging`, {
      method: 'POST',
      headers: { apiKey: this.apiKey, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    if (!res.ok) return { success: false, error: `Africa's Talking ${res.status}: ${await res.text()}` };
    const data = (await res.json().catch(() => null)) as { SMSMessageData?: { Recipients?: { status?: string }[] } } | null;
    const status = data?.SMSMessageData?.Recipients?.[0]?.status;
    return status && status !== 'Success' ? { success: false, error: `Africa's Talking: ${status}` } : { success: true };
  }
}

class ConsoleProvider implements SmsProvider {
  name = 'console';
  async send(to: string, body: string) {
    console.log(`[sms:dev] to=${to} body=${body}`);
    return { success: true };
  }
}

export function buildSmsProvider(provider: string, accountId: string, secret: string, senderId?: string | null): SmsProvider | null {
  if (provider === 'twilio') return senderId ? new TwilioProvider(accountId, secret, senderId) : null;
  if (provider === 'africastalking') return new AfricasTalkingProvider(accountId, secret, senderId);
  return null;
}

let cached: { provider: SmsProvider | null; at: number } | null = null;
const CACHE_MS = 60_000;

/** Call after the admin changes provider settings. */
export function clearSmsProviderCache() {
  cached = null;
}

export async function getSmsProvider(): Promise<SmsProvider | null> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.provider;
  let provider: SmsProvider | null = null;
  const config = await prisma.smsProviderConfig.findFirst({ where: { isActive: true } }).catch(() => null);
  if (config) {
    try {
      provider = buildSmsProvider(config.provider, config.accountId, decrypt(config.secret), config.senderId);
    } catch (err) {
      console.error('SMS provider config could not be read:', err);
    }
  }
  if (!provider) {
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;
    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER) {
      provider = new TwilioProvider(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER);
    } else if (process.env.NODE_ENV !== 'production') {
      provider = new ConsoleProvider();
    }
  }
  cached = { provider, at: Date.now() };
  return provider;
}
