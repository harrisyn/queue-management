import crypto from 'crypto';
import prisma from './prisma';

type Purpose = 'EMAIL_VERIFY' | 'PASSWORD_RESET';

const MAX_ATTEMPTS = 5;

const hash = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
export const normalizeEmail = (email: string) => email.toLowerCase().trim();

/** Issues a fresh 6-digit code, invalidating any earlier unused ones. */
export async function issueCode(purpose: Purpose, identifier: string, ttlMinutes = 10): Promise<string> {
  const code = crypto.randomInt(100000, 1000000).toString();
  await replaceCode(purpose, identifier, code, ttlMinutes);
  return code;
}

/** Issues a long random token (for links, e.g. password reset). */
export async function issueToken(purpose: Purpose, identifier: string, ttlMinutes = 60): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  await replaceCode(purpose, identifier, token, ttlMinutes);
  return token;
}

async function replaceCode(purpose: Purpose, identifier: string, code: string, ttlMinutes: number) {
  const id = normalizeEmail(identifier);
  await prisma.$transaction([
    prisma.verificationCode.deleteMany({ where: { purpose, identifier: id, consumedAt: null } }),
    prisma.verificationCode.create({
      data: {
        purpose,
        identifier: id,
        codeHash: hash(code),
        expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
      },
    }),
  ]);
}

/** Checks a code and marks it verified. Doesn't consume it - see consumeVerified. */
export async function verifyCode(
  purpose: Purpose,
  identifier: string,
  code: string
): Promise<{ valid: boolean; error?: string }> {
  const id = normalizeEmail(identifier);
  const record = await prisma.verificationCode.findFirst({
    where: { purpose, identifier: id, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) return { valid: false, error: 'No verification code found. Please request a new one.' };
  if (record.attempts >= MAX_ATTEMPTS) {
    return { valid: false, error: 'Too many attempts. Please request a new code.' };
  }
  if (record.expiresAt < new Date()) {
    return { valid: false, error: 'Verification code has expired. Please request a new one.' };
  }

  const matches = crypto.timingSafeEqual(Buffer.from(record.codeHash), Buffer.from(hash(String(code).trim())));
  if (!matches) {
    const attempts = record.attempts + 1;
    await prisma.verificationCode.update({ where: { id: record.id }, data: { attempts } });
    return { valid: false, error: `Invalid code. ${Math.max(0, MAX_ATTEMPTS - attempts)} attempts remaining.` };
  }

  await prisma.verificationCode.update({ where: { id: record.id }, data: { verifiedAt: new Date() } });
  return { valid: true };
}

/** Atomically consumes a code verified within the window. Returns false if
 * there's no such code (never verified, too old, or already used). */
export async function consumeVerified(purpose: Purpose, identifier: string, withinMinutes = 30): Promise<boolean> {
  const { count } = await prisma.verificationCode.updateMany({
    where: {
      purpose,
      identifier: normalizeEmail(identifier),
      consumedAt: null,
      verifiedAt: { gte: new Date(Date.now() - withinMinutes * 60 * 1000) },
    },
    data: { consumedAt: new Date() },
  });
  return count > 0;
}

/** Atomically consumes a link token, returning the identifier it was issued for. */
export async function consumeToken(purpose: Purpose, token: string): Promise<string | null> {
  const record = await prisma.verificationCode.findFirst({
    where: { purpose, codeHash: hash(token), consumedAt: null, expiresAt: { gt: new Date() } },
  });
  if (!record) return null;
  const { count } = await prisma.verificationCode.updateMany({
    where: { id: record.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  return count > 0 ? record.identifier : null;
}
