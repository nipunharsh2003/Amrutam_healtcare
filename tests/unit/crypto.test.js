const { encrypt, decrypt } = require('../../src/utils/crypto');

describe('prescription encryption', () => {
  test('encrypts and decrypts payloads', () => {
    const source = JSON.stringify({ diagnosis: 'test-only', medications: [] });
    const encrypted = encrypt(source);

    expect(encrypted.ciphertext).not.toContain('test-only');
    expect(decrypt(encrypted)).toBe(source);
  });

  test('rejects tampered ciphertext', () => {
    const encrypted = encrypt('clinical text');
    encrypted.ciphertext = `${encrypted.ciphertext.slice(0, -2)}AA`;

    expect(() => decrypt(encrypted)).toThrow();
  });
});