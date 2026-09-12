import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import type { IAccountDocument } from '../../models/Account.js';
import { MessageModel } from '../../models/Message.js';
import { MessageBodyModel } from '../../models/MessageBody.js';
import { setupTestDb, teardownTestDb, clearDb } from '../../test/setup.js';
import { AppError } from '../../utils/AppError.js';

const { mockClient } = vi.hoisted(() => ({
  mockClient: {
    mailboxOpen: vi.fn().mockResolvedValue({ exists: 5 }),
    messageDelete: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('./imapPool.js', () => ({
  imapPool: {
    acquire: vi.fn().mockResolvedValue(mockClient),
    release: vi.fn(),
  },
}));

vi.mock('./specialFolders.js', () => ({
  findTrashFolder: vi.fn().mockResolvedValue('Trash'),
  findJunkFolder: vi.fn().mockResolvedValue('Junk'),
}));

vi.mock('./folderCounters.js', () => ({
  setFolderCounts: vi.fn().mockResolvedValue(undefined),
  adjustFolderCounters: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../realtime/eventPublisher.js', () => ({
  publishEvent: vi.fn().mockResolvedValue(undefined),
}));

const { isPurgeableFolder, emptyFolder, purgeOldMessages } = await import('./folderPurgeService.js');

describe('folderPurgeService', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearDb();
    vi.clearAllMocks();
  });

  function makeAccount(): IAccountDocument {
    return {
      _id: '507f1f77bcf86cd799439011',
      userId: '507f1f77bcf86cd799439099',
      provider: 'imap',
      emailAddress: 'purge@example.com',
    } as unknown as IAccountDocument;
  }

  describe('isPurgeableFolder', () => {
    it('reconnaît les dossiers Corbeille et Spams', async () => {
      const account = makeAccount();
      expect(await isPurgeableFolder(account, 'Trash')).toBe(true);
      expect(await isPurgeableFolder(account, 'corbeille')).toBe(true);
      expect(await isPurgeableFolder(account, 'Junk')).toBe(true);
      expect(await isPurgeableFolder(account, 'spam')).toBe(true);
    });

    it('interdit les dossiers vitaux (INBOX, Sent, Archive, etc.)', async () => {
      const account = makeAccount();
      expect(await isPurgeableFolder(account, 'INBOX')).toBe(false);
      expect(await isPurgeableFolder(account, 'Sent')).toBe(false);
      expect(await isPurgeableFolder(account, 'Archive')).toBe(false);
      expect(await isPurgeableFolder(account, 'Mes Dossiers')).toBe(false);
    });
  });

  describe('emptyFolder', () => {
    it('refuse catégoriquement de vider INBOX avec une erreur 403', async () => {
      const account = makeAccount();
      await expect(emptyFolder(account, 'INBOX')).rejects.toThrow(AppError);
      await expect(emptyFolder(account, 'INBOX')).rejects.toMatchObject({ statusCode: 403 });
    });

    it('vide un dossier Trash existant côté IMAP et MongoDB', async () => {
      const account = makeAccount();

      // Insère des messages de test
      await MessageModel.create([
        {
          accountId: account._id,
          folder: 'Trash',
          uid: 101,
          subject: 'Msg 1',
          from: { address: 'a@b.com' },
          date: new Date(),
        },
        {
          accountId: account._id,
          folder: 'Trash',
          uid: 102,
          subject: 'Msg 2',
          from: { address: 'a@b.com' },
          date: new Date(),
        },
      ]);

      const result = await emptyFolder(account, 'Trash');

      expect(mockClient.mailboxOpen).toHaveBeenCalledWith('Trash', { readOnly: false });
      expect(mockClient.messageDelete).toHaveBeenCalledWith('1:*', { uid: false });
      expect(result.deletedCount).toBe(2);
      expect(result.folder).toBe('Trash');

      // Vérifie la purge en base
      const remaining = await MessageModel.countDocuments({ accountId: account._id, folder: 'Trash' });
      expect(remaining).toBe(0);
    });
  });

  describe('purgeOldMessages', () => {
    it('supprime les messages plus anciens que retentionDays', async () => {
      const account = makeAccount();
      const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000); // 40 jours
      const recentDate = new Date();

      await MessageModel.create([
        {
          accountId: account._id,
          folder: 'Trash',
          uid: 201,
          subject: 'Ancien',
          from: { address: 'a@b.com' },
          date: oldDate,
        },
        {
          accountId: account._id,
          folder: 'Trash',
          uid: 202,
          subject: 'Recent',
          from: { address: 'a@b.com' },
          date: recentDate,
        },
      ]);

      const purgedCount = await purgeOldMessages(account, 'Trash', 30);

      expect(purgedCount).toBe(1);
      expect(mockClient.messageDelete).toHaveBeenCalledWith([201], { uid: true });

      const remaining = await MessageModel.find({ accountId: account._id, folder: 'Trash' });
      expect(remaining).toHaveLength(1);
      expect(remaining[0].uid).toBe(202);
    });
  });
});
