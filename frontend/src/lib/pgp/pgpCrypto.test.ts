// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  generatePgpKeyPair,
  readPgpKeyInfo,
  formatFingerprint,
  isPgpEncrypted,
  isPgpSigned,
  encryptPgpMessage,
  decryptPgpMessage,
} from './pgpCrypto';

describe('pgpCrypto', () => {
  it('formate correctement une empreinte de clé', () => {
    const raw = 'd28a1c9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c';
    const formatted = formatFingerprint(raw);
    expect(formatted).toBe('D28A 1C9E 8F7A 6B5C 4D3E 2F1A 0B9C 8D7E 6F5A 4B3C');
  });

  it('détecte si un contenu est chiffré ou signé PGP', () => {
    expect(isPgpEncrypted('-----BEGIN PGP MESSAGE-----\ntest\n-----END PGP MESSAGE-----')).toBe(true);
    expect(isPgpEncrypted('Hello world')).toBe(false);
    expect(isPgpSigned('-----BEGIN PGP SIGNED MESSAGE-----\ntest')).toBe(true);
    expect(isPgpSigned('Bonjour')).toBe(false);
  });

  it('génère une paire de clés Curve25519 et permet le chiffrement/déchiffrement', async () => {
    const keyPair = await generatePgpKeyPair({
      name: 'Alice Dupont',
      email: 'alice@hellomail.fr',
      type: 'ecc',
    });

    expect(keyPair.armoredPublicKey).toContain('-----BEGIN PGP PUBLIC KEY BLOCK-----');
    expect(keyPair.armoredPrivateKey).toContain('-----BEGIN PGP PRIVATE KEY BLOCK-----');
    expect(keyPair.fingerprint).toBeDefined();
    expect(keyPair.keyId).toBeDefined();

    // Inspection de la clé publique
    const info = await readPgpKeyInfo(keyPair.armoredPublicKey);
    expect(info.fingerprint).toBe(keyPair.fingerprint);
    expect(info.isPrivate).toBe(false);

    // Chiffrement d'un message
    const secretMessage = 'Ceci est un message top secret HelloMail 2026.';
    const encrypted = await encryptPgpMessage({
      plainText: secretMessage,
      recipientPublicKeysArmored: [keyPair.armoredPublicKey],
    });

    expect(isPgpEncrypted(encrypted)).toBe(true);

    // Déchiffrement du message
    const decrypted = await decryptPgpMessage({
      armoredMessage: encrypted,
      armoredPrivateKey: keyPair.armoredPrivateKey,
    });

    expect(decrypted.decryptedText).toBe(secretMessage);
  }, 15000);
});
