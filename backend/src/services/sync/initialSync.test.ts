import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IAccountDocument } from '../../models/Account.js';
import type { FetchMessageObject } from 'imapflow';

// Mock de MessageModel.
const mockCountDocuments = vi.fn();
const mockUpdateOne = vi.fn().mockResolvedValue({});
const mockDeleteMany = vi.fn().mockResolvedValue({});
const mockFind = vi.fn().mockImplementation(() => ({
  select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
}));

vi.mock('../../models/Message.js', () => ({
  MessageModel: {
    countDocuments: mockCountDocuments,
    updateOne: mockUpdateOne,
    deleteMany: mockDeleteMany,
    find: mockFind,
  },
}));

// Mock de FolderSyncStateModel (état CONDSTORE pour la delta sync).
// findOne retourne un objet avec .lean() comme la vraie requête Mongoose.
const mockFindOneState = vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
const mockUpdateOneState = vi.fn().mockResolvedValue({});

vi.mock('../../models/FolderSyncState.js', () => ({
  FolderSyncStateModel: {
    findOne: mockFindOneState,
    updateOne: mockUpdateOneState,
  },
}));

// Mock de folderService (rafraîchissement du cache Folder en fin de sync).
vi.mock('../email/folderService.js', () => ({
  syncFolderCacheFromClient: vi.fn().mockResolvedValue(undefined),
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
const mockFindSentFolder = vi.fn();
const mockFindDraftsFolder = vi.fn();
const mockFindTrashFolder = vi.fn();
const mockFindJunkFolder = vi.fn();
const mockFindArchiveFolder = vi.fn();

vi.mock('../email/specialFolders.js', () => ({
  findSentFolder: mockFindSentFolder,
  findDraftsFolder: mockFindDraftsFolder,
  findTrashFolder: mockFindTrashFolder,
  findJunkFolder: mockFindJunkFolder,
  findArchiveFolder: mockFindArchiveFolder,
}));

const { runInitialSyncForFolder, runInitialSyncAll } = await import('./initialSync.js');

function makeFetchResult(uid: number, subject: string): FetchMessageObject {
  return {
    seq: uid,
    uid,
    envelope: {
      subject,
      from: [{ name: 'Alice', address: 'alice@example.com' }],
      to: [{ name: 'Bob', address: 'bob@example.com' }],
      date: new Date('2026-01-15T10:00:00Z'),
      messageId: `<${uid}@example.com>`,
    },
    flags: new Set(['\\Seen']),
    bodyStructure: { type: 'text/plain', part: '1' },
    size: 1024,
  } as FetchMessageObject;
}

/** Crée un mock client ImapFlow avec mailboxOpen + fetch asynchrone itérable. */
function makeMockClient(messages: FetchMessageObject[], exists: number) {
  const fetchIterable = {
    async *[Symbol.asyncIterator]() {
      for (const msg of messages) yield msg;
    },
  };

  return {
    mailboxOpen: vi.fn().mockResolvedValue({ exists }),
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

describe('initialSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateOne.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('runInitialSyncForFolder', () => {
    it('sync un dossier avec messages', async () => {
      const messages = [makeFetchResult(1, 'A'), makeFetchResult(2, 'B')];
      const client = makeMockClient(messages, 2);
      mockCountDocuments.mockResolvedValueOnce(0);

      const synced = await runInitialSyncForFolder(
        client as never,
        'acc1',
        'INBOX',
      );

      expect(synced).toBe(2);
      expect(client.mailboxOpen).toHaveBeenCalledWith('INBOX', { readOnly: false });
      expect(mockUpdateOne).toHaveBeenCalledTimes(2);
    });

    it('retourne 0 si le dossier est vide', async () => {
      const client = makeMockClient([], 0);

      const synced = await runInitialSyncForFolder(
        client as never,
        'acc1',
        'INBOX',
      );

      expect(synced).toBe(0);
      expect(client.fetch).not.toHaveBeenCalled();
    });

    it('est idempotent (count DB === count IMAP)', async () => {
      const client = makeMockClient([], 42);
      mockCountDocuments.mockResolvedValueOnce(42);

      const synced = await runInitialSyncForFolder(
        client as never,
        'acc1',
        'INBOX',
      );

      expect(synced).toBe(0);
      expect(client.fetch).not.toHaveBeenCalled();
    });

    it('continue sur erreur upsert individuel', async () => {
      const messages = [makeFetchResult(1, 'A'), makeFetchResult(2, 'B')];
      const client = makeMockClient(messages, 2);
      mockCountDocuments.mockResolvedValueOnce(0);
      mockUpdateOne
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce({});

      const synced = await runInitialSyncForFolder(
        client as never,
        'acc1',
        'INBOX',
      );

      expect(synced).toBe(1);
      expect(mockUpdateOne).toHaveBeenCalledTimes(2);
    });

    it('borne le fetch aux N derniers messages (range de séquence)', async () => {
      const messages = [makeFetchResult(48, 'A'), makeFetchResult(49, 'B'), makeFetchResult(50, 'C')];
      const client = makeMockClient(messages, 50);
      mockCountDocuments.mockResolvedValueOnce(0);

      await runInitialSyncForFolder(client as never, 'acc1', 'INBOX');

      // 50 - 50 + 1 = 1 → range "1:50" (INITIAL_SYNC_MESSAGE_COUNT = 50)
      // Mais avec 50 messages et 50 de limite, start = max(1, 50-50+1) = 1
      const range = client.fetch.mock.calls[0][0];
      expect(range).toBe('1:50');
    });

    it('sync un dossier arbitraire (Sent)', async () => {
      const messages = [makeFetchResult(1, 'Sent msg')];
      const client = makeMockClient(messages, 1);
      mockCountDocuments.mockResolvedValueOnce(0);

      const synced = await runInitialSyncForFolder(
        client as never,
        'acc1',
        'Sent',
      );

      expect(synced).toBe(1);
      expect(client.mailboxOpen).toHaveBeenCalledWith('Sent', { readOnly: false });
    });

    it('delta sync : ne fetch que les changements via changedSince', async () => {
      mockFindOneState.mockReturnValueOnce({
        lean: vi.fn().mockResolvedValue({ uidValidity: '5', highestModseq: '100' }),
      });
      const changed = [makeFetchResult(7, 'Changed')];
      const client = makeMockClient(changed, 10);
      client.mailboxOpen.mockResolvedValueOnce({ exists: 10, uidValidity: 5, highestModseq: 200n });

      const synced = await runInitialSyncForFolder(client as never, 'acc1', 'INBOX');

      expect(synced).toBe(1);
      expect(client.fetch).toHaveBeenCalledWith(
        '1:*',
        expect.objectContaining({ envelope: true }),
        expect.objectContaining({ uid: true, changedSince: 100n }),
      );
      // Persiste le nouveau highestModseq.
      expect(mockUpdateOneState).toHaveBeenCalled();
    });

    it('purge le dossier si uidValidity a changé, puis resync complet', async () => {
      mockFindOneState.mockReturnValueOnce({
        lean: vi.fn().mockResolvedValue({ uidValidity: '4', highestModseq: '100' }),
      });
      const messages = [makeFetchResult(1, 'A')];
      const client = makeMockClient(messages, 1);
      client.mailboxOpen.mockResolvedValueOnce({ exists: 1, uidValidity: 5, highestModseq: 200n });
      mockCountDocuments.mockResolvedValueOnce(0);

      const synced = await runInitialSyncForFolder(client as never, 'acc1', 'INBOX');

      expect(mockDeleteMany).toHaveBeenCalledWith({ accountId: 'acc1', folder: 'INBOX' });
      expect(synced).toBe(1);
      // Fetch classique par range de séquence, pas changedSince.
      expect(client.fetch).toHaveBeenCalledWith('1:1', expect.not.objectContaining({ changedSince: expect.anything() }));
    });

    it('fallback sur la sync classique si la delta sync échoue (CONDSTORE absent)', async () => {
      mockFindOneState.mockReturnValueOnce({
        lean: vi.fn().mockResolvedValue({ uidValidity: '5', highestModseq: '100' }),
      });
      const messages = [makeFetchResult(1, 'A')];
      const client = {
        mailboxOpen: vi.fn().mockResolvedValue({ exists: 1, uidValidity: 5, highestModseq: 200n }),
        fetch: vi
          .fn()
          .mockImplementationOnce(() => {
            throw new Error('BADCONDSTORE not supported');
          })
          .mockImplementationOnce(() => ({
            async *[Symbol.asyncIterator]() {
              for (const msg of messages) yield msg;
            },
          })),
      };
      mockCountDocuments.mockResolvedValueOnce(0);

      const synced = await runInitialSyncForFolder(client as never, 'acc1', 'INBOX');

      expect(synced).toBe(1);
      expect(client.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('runInitialSyncAll', () => {
    it('sync INBOX + tous les dossiers spéciaux trouvés', async () => {
      const inboxMsgs = [makeFetchResult(1, 'Inbox')];
      const sentMsgs = [makeFetchResult(10, 'Sent')];
      const draftsMsgs = [makeFetchResult(20, 'Draft')];
      const trashMsgs = [makeFetchResult(30, 'Trash')];
      const junkMsgs = [makeFetchResult(40, 'Junk')];
      const archiveMsgs = [makeFetchResult(50, 'Archive')];

      const fetchCalls = [inboxMsgs, sentMsgs, draftsMsgs, trashMsgs, junkMsgs, archiveMsgs];
      let callIndex = 0;

      const client = {
        mailboxOpen: vi.fn().mockResolvedValue({ exists: 1 }),
        fetch: vi.fn().mockImplementation(() => {
          const msgs = fetchCalls[callIndex++];
          return {
            async *[Symbol.asyncIterator]() {
              for (const msg of msgs) yield msg;
            },
          };
        }),
      };

      mockCountDocuments.mockResolvedValue(0);
      mockFindSentFolder.mockResolvedValue('Sent');
      mockFindDraftsFolder.mockResolvedValue('Drafts');
      mockFindTrashFolder.mockResolvedValue('Trash');
      mockFindJunkFolder.mockResolvedValue('Junk');
      mockFindArchiveFolder.mockResolvedValue('Archive');

      const total = await runInitialSyncAll(client as never, 'acc1', makeAccount());

      expect(total).toBe(6);
      expect(client.mailboxOpen).toHaveBeenCalledTimes(6);
      expect(mockUpdateOne).toHaveBeenCalledTimes(6);
    });

    it('sync INBOX uniquement si aucun dossier spécial trouvé', async () => {
      const inboxMsgs = [makeFetchResult(1, 'Inbox')];
      const client = makeMockClient(inboxMsgs, 1);
      mockCountDocuments.mockResolvedValueOnce(0);
      mockFindSentFolder.mockResolvedValue(null);
      mockFindDraftsFolder.mockResolvedValue(null);
      mockFindTrashFolder.mockResolvedValue(null);
      mockFindJunkFolder.mockResolvedValue(null);
      mockFindArchiveFolder.mockResolvedValue(null);

      const total = await runInitialSyncAll(client as never, 'acc1', makeAccount());

      expect(total).toBe(1);
      expect(client.mailboxOpen).toHaveBeenCalledTimes(1);
    });

    it('continue si un dossier spécial échoue', async () => {
      const inboxMsgs = [makeFetchResult(1, 'Inbox')];
      const sentMsgs = [makeFetchResult(10, 'Sent')];
      const trashMsgs = [makeFetchResult(30, 'Trash')];
      const fetchCalls = [inboxMsgs, sentMsgs, trashMsgs];
      let callIndex = 0;

      const client = {
        mailboxOpen: vi.fn().mockResolvedValue({ exists: 1 }),
        fetch: vi.fn().mockImplementation(() => {
          const msgs = fetchCalls[callIndex++];
          return {
            async *[Symbol.asyncIterator]() {
              for (const msg of msgs) yield msg;
            },
          };
        }),
      };

      mockCountDocuments.mockResolvedValue(0);
      mockFindSentFolder.mockResolvedValue('Sent');
      mockFindDraftsFolder.mockRejectedValue(new Error('IMAP error'));
      mockFindTrashFolder.mockResolvedValue('Trash');
      mockFindJunkFolder.mockResolvedValue(null);
      mockFindArchiveFolder.mockResolvedValue(null);

      const total = await runInitialSyncAll(client as never, 'acc1', makeAccount());

      // INBOX + Sent + Trash = 3 (Drafts a échoué, Junk/Archive non trouvés)
      expect(total).toBe(3);
    });

    it('ignore un dossier spécial qui résout vers INBOX', async () => {
      const inboxMsgs = [makeFetchResult(1, 'Inbox')];
      const client = makeMockClient(inboxMsgs, 1);
      mockCountDocuments.mockResolvedValueOnce(0);
      mockFindSentFolder.mockResolvedValue('INBOX');
      mockFindDraftsFolder.mockResolvedValue(null);
      mockFindTrashFolder.mockResolvedValue(null);
      mockFindJunkFolder.mockResolvedValue(null);
      mockFindArchiveFolder.mockResolvedValue(null);

      const total = await runInitialSyncAll(client as never, 'acc1', makeAccount());

      expect(total).toBe(1);
      expect(client.mailboxOpen).toHaveBeenCalledTimes(1);
    });
  });
});
