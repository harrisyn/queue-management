import * as crypto from 'crypto';

/**
 * Generate a browser fingerprint from request headers and client data
 * Used for anonymous session tracking across browser sessions
 */
export function generateFingerprint(data: {
  userAgent?: string;
  acceptLanguage?: string;
  ip?: string;
  clientData?: any; // Screen resolution, timezone, etc from client
}): string {
  const {
    userAgent = '',
    acceptLanguage = '',
    ip = '',
    clientData = {}
  } = data;

  // Combine relevant data points
  const fingerprintData = [
    userAgent,
    acceptLanguage,
    ip,
    clientData.screenResolution || '',
    clientData.timezone || '',
    clientData.platform || '',
  ].join('|');

  // Create hash
  return crypto
    .createHash('sha256')
    .update(fingerprintData)
    .digest('hex');
}

/**
 * Extract fingerprint data from Express request
 */
export function extractFingerprintFromRequest(req: any): {
  userAgent?: string;
  acceptLanguage?: string;
  ip?: string;
} {
  return {
    userAgent: req.headers['user-agent'],
    acceptLanguage: req.headers['accept-language'],
    ip: req.ip || req.connection?.remoteAddress,
  };
}
