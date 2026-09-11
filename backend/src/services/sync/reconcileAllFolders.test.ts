import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IAccountDocument } from '../../models/Account.js';

// Mock de MessageModel — supporte la chaîne find().select().lean().
const mockFindResult = vi.fn();
const mockDeleteMany = vi.fn().mockResolvedValue({ deletedCount: 0 });

vi.mock('../../models/Message.js', () => ({
  MessageModel: {
    find: vi.fn(() => ({
      select: vi.fn(() => ({
        lean: mockFindResult,
      })),
    })),
    deleteMany: mockDeleteMany,
  },
}));

// Mock de folderCounters (compteurs du cache Folder).
vi.mock('../email/folderCounters.js', () => ({
  adjustFolderCounters: vi.fn().mockResolvedValue(undefined),
  setFolderCounts: vi.fn().mockResolvedValue(undefined),
}));

// Mock de logger.
vi.mock('../../config/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock de specialFolders.
const mockFindResultSentFolder = vi.fn();
const mockFindResultDraftsFolder = vi.fn();
const mockFindResultTrashFolder = vi.fn();
const mockFindResultJunkFolder = vi.fn();
const mockFindResultArchiveFolder = vi.fn();

vi.mock('../email/specialFolders.js', () => ({
  findSentFolder: mockFindResultSentFolder,
  findDraftsFolder: mockFindResultDraftsFolder,
  findTrashFolder: mockFindResultTrashFolder,
  findJunkFolder: mockFindResultJunkFolder,
  findArchiveFolder: mockFindResultArchiveFolder,
}));

const { reconcileFolder } = await import('./reconcileFolder.js');
const { reconcileAllFolders } = await import('./reconcileAllFolders.js');

function makeMockClient(returnedUids: number[]) {
  const fetchIterable = {
    async *[Symbol.asyncIterator]() {
      for (const uid of returnedUids) yield { uid };
    },
  };
  return {
    mailboxOpen: vi.fn().mockResolvedValue({ exists: returnedUids.length }),
    fetch: vi.fn().mockReturnValue(fetchIterable),
  };
}

function makeAccount(): IAccountDocument {
  return {
    _id: '507f1f77bcf86cd799439011',
    imapConfig: {
      host: 'imap.test.com', port: 993, secure: true,
      smtpHost: 'smtp.test.com', smtpPort: 465, smtpSecure: true,
      username: 'user@test.com',
      encryptedPassword: { iv: 'aa', authTag: 'bb', ciphertext: 'cc' },
    },
  } as unknown as IAccountDocument;
}

describe('reconcileFolder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteMany.mockResolvedValue({ deletedCount: 0 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retourne 0 si aucun message en base', async () => {
    mockFindResult.mockResolvedValueOnce([]);

    const deleted = await reconcileFolder(makeMockClient([]) as never, 'acc1', 'INBOX');

    expect(deleted).toBe(0);
  });

  it('supprime les UID absents d\'IMAP', async () => {
    mockFindResult.mockResolvedValueOnce([
      { uid: 1 }, { uid: 2 }, { uid: 3 },
    ]);
    // IMAP ne retourne que UID 1 et 3 → UID 2 est fantôme.
    const client = makeMockClient([1, 3]);
    mockDeleteMany.mockResolvedValueOnce({ deletedCount: 1 });

    const deleted = await reconcileFolder(client as never, 'acc1', 'INBOX');

    expect(deleted).toBe(1);
    expect(mockDeleteMany).toHaveBeenCalledWith({
      accountId: 'acc1',
      folder: 'INBOX',
      uid: { $in: [2] },
    });
  });

  it('ne supprime rien si tous les UID existent sur IMAP', async () => {
    mockFindResult.mockResolvedValueOnce([{ uid: 1 }, { uid: 2 }]);
    const client = makeMockClient([1, 2]);

    const deleted = await reconcileFolder(client as never, 'acc1', 'INBOX');

    expect(deleted).toBe(0);
    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  it('ouvre le dossier en readOnly avant le fetch (régression : ne fetch pas le mauvais dossier)', async () => {
    mockFindResult.mockResolvedValueOnce([{ uid: 1 }]);
    const client = makeMockClient([1]);

    await reconcileFolder(client as never, 'acc1', 'Sent');

    expect(client.mailboxOpen).toHaveBeenCalledWith('Sent', { readOnly: true });
  });
});

describe('reconcileAllFolders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteMany.mockResolvedValue({ deletedCount: 0 });
    mockFindResult.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('réconcilie INBOX + tous les dossiers spéciaux trouvés', async () => {
    mockFindResultSentFolder.mockResolvedValue('Sent');
    mockFindResultDraftsFolder.mockResolvedValue('Drafts');
    mockFindResultTrashFolder.mockResolvedValue('Trash');
    mockFindResultJunkFolder.mockResolvedValue('Junk');
    mockFindResultArchiveFolder.mockResolvedValue('Archive');

    // Chaque dossier a 1 message fantôme.
    mockFindResult.mockResolvedValue([{ uid: 1 }]);
    const client = makeMockClient([]); // IMAP vide → tous fantômes
    mockDeleteMany.mockResolvedValue({ deletedCount: 1 });

    const total = await reconcileAllFolders(client as never, 'acc1', makeAccount());

    // INBOX + 5 dossiers spéciaux = 6 suppressions.
    expect(total).toBe(6);
    expect(mockDeleteMany).toHaveBeenCalledTimes(6);
  });

  it('réconcilie INBOX uniquement si aucun dossier spécial trouvé', async () => {
    mockFindResultSentFolder.mockResolvedValue(null);
    mockFindResultDraftsFolder.mockResolvedValue(null);
    mockFindResultTrashFolder.mockResolvedValue(null);
    mockFindResultJunkFolder.mockResolvedValue(null);
    mockFindResultArchiveFolder.mockResolvedValue(null);

    mockFindResult.mockResolvedValueOnce([{ uid: 1 }]);
    const client = makeMockClient([]);
    mockDeleteMany.mockResolvedValueOnce({ deletedCount: 1 });

    const total = await reconcileAllFolders(client as never, 'acc1', makeAccount());

    expect(total).toBe(1);
    expect(mockDeleteMany).toHaveBeenCalledTimes(1);
  });

  it('continue si un dossier spécial échoue', async () => {
    mockFindResultSentFolder.mockResolvedValue('Sent');
    mockFindResultDraftsFolder.mockRejectedValue(new Error('IMAP error'));
    mockFindResultTrashFolder.mockResolvedValue('Trash');
    mockFindResultJunkFolder.mockResolvedValue(null);
    mockFindResultArchiveFolder.mockResolvedValue(null);

    mockFindResult.mockResolvedValue([{ uid: 1 }]);
    const client = makeMockClient([]);
    mockDeleteMany.mockResolvedValue({ deletedCount: 1 });

    const total = await reconcileAllFolders(client as never, 'acc1', makeAccount());

    // INBOX + Sent + Trash = 3 (Drafts a échoué).
    expect(total).toBe(3);
  });

  it('ignore un dossier spécial qui résout vers INBOX', async () => {
    mockFindResultSentFolder.mockResolvedValue('INBOX');
    mockFindResultDraftsFolder.mockResolvedValue(null);
    mockFindResultTrashFolder.mockResolvedValue(null);
    mockFindResultJunkFolder.mockResolvedValue(null);
    mockFindResultArchiveFolder.mockResolvedValue(null);

    mockFindResult.mockResolvedValueOnce([{ uid: 1 }]);
    const client = makeMockClient([]);
    mockDeleteMany.mockResolvedValueOnce({ deletedCount: 1 });

    const total = await reconcileAllFolders(client as never, 'acc1', makeAccount());

    // INBOX seulement (Sent a résolu vers INBOX → skip).
    expect(total).toBe(1);
  });

  it('ne plante pas si reconcileFolder lève sur un dossier', async () => {
    mockFindResultSentFolder.mockResolvedValue('Sent');
    mockFindResultDraftsFolder.mockResolvedValue(null);
    mockFindResultTrashFolder.mockResolvedValue(null);
    mockFindResultJunkFolder.mockResolvedValue(null);
    mockFindResultArchiveFolder.mockResolvedValue(null);

    // INBOX réussit, Sent lève (fetch error).
    mockFindResult
      .mockResolvedValueOnce([{ uid: 1 }])
      .mockRejectedValueOnce(new Error('DB find error'));
    const client = makeMockClient([]);
    mockDeleteMany.mockResolvedValueOnce({ deletedCount: 1 });

    const total = await reconcileAllFolders(client as never, 'acc1', makeAccount());

    // INBOX = 1, Sent a échoué = 0.
    expect(total).toBe(1);
  });
});
