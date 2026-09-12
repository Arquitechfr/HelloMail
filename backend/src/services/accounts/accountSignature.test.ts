import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { setupTestDb, teardownTestDb, clearDb } from '../../test/setup.js';
import { AccountModel } from '../../models/Account.js';
import { AccountService } from './accountService.js';
import { encrypt } from '../security/encryptionService.js';

describe('AccountService.updateSignature', () => {
  const userId = new mongoose.Types.ObjectId().toString();

  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearDb();
  });

  it('doit mettre à jour la signature d\'un compte existant', async () => {
    const account = await AccountModel.create({
      userId,
      provider: 'imap',
      emailAddress: 'test-sig@mailora.dev',
      imapConfig: {
        host: 'imap.test.dev',
        port: 993,
        secure: true,
        smtpHost: 'smtp.test.dev',
        smtpPort: 465,
        smtpSecure: true,
        username: 'test-sig@mailora.dev',
        encryptedPassword: encrypt('secret'),
      },
    });

    const signatureData = {
      enabled: true,
      text: 'Bien cordialement,\nL\'équipe Mailora',
      html: '<p>Bien cordialement,<br><strong>L\'équipe Mailora</strong></p>',
    };

    const updated = await AccountService.updateSignature(userId, account._id.toString(), signatureData);

    expect(updated).not.toBeNull();
    expect(updated.signature?.enabled).toBe(true);
    expect(updated.signature?.text).toContain('Mailora');
    expect(updated.signature?.html).toContain('<strong>');
  });

  it('doit lever AppError 404 si le compte n\'existe pas', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    await expect(
      AccountService.updateSignature(userId, fakeId, {
        enabled: true,
        text: 'Test',
      }),
    ).rejects.toThrow('Compte introuvable');
  });
});
