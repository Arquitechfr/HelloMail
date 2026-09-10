import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IAccountDocument } from '../../models/Account.js';
import type { FetchMessageObject } from 'imapflow';

// Mock du pool IMAP.
const mockMailboxOpen = vi.fn().mockResolvedValue({ exists: 100 });
const mockFetch = vi.fn();
const mockSearch = vi.fn();

const mockClient = {
  usable: true,
  mailboxOpen: mockMailboxOpen,
  fetch: mockFetch,
  search: mockSearch,
  logout: vi.fn().mockResolvedValue(undefined),
  connect: vi.fn().mockResolvedValue(undefined),
};

vi.mock('./imapPool.js', () => ({
  imapPool: {
    acquire: vi.fn().mockResolvedValue(mockClient),
    release: vi.fn(),
  },
}));

// Mock de MessageModel — supporte la chaîne findOne().sort().select().lean() + updateOne.
const mockFindOneLean = vi.fn();
const mockUpdateOne = vi.fn().mockResolvedValue({});

vi.mock('../../models/Message.js', () => ({
  MessageModel: {
    findOne: vi.fn(() => ({
      sort: vi.fn(() => ({
        select: vi.fn(() => ({
          lean: mockFindOneLean,
        })),
      })),
    })),
    updateOne: mockUpdateOne,
  },
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

// Mock de messageMapper.
const mockMapFetchResultToMessage = vi.fn();
vi.mock('../sync/messageMapper.js', () => ({
  mapFetchResultToMessage: mockMapFetchResultToMessage,
}));

const { fetchMoreMessages } = await import('./fetchMoreService.js');

function makeAccount(): IAccountDocument {
  return {
    _id: '507f1f77bcf86cd799439011',
    imapConfig: {
      host: 'imap.test.com',
      port: 993,
      secure: true,
      smtpHost: 'smtp.test.com',
      smtpPort: 465,
      smtpSecure: true,
      username: 'user@test.com',
      encryptedPassword: { iv: 'aa', authTag: 'bb', ciphertext: 'cc' },
    },
  } as unknown as IAccountDocument;
}

function makeFetchResult(uid: number): FetchMessageObject {
  return {
    seq: uid,
    uid,
    envelope: {
      subject: `Subject ${uid}`,
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

function makeMessageInput(uid: number) {
  return {
    accountId: '507f1f77bcf86cd799439011',
    folder: 'INBOX',
    uid,
    subject: `Subject ${uid}`,
    from: { address: 'alice@example.com' },
    to: [{ address: 'bob@example.com' }],
    date: new Date('2026-01-15T10:00:00Z'),
    flags: { seen: true, answered: false, flagged: false },
    hasAttachments: false,
    size: 1024,
  };
}

/** Crée un async iterable pour mockFetch. */
function makeFetchIterable(messages: FetchMessageObject[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const msg of messages) yield msg;
    },
  };
}

describe('fetchMoreService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMailboxOpen.mockResolvedValue({ exists: 100 });
    mockUpdateOne.mockResolvedValue({});
    mockMapFetchResultToMessage.mockImplementation((_acc: string, _folder: string, fetchResult: FetchMessageObject) =>
      makeMessageInput(fetchResult.uid),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetch les messages plus anciens quand des messages existent en base', async () => {
    // Le plus bas UID en base est 50 → search 1:49.
    mockFindOneLean.mockResolvedValueOnce({ uid: 50 });
    mockSearch.mockResolvedValueOnce([45, 46, 47, 48, 49]);

    const messages = [makeFetchResult(49), makeFetchResult(48), makeFetchResult(47), makeFetchResult(46), makeFetchResult(45)];
    mockFetch.mockReturnValueOnce(makeFetchIterable(messages));

    const result = await fetchMoreMessages(makeAccount(), 'INBOX', 5);

    expect(result.fetched).toBe(5);
    expect(mockSearch).toHaveBeenCalledWith({ uid: '1:49' }, { uid: true });
    expect(mockMailboxOpen).toHaveBeenCalledWith('INBOX', { readOnly: true });
    expect(mockUpdateOne).toHaveBeenCalledTimes(5);
  });

  it('fallback aux N derniers si la base est vide', async () => {
    mockFindOneLean.mockResolvedValueOnce(null);
    // mailbox.exists = 100 → range = 51:100 (50 derniers).
    mockMailboxOpen.mockResolvedValueOnce({ exists: 100 });

    // 1er appel fetch : fetchUidsByRange retourne des UID simples.
    const uidOnlyMessages = [];
    for (let i = 51; i <= 100; i++) uidOnlyMessages.push({ uid: i });
    mockFetch.mockReturnValueOnce(makeFetchIterable(uidOnlyMessages as never));

    // 2e appel fetch : fetch complet avec envelope/flags/etc.
    const fullMessages = [];
    for (let i = 51; i <= 100; i++) fullMessages.push(makeFetchResult(i));
    mockFetch.mockReturnValueOnce(makeFetchIterable(fullMessages));

    const result = await fetchMoreMessages(makeAccount(), 'INBOX', 50);

    expect(result.fetched).toBe(50);
    // Le 1er appel (fetchUidsByRange) doit utiliser le range 51:100.
    expect(mockFetch.mock.calls[0][0]).toBe('51:100');
  });

  it('retourne 0 si le plus bas UID est 1 (pas de messages plus anciens)', async () => {
    mockFindOneLean.mockResolvedValueOnce({ uid: 1 });

    const result = await fetchMoreMessages(makeAccount(), 'INBOX');

    expect(result.fetched).toBe(0);
    expect(mockSearch).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('retourne 0 si la base est vide et le dossier est vide', async () => {
    mockFindOneLean.mockResolvedValueOnce(null);
    mockMailboxOpen.mockResolvedValueOnce({ exists: 0 });

    const result = await fetchMoreMessages(makeAccount(), 'INBOX');

    expect(result.fetched).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('retourne 0 si la search ne trouve aucun message plus ancien', async () => {
    mockFindOneLean.mockResolvedValueOnce({ uid: 50 });
    mockSearch.mockResolvedValueOnce([]);

    const result = await fetchMoreMessages(makeAccount(), 'INBOX');

    expect(result.fetched).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('limite le fetch au count demandé', async () => {
    mockFindOneLean.mockResolvedValueOnce({ uid: 100 });
    // 20 UIDs plus anciens, mais on en demande que 5.
    const olderUids = Array.from({ length: 20 }, (_, i) => i + 80); // 80-99
    mockSearch.mockResolvedValueOnce(olderUids);

    // Seuls les 5 plus récents (99, 98, 97, 96, 95) doivent être fetchés.
    const messages = [makeFetchResult(99), makeFetchResult(98), makeFetchResult(97), makeFetchResult(96), makeFetchResult(95)];
    mockFetch.mockReturnValueOnce(makeFetchIterable(messages));

    const result = await fetchMoreMessages(makeAccount(), 'INBOX', 5);

    expect(result.fetched).toBe(5);
    // Le fetch doit recevoir les 5 UIDs les plus récents.
    const fetchedUids = mockFetch.mock.calls[0][0];
    expect(fetchedUids).toEqual([99, 98, 97, 96, 95]);
  });

  it('continue sur erreur upsert individuel', async () => {
    mockFindOneLean.mockResolvedValueOnce({ uid: 50 });
    mockSearch.mockResolvedValueOnce([45, 46, 47]);

    const messages = [makeFetchResult(47), makeFetchResult(46), makeFetchResult(45)];
    mockFetch.mockReturnValueOnce(makeFetchIterable(messages));

    // Le 2e upsert échoue.
    mockUpdateOne
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValueOnce({});

    const result = await fetchMoreMessages(makeAccount(), 'INBOX');

    expect(result.fetched).toBe(2);
    expect(mockUpdateOne).toHaveBeenCalledTimes(3);
  });
});
