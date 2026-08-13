import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, mask } from './encryption';

describe('encryption', () => {
  it('round-trips a plaintext string through encrypt/decrypt', () => {
    const plaintext = 'sk_test_abcdef1234567890';
    const ciphertext = encrypt(plaintext);
    expect(ciphertext).not.toBe(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it('produces different ciphertext for the same plaintext each time (random IV)', () => {
    const plaintext = 'sk_test_abcdef1234567890';
    expect(encrypt(plaintext)).not.toBe(encrypt(plaintext));
  });

  it('masks a secret to only the last 4 characters', () => {
    expect(mask('sk_test_abcdef1234567890')).toBe('••••••••••••••••••••7890');
  });

  it('masks short secrets safely without throwing', () => {
    expect(mask('abc')).toBe('•••');
  });
});
