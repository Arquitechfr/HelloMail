import crypto from 'node:crypto';
import { env } from '../../config/env.js';

const KEY = Buffer.from(env.ENCRYPTION_KEY, 'hex');

// Fail fast : la clé doit faire exactement 32 octets (256 bits) pour AES-256.
if (KEY.length !== 32) {
  throw new Error(
    `ENCRYPTION_KEY invalide : attendu 32 octets (64 caractères hex), reçu ${KEY.length} octets. ` +
      'Générez une clé avec : openssl rand -hex 32',
  );
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

export interface EncryptedPayload {
  iv: string;
  authTag: string;
  ciphertext: string;
}

/**
 * Chiffre un plaintext en AES-256-GCM.
 * IV aléatoire de 12 octets à chaque appel (jamais réutilisé).
 * Retourne iv, authTag et ciphertext en hexadécimal.
 */
export function encrypt(plaintext: string): EncryptedPayload {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    ciphertext,
  };
}

/**
 * Déchiffre un payload AES-256-GCM.
 * Lance une erreur si l'authTag ne correspond pas (données altérées).
 */
export function decrypt(payload: EncryptedPayload): string {
  const iv = Buffer.from(payload.iv, 'hex');
  const authTag = Buffer.from(payload.authTag, 'hex');
  const ciphertext = Buffer.from(payload.ciphertext, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);

  let plaintext = decipher.update(ciphertext, undefined, 'utf8');
  plaintext += decipher.final('utf8');

  return plaintext;
}
