import { describe, it, expect } from 'vitest';
import { sealConfig, openConfig, redactConfig, SECRET_PLACEHOLDER } from './dataSourceSecrets';

describe('dataSourceSecrets', () => {
  const plain = { url: 'https://emr.example', auth: { type: 'bearer', token: 'tok_123' } };

  it('encrypts secrets at rest and decrypts them for use', () => {
    const sealed = sealConfig(plain);
    expect(sealed.auth.token).toMatch(/^enc:/);
    expect(sealed.auth.token).not.toContain('tok_123');
    expect(openConfig(sealed).auth.token).toBe('tok_123');
    expect(sealed.url).toBe('https://emr.example');
  });

  it('never returns secrets to the client', () => {
    expect(redactConfig(sealConfig(plain)).auth.token).toBe(SECRET_PLACEHOLDER);
  });

  it('keeps the stored secret when the client saves the placeholder back', () => {
    const stored = sealConfig(plain);
    const resaved = sealConfig({ ...plain, auth: { type: 'bearer', token: SECRET_PLACEHOLDER } }, stored);
    expect(resaved.auth.token).toBe(stored.auth.token);
  });

  it('replaces the secret when the client sends a new value', () => {
    const stored = sealConfig(plain);
    const updated = sealConfig({ ...plain, auth: { type: 'bearer', token: 'tok_new' } }, stored);
    expect(openConfig(updated).auth.token).toBe('tok_new');
  });
});
