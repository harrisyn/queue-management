import nodemailer from 'nodemailer';

// In development, we use Ethereal (fake SMTP) or console logging
// In production, configure real SMTP settings via environment variables

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Store OTPs in memory (in production, use Redis)
const otpStore = new Map<string, { code: string; expiresAt: Date; attempts: number }>();

// Create transporter based on environment variables.
// If SMTP_HOST is present we will use those values (this makes it easy to point at Mailpit or another local SMTP server).
// Otherwise in development we attempt to create a nodemailer test account (ethereal) so getTestMessageUrl() works.
const createTransporter = async () => {
  if (process.env.SMTP_HOST) {
    // Use explicit SMTP config (works for Mailpit at mailpit:1025, real SMTP servers, etc.)
    const opts: any = {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
    };

    if (process.env.SMTP_USER || process.env.SMTP_PASS) {
      opts.auth = { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS };
    }

    return nodemailer.createTransport(opts);
  }

  // No SMTP configured — for development create an ethereal test account so emails can be previewed
  try {
    const testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  } catch (err) {
    // If we cannot create a test account for any reason, fall back to null which will cause console logging
    console.warn('Could not create test SMTP account, emails will be logged instead.', err);
    return null;
  }
};

let transporter: any = null;

// Initialize transporter asynchronously so createTransporter can await createTestAccount if needed
(async () => {
  transporter = await createTransporter();
})();

export const sendEmail = async (options: EmailOptions): Promise<{ success: boolean; messageId?: string; previewUrl?: string }> => {
  const { to, subject, html, text } = options;
  // Ensure transporter exists — it's initialized asynchronously on startup but may not be ready on first send
  if (!transporter) {
    transporter = await createTransporter();
  }

  // In development without SMTP or test account, just log the email
  if (!transporter) {
    console.log('\n📧 ═══════════════════════════════════════════════════════');
    console.log('   EMAIL (Development Mode - Not Actually Sent)');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`   To: ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log('───────────────────────────────────────────────────────────');
    console.log(text || html.replace(/<[^>]*>/g, ''));
    console.log('═══════════════════════════════════════════════════════════\n');
    return { success: true, messageId: 'dev-' + Date.now() };
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"QMS" <noreply@qms.local>',
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''),
    });

    return { 
      success: true, 
      messageId: info.messageId,
      previewUrl: nodemailer.getTestMessageUrl(info) || undefined
    };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { success: false };
  }
};

// Generate 6-digit OTP
export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Store OTP for email verification
export const storeOTP = (email: string, code: string, expiresInMinutes: number = 10): void => {
  const normalizedEmail = email.toLowerCase().trim();
  otpStore.set(normalizedEmail, {
    code,
    expiresAt: new Date(Date.now() + expiresInMinutes * 60 * 1000),
    attempts: 0,
  });
};

// Verify OTP
export const verifyOTP = (email: string, code: string): { valid: boolean; error?: string } => {
  const normalizedEmail = email.toLowerCase().trim();
  const stored = otpStore.get(normalizedEmail);

  if (!stored) {
    return { valid: false, error: 'No verification code found. Please request a new one.' };
  }

  if (stored.attempts >= 5) {
    otpStore.delete(normalizedEmail);
    return { valid: false, error: 'Too many attempts. Please request a new code.' };
  }

  if (new Date() > stored.expiresAt) {
    otpStore.delete(normalizedEmail);
    return { valid: false, error: 'Verification code has expired. Please request a new one.' };
  }

  if (stored.code !== code) {
    stored.attempts++;
    return { valid: false, error: `Invalid code. ${5 - stored.attempts} attempts remaining.` };
  }

  // Success - remove OTP
  otpStore.delete(normalizedEmail);
  return { valid: true };
};

// Send OTP email
export const sendOTPEmail = async (email: string): Promise<{ success: boolean; error?: string }> => {
  const code = generateOTP();
  storeOTP(email, code);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 32px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">🏥 Queue Management</h1>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 32px;">
                  <h2 style="margin: 0 0 16px; color: #1f2937; font-size: 20px; font-weight: 600;">Verify Your Email</h2>
                  <p style="margin: 0 0 24px; color: #6b7280; font-size: 15px; line-height: 1.6;">
                    Use the verification code below to complete your registration. This code will expire in 10 minutes.
                  </p>
                  
                  <!-- OTP Code -->
                  <div style="background: linear-gradient(135deg, #f0f4ff 0%, #e8e0ff 100%); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                    <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Verification Code</p>
                    <p style="margin: 0; color: #4f46e5; font-size: 36px; font-weight: 700; letter-spacing: 8px; font-family: 'Courier New', monospace;">${code}</p>
                  </div>
                  
                  <p style="margin: 0; color: #9ca3af; font-size: 13px; text-align: center;">
                    If you didn't request this code, you can safely ignore this email.
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 24px 32px; text-align: center; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                    © ${new Date().getFullYear()} Queue Management System. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const result = await sendEmail({
    to: email,
    subject: `${code} - Your QMS Verification Code`,
    html,
    text: `Your QMS verification code is: ${code}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, you can safely ignore this email.`,
  });

  return result;
};
