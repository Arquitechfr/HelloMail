import { describe, it, expect, beforeAll } from 'vitest';
import { encrypt, decrypt } from './encryptionService.js';

describe('encryptionService', () => {
  beforeAll(() => {
    // encryptionService lit ENCRYPTION_KEY au chargement du module (fail-fast).
    // Le .env de test fournit une clé valide (64 hex chars).
  });

  it('fait un round-trip encrypt → decrypt fidèle', () => {
    const plaintext = 'monMotDePasseIMAP123!';
    const payload = encrypt(plaintext);

    expect(payload.iv).toMatch(/^[0-9a-f]{24}$/);
    expect(payload.authTag).toMatch(/^[0-9a-f]{32}$/);
    expect(payload.ciphertext).toMatch(/^[0-9a-f]+$/);

    expect(decrypt(payload)).toBe(plaintext);
  });

  it('génère un IV différent à chaque appel (jamais réutilisé)', () => {
    const a = encrypt('test');
    const b = encrypt('test');

    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    // Mais les deux déchiffrent vers le même plaintext.
    expect(decrypt(a)).toBe('test');
    expect(decrypt(b)).toBe('test');
  });

  it('échoue si l\'authTag est altéré (données altérées)', () => {
    const payload = encrypt('secret');
    const tampered = { ...payload, authTag: 'a'.repeat(32) };

    expect(() => decrypt(tampered)).toThrow();
  });

  it('échoue si le ciphertext est altéré', () => {
    const payload = encrypt('secret');
    const tampered = { ...payload, ciphertext: 'ff'.repeat(payload.ciphertext.length / 2) };

    expect(() => decrypt(tampered)).toThrow();
  });

  it('chiffre une chaîne vide', () => {
    const payload = encrypt('');
    expect(decrypt(payload)).toBe('');
  });

  it('chiffre des caractères unicode', () => {
    const plaintext = 'パスワード 🔐 ünïcödé';
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });
});
