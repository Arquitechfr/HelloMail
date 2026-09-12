import crypto from 'node:crypto';
import { AppError } from '../../utils/AppError.js';

export interface IMailoraProfileMetadata {
  version: '1.0';
  generator: string;
  exportedAt: string;
  userEmail: string;
}

export interface IMailoraProfilePayload {
  metadata: IMailoraProfileMetadata;
  preferences?: Record<string, unknown>;
  tags?: Array<{
    name: string;
    color: string;
    order?: number;
    isPreset?: boolean;
  }>;
  rules?: Array<{
    name: string;
    order?: number;
    isActive?: boolean;
    conditionMatch: 'all' | 'any';
    conditions: Array<{
      field: 'from' | 'to' | 'subject' | 'hasAttachments';
      operator: 'contains' | 'notContains' | 'equals' | 'startsWith' | 'endsWith';
      value: string;
    }>;
    actions: Array<{
      type: 'moveToFolder' | 'markAsRead' | 'markAsFlagged' | 'markAsJunk' | 'delete' | 'applyTag' | 'pinMessage';
      folderName?: string;
      tagName?: string;
    }>;
    stopProcessing?: boolean;
    isPreset?: boolean;
  }>;
  templates?: Array<{
    title: string;
    subject?: string;
    bodyHtml: string;
    bodyText: string;
    shortcut?: string;
    order?: number;
    isPreset?: boolean;
  }>;
  smartFolders?: Array<{
    name: string;
    icon?: string;
    color?: string;
    query: string;
    order?: number;
  }>;
  contacts?: Array<{
    name: string;
    email: string;
    phone?: string;
    notes?: string;
  }>;
  senderLists?: Array<{
    type: 'allow' | 'deny';
    target: string;
    note?: string;
  }>;
  signatures?: Array<{
    accountEmail: string;
    isAlias: boolean;
    aliasEmail?: string;
    signature: {
      enabled: boolean;
      text: string;
      html?: string;
      variables?: {
        phone?: string;
        jobTitle?: string;
        company?: string;
      };
    };
  }>;
  pgpPublicKeys?: Array<{
    email: string;
    name?: string;
    armoredPublicKey: string;
    fingerprint: string;
    keyId: string;
    algorithm: string;
  }>;
}

export interface IEncryptedProfileBackup {
  version: '1.0';
  format: 'mailora-encrypted-profile';
  algorithm: 'aes-256-gcm';
  kdf: 'pbkdf2-sha256';
  iterations: number;
  salt: string;
  iv: string;
  authTag: string;
  ciphertext: string;
}

const ALGORITHM = 'aes-256-gcm';
const DEFAULT_ITERATIONS = 100_000;
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;

/**
 * Dérive une clé cryptographique de 32 octets à partir d'un mot de passe et d'un sel via PBKDF2-SHA256.
 */
export function deriveKey(password: string, salt: Buffer, iterations = DEFAULT_ITERATIONS): Buffer {
  return crypto.pbkdf2Sync(password, salt, iterations, KEY_LENGTH, 'sha256');
}

/**
 * Chiffre un profil complet avec un mot de passe utilisateur via AES-256-GCM.
 */
export function encryptProfilePayload(
  payload: IMailoraProfilePayload,
  password: string,
  iterations = DEFAULT_ITERATIONS,
): IEncryptedProfileBackup {
  if (!password || password.length < 4) {
    throw AppError.badRequest('Le mot de passe de chiffrement doit comporter au moins 4 caractères');
  }

  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(password, salt, iterations);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const jsonStr = JSON.stringify(payload);

  let ciphertext = cipher.update(jsonStr, 'utf8', 'hex');
  ciphertext += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return {
    version: '1.0',
    format: 'mailora-encrypted-profile',
    algorithm: 'aes-256-gcm',
    kdf: 'pbkdf2-sha256',
    iterations,
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    ciphertext,
  };
}

/**
 * Déchiffre une sauvegarde de profil chiffrée avec le mot de passe fourni.
 */
export function decryptProfilePayload(
  backup: IEncryptedProfileBackup,
  password: string,
): IMailoraProfilePayload {
  if (!password) {
    throw AppError.badRequest('Mot de passe de déchiffrement requis');
  }

  if (backup.format !== 'mailora-encrypted-profile' || backup.algorithm !== 'aes-256-gcm') {
    throw AppError.badRequest('Format de sauvegarde chiffrée non supporté');
  }

  try {
    const salt = Buffer.from(backup.salt, 'hex');
    const iv = Buffer.from(backup.iv, 'hex');
    const authTag = Buffer.from(backup.authTag, 'hex');
    const ciphertext = Buffer.from(backup.ciphertext, 'hex');

    const key = deriveKey(password, salt, backup.iterations || DEFAULT_ITERATIONS);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let plaintext = decipher.update(ciphertext, undefined, 'utf8');
    plaintext += decipher.final('utf8');

    return JSON.parse(plaintext) as IMailoraProfilePayload;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw AppError.badRequest('Mot de passe incorrect ou fichier de sauvegarde corrompu');
  }
}
