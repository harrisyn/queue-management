import jwt, { SignOptions } from 'jsonwebtoken';

// Values that have shipped as defaults in this repo's compose file/docs - a
// production deploy must never sign tokens with one of these.
const KNOWN_DEFAULTS = new Set([
  'your-secret-key',
  'fallback-secret',
  'your-super-secret-jwt-key-change-in-production',
]);

const DEV_SECRET = 'dev-only-jwt-secret';

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    if (!secret || KNOWN_DEFAULTS.has(secret) || secret.length < 32) {
      throw new Error('JWT_SECRET must be set to a random value of at least 32 characters in production');
    }
    return secret;
  }
  return secret || DEV_SECRET;
}

export interface TokenPayload {
  userId: string;
  role: string;
}

export function signToken(payload: TokenPayload, expiresIn: SignOptions['expiresIn'] = '24h'): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, getJwtSecret()) as TokenPayload;
}
