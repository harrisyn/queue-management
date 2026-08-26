import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('dns', () => ({
  default: { promises: { resolveCname: vi.fn() } },
}));

import dns from 'dns';
import { isValidDomain, verifyCnameMatches, resolveCnameTarget } from './customDomain.service';

describe('isValidDomain', () => {
  it('accepts a normal subdomain', () => {
    expect(isValidDomain('queue.acmehealth.com')).toBe(true);
  });

  it('accepts a bare two-label domain', () => {
    expect(isValidDomain('acmehealth.com')).toBe(true);
  });

  it('rejects a single label with no dot', () => {
    expect(isValidDomain('localhost')).toBe(false);
  });

  it('rejects a domain with a leading hyphen label', () => {
    expect(isValidDomain('-queue.acmehealth.com')).toBe(false);
  });

  it('rejects a domain containing spaces', () => {
    expect(isValidDomain('queue acme.com')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidDomain('')).toBe(false);
  });
});

describe('resolveCnameTarget / verifyCnameMatches', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the normalized (lowercased, trailing-dot-stripped) CNAME target', async () => {
    (dns.promises.resolveCname as any).mockResolvedValue(['Queueflow.App.']);
    await expect(resolveCnameTarget('queue.acmehealth.com')).resolves.toBe('queueflow.app');
  });

  it('returns null when the domain has no CNAME record', async () => {
    (dns.promises.resolveCname as any).mockRejectedValue(new Error('ENOTFOUND'));
    await expect(resolveCnameTarget('queue.acmehealth.com')).resolves.toBeNull();
  });

  it('matches when the resolved CNAME equals the expected target', async () => {
    (dns.promises.resolveCname as any).mockResolvedValue(['queueflow.app']);
    await expect(verifyCnameMatches('queue.acmehealth.com', 'queueflow.app')).resolves.toBe(true);
  });

  it('does not match when the resolved CNAME points elsewhere', async () => {
    (dns.promises.resolveCname as any).mockResolvedValue(['someone-else.example.com']);
    await expect(verifyCnameMatches('queue.acmehealth.com', 'queueflow.app')).resolves.toBe(false);
  });

  it('does not match when there is no CNAME record at all', async () => {
    (dns.promises.resolveCname as any).mockRejectedValue(new Error('ENOTFOUND'));
    await expect(verifyCnameMatches('queue.acmehealth.com', 'queueflow.app')).resolves.toBe(false);
  });
});
