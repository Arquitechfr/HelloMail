import { describe, it, expect } from 'vitest';
import {
  encryptProfilePayload,
  decryptProfilePayload,
  type IMailoraProfilePayload,
  type IEncryptedProfileBackup,
} from './profileCryptoService.js';
import { AppError } from '../../utils/AppError.js';

describe('profileCryptoService (Lot 30.1)', () => {
  const samplePayload: IMailoraProfilePayload = {
    metadata: {
      version: '1.0',
      generator: 'Mailora Profile Backup',
      exportedAt: '2026-09-12T12:00:00.000Z',
      userEmail: 'user@example.com',
    },
    preferences: {
      displayDensity: 'comfortable',
      undoSendDelay: 10,
      attachmentReminderEnabled: true,
    },
    tags: [
      { name: 'Urgent', color: '#ef4444', order: 0 },
      { name: 'Travail', color: '#3b82f6', order: 1 },
    ],
    rules: [
      {
        name: 'Auto-Archivage',
        conditionMatch: 'all',
        conditions: [{ field: 'from', operator: 'contains', value: 'newsletter' }],
        actions: [{ type: 'moveToFolder', folderName: 'Archive' }],
      },
    ],
  };

  it('chiffre et déchiffre avec succès un profil avec un mot de passe valide', () => {
    const password = 'MonSuperPassword123!';
    const encrypted = encryptProfilePayload(samplePayload, password, 1000); // 1000 iter pour le test rapide

    expect(encrypted.version).toBe('1.0');
    expect(encrypted.format).toBe('mailora-encrypted-profile');
    expect(encrypted.algorithm).toBe('aes-256-gcm');
    expect(encrypted.salt).toHaveLength(32); // 16 octets = 32 hex
    expect(encrypted.iv).toHaveLength(24); // 12 octets = 24 hex
    expect(encrypted.authTag).toHaveLength(32); // 16 octets = 32 hex
    expect(typeof encrypted.ciphertext).toBe('string');

    const decrypted = decryptProfilePayload(encrypted, password);
    expect(decrypted).toEqual(samplePayload);
  });

  it('rejette un mot de passe de chiffrement trop court', () => {
    expect(() => encryptProfilePayload(samplePayload, '123')).toThrowError(AppError);
    expect(() => encryptProfilePayload(samplePayload, '')).toThrowError(AppError);
  });

  it('rejette le déchiffrement avec un mot de passe incorrect', () => {
    const password = 'BonMotDePasse';
    const encrypted = encryptProfilePayload(samplePayload, password, 1000);

    expect(() => decryptProfilePayload(encrypted, 'MauvaisMotDePasse')).toThrowError(
      'Mot de passe incorrect ou fichier de sauvegarde corrompu',
    );
  });

  it('rejette le déchiffrement si le authTag est altéré (intégrité corrompue)', () => {
    const password = 'Password123';
    const encrypted = encryptProfilePayload(samplePayload, password, 1000);

    // Corrompre le authTag
    const corrupted: IEncryptedProfileBackup = {
      ...encrypted,
      authTag: '00'.repeat(16),
    };

    expect(() => decryptProfilePayload(corrupted, password)).toThrowError(
      'Mot de passe incorrect ou fichier de sauvegarde corrompu',
    );
  });

  it('rejette le déchiffrement si le format est invalide', () => {
    const corrupted = {
      version: '1.0',
      format: 'unknown-format',
      algorithm: 'aes-256-gcm',
      kdf: 'pbkdf2-sha256',
      iterations: 1000,
      salt: '00'.repeat(16),
      iv: '00'.repeat(12),
      authTag: '00'.repeat(16),
      ciphertext: 'deadbeef',
    } as unknown as IEncryptedProfileBackup;

    expect(() => decryptProfilePayload(corrupted, 'pwd')).toThrowError(
      'Format de sauvegarde chiffrée non supporté',
    );
  });
});
