// SMS delivery behind a small provider interface. Twilio is configured with
// env vars (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER); with
// none set, development logs the message and production sends nothing.

export interface SmsProvider {
  name: string;
  send(to: string, body: string): Promise<{ success: boolean; error?: string }>;
}

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

class ConsoleProvider implements SmsProvider {
  name = 'console';
  async send(to: string, body: string) {
    console.log(`[sms:dev] to=${to} body=${body}`);
    return { success: true };
  }
}

export function getSmsProvider(): SmsProvider | null {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER) {
    return new TwilioProvider(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER);
  }
  return process.env.NODE_ENV === 'production' ? null : new ConsoleProvider();
}
