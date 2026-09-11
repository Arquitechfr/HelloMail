import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDb, teardownTestDb, clearDb } from '../../test/setup.js';
import { FolderModel } from '../../models/Folder.js';
import type { IAccountDocument } from '../../models/Account.js';

const ACCOUNT_ID = '507f1f77bcf86cd799439011';

const mockClient = {
  usable: true,
  connect: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn().mockResolvedValue(undefined),
  list: vi.fn(),
  mailboxCreate: vi.fn(),
};

vi.mock('./imapPool.js', () => ({
  imapPool: {
    acquire: vi.fn().mockResolvedValue(mockClient),
    release: vi.fn(),
  },
}));

vi.mock('./specialFolders.js', () => ({
  invalidateSpecialFolderCache: vi.fn(),
}));

const { listFolders, folderExists, createFolder } = await import('./folderService.js');

function makeAccount(): IAccountDocument {
  return {
    _id: ACCOUNT_ID,
    imapConfig: { host: 'imap.test.com', port: 993, secure: true },
  } as unknown as IAccountDocument;
}

const IMAP_LIST = [
  {
    path: 'INBOX',
    name: 'INBOX',
    delimiter: '/',
    specialUse: '\\Inbox',
    flags: new Set(['\\HasNoChildren']),
    status: { messages: 10, unseen: 2, uidNext: 50 },
  },
  {
    path: 'Sent',
    name: 'Sent',
    delimiter: '/',
    specialUse: '\\Sent',
    flags: new Set(),
    status: { messages: 3, unseen: 0, uidNext: 10 },
  },
];

describe('folderService — cache Folder', () => {
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

  it('écrit le cache en base après un LIST IMAP', async () => {
    mockClient.list.mockResolvedValueOnce(IMAP_LIST);

    const result = await listFolders(makeAccount());

    expect(result).toHaveLength(2);
    expect(mockClient.list).toHaveBeenCalledTimes(1);

    const cached = await FolderModel.find({ accountId: ACCOUNT_ID }).lean();
    expect(cached).toHaveLength(2);
    expect(cached.map((f) => f.path).sort()).toEqual(['INBOX', 'Sent']);
  });

  it('sert le cache sans appel IMAP si frais (< 5 min)', async () => {
    await FolderModel.create({
      accountId: ACCOUNT_ID,
      path: 'INBOX',
      name: 'INBOX',
      delimiter: '/',
      specialUse: '\\Inbox',
      flags: ['\\HasNoChildren'],
      messages: 10,
      unseen: 2,
      uidNext: 50,
      syncedAt: new Date(),
    });

    const result = await listFolders(makeAccount());

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('INBOX');
    expect(mockClient.list).not.toHaveBeenCalled();
  });

  it('ignore le cache périmé (> 5 min) et re-fetch via IMAP', async () => {
    await FolderModel.create({
      accountId: ACCOUNT_ID,
      path: 'OldFolder',
      name: 'OldFolder',
      delimiter: '/',
      syncedAt: new Date(Date.now() - 10 * 60 * 1000),
    });
    mockClient.list.mockResolvedValueOnce(IMAP_LIST);

    const result = await listFolders(makeAccount());

    expect(mockClient.list).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(2);
    // Le dossier disparu est nettoyé du cache.
    const cached = await FolderModel.find({ accountId: ACCOUNT_ID }).lean();
    expect(cached.map((f) => f.path).sort()).toEqual(['INBOX', 'Sent']);
  });

  it('folderExists retourne true pour un dossier connu, false sinon', async () => {
    await FolderModel.create({
      accountId: ACCOUNT_ID,
      path: 'INBOX',
      name: 'INBOX',
      delimiter: '/',
      syncedAt: new Date(),
    });

    expect(await folderExists(makeAccount(), 'INBOX')).toBe(true);
    expect(await folderExists(makeAccount(), 'Nope')).toBe(false);
  });

  it('folderExists dégrade en permissif si le cache est vide', async () => {
    expect(await folderExists(makeAccount(), 'Anything')).toBe(true);
  });

  it('createFolder invalide le cache Folder', async () => {
    await FolderModel.create({
      accountId: ACCOUNT_ID,
      path: 'INBOX',
      name: 'INBOX',
      delimiter: '/',
      syncedAt: new Date(),
    });
    mockClient.mailboxCreate.mockResolvedValueOnce({ path: 'New' });

    await createFolder(makeAccount(), 'New');

    const cached = await FolderModel.find({ accountId: ACCOUNT_ID }).lean();
    expect(cached).toHaveLength(0);
  });
});
