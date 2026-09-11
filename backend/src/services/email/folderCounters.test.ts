import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { FolderModel } from '../../models/Folder.js';
import { setupTestDb, teardownTestDb, clearDb } from '../../test/setup.js';
import { adjustFolderCounters, setFolderCounts } from './folderCounters.js';

const ACCOUNT_ID = '507f1f77bcf86cd799439011';

async function createFolderDoc(overrides: Record<string, unknown> = {}) {
  return FolderModel.create({
    accountId: new mongoose.Types.ObjectId(ACCOUNT_ID),
    path: 'INBOX',
    name: 'INBOX',
    delimiter: '/',
    flags: [],
    messages: 10,
    unseen: 3,
    uidNext: 100,
    syncedAt: new Date(),
    ...overrides,
  });
}

describe('folderCounters', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  beforeEach(async () => {
    await clearDb();
  });

  describe('adjustFolderCounters', () => {
    it('incrémente messages et unseen', async () => {
      await createFolderDoc();

      await adjustFolderCounters(ACCOUNT_ID, 'INBOX', { messagesDelta: 1, unseenDelta: 1 });

      const doc = await FolderModel.findOne({ accountId: ACCOUNT_ID, path: 'INBOX' }).lean();
      expect(doc?.messages).toBe(11);
      expect(doc?.unseen).toBe(4);
    });

    it('décrémente messages et unseen', async () => {
      await createFolderDoc();

      await adjustFolderCounters(ACCOUNT_ID, 'INBOX', { messagesDelta: -1, unseenDelta: -1 });

      const doc = await FolderModel.findOne({ accountId: ACCOUNT_ID, path: 'INBOX' }).lean();
      expect(doc?.messages).toBe(9);
      expect(doc?.unseen).toBe(2);
    });

    it('plafonne les compteurs à 0 (jamais négatif)', async () => {
      await createFolderDoc({ messages: 1, unseen: 0 });

      await adjustFolderCounters(ACCOUNT_ID, 'INBOX', { messagesDelta: -5, unseenDelta: -3 });

      const doc = await FolderModel.findOne({ accountId: ACCOUNT_ID, path: 'INBOX' }).lean();
      expect(doc?.messages).toBe(0);
      expect(doc?.unseen).toBe(0);
    });

    it('est un no-op si le document n\'existe pas', async () => {
      await adjustFolderCounters(ACCOUNT_ID, 'INBOX', { messagesDelta: -1, unseenDelta: -1 });

      const count = await FolderModel.countDocuments({ accountId: ACCOUNT_ID });
      expect(count).toBe(0);
    });

    it('est un no-op si les deux deltas sont nuls', async () => {
      await createFolderDoc();

      await adjustFolderCounters(ACCOUNT_ID, 'INBOX', { messagesDelta: 0, unseenDelta: 0 });

      const doc = await FolderModel.findOne({ accountId: ACCOUNT_ID, path: 'INBOX' }).lean();
      expect(doc?.messages).toBe(10);
      expect(doc?.unseen).toBe(3);
    });

    it('ne touche pas syncedAt (le TTL de rafraîchissement est préservé)', async () => {
      const stale = new Date(Date.now() - 10 * 60 * 1000);
      await createFolderDoc({ syncedAt: stale });

      await adjustFolderCounters(ACCOUNT_ID, 'INBOX', { messagesDelta: -1 });

      const doc = await FolderModel.findOne({ accountId: ACCOUNT_ID, path: 'INBOX' }).lean();
      expect(doc?.syncedAt.getTime()).toBe(stale.getTime());
    });
  });

  describe('setFolderCounts', () => {
    it('écrit des valeurs absolues', async () => {
      await createFolderDoc({ messages: 5, unseen: 2 });

      await setFolderCounts(ACCOUNT_ID, 'INBOX', { messages: 42 });

      const doc = await FolderModel.findOne({ accountId: ACCOUNT_ID, path: 'INBOX' }).lean();
      expect(doc?.messages).toBe(42);
      expect(doc?.unseen).toBe(2); // non touché
    });

    it('est un no-op si le document n\'existe pas', async () => {
      await setFolderCounts(ACCOUNT_ID, 'INBOX', { messages: 42 });

      const count = await FolderModel.countDocuments({ accountId: ACCOUNT_ID });
      expect(count).toBe(0);
    });
  });
});
