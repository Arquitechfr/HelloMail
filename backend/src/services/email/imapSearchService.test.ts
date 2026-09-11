import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDb, teardownTestDb, clearDb } from '../../test/setup.js';
import { MessageModel } from '../../models/Message.js';
import type { IAccountDocument } from '../../models/Account.js';
import type { SearchQuery } from './searchService.js';

const ACCOUNT_ID = '507f1f77bcf86cd799439011';

// FetchMessageObject minimal conforme au contrat de mapFetchResultToMessage.
function makeFetchMsg(uid: number, subject: string) {
  return {
    uid,
    envelope: {
      subject,
      from: [{ address: 'alice@test.com', name: 'Alice' }],
      to: [{ address: 'me@test.com' }],
      date: new Date('2026-01-01T10:00:00Z'),
      messageId: `<msg-${uid}@test.com>`,
    },
    flags: new Set<string>(),
    bodyStructure: { type: 'text/plain' },
    size: 1024,
  };
}

const mockClient = {
  usable: true,
  mailboxOpen: vi.fn().mockResolvedValue({ exists: 10 }),
  search: vi.fn(),
  fetch: vi.fn(),
};

vi.mock('./imapPool.js', () => ({
  imapPool: {
    acquire: vi.fn().mockResolvedValue(mockClient),
    release: vi.fn(),
  },
}));

const { importSearchResultsFromServer, shouldSearchServer } = await import('./imapSearchService.js');

function makeAccount(): IAccountDocument {
  return {
    _id: ACCOUNT_ID,
    provider: 'imap',
    imapConfig: { host: 'imap.test.com', port: 993, secure: true },
  } as unknown as IAccountDocument;
}

function makeQuery(overrides: Partial<SearchQuery> = {}): SearchQuery {
  return { page: 1, limit: 20, ...overrides };
}

async function* fakeFetch(msgs: ReturnType<typeof makeFetchMsg>[]) {
  for (const m of msgs) yield m;
}

describe('imapSearchService', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearDb();
    vi.clearAllMocks();
    // mockReset purge les files "mockReturnValueOnce" non consommées
    // (sinon elles fuient d'un test à l'autre).
    mockClient.search.mockReset();
    mockClient.fetch.mockReset();
    mockClient.mailboxOpen.mockReset().mockResolvedValue({ exists: 10 });
  });

  describe('shouldSearchServer', () => {
    it('retourne false sans critères de recherche', () => {
      expect(shouldSearchServer(makeQuery(), 0)).toBe(false);
    });

    it('retourne true si critères présents et 0 résultat local', () => {
      expect(shouldSearchServer(makeQuery({ q: 'facture' }), 0)).toBe(true);
      expect(shouldSearchServer(makeQuery({ seen: false }), 0)).toBe(true);
    });

    it('retourne true si la page demandée dépasse le périmètre local', () => {
      expect(shouldSearchServer(makeQuery({ q: 'x', page: 3 }), 40)).toBe(true);
    });

    it('retourne false si les résultats locaux couvrent la page', () => {
      expect(shouldSearchServer(makeQuery({ q: 'x', page: 1 }), 50)).toBe(false);
    });
  });

  describe('importSearchResultsFromServer', () => {
    it('recherche IMAP puis upserte les envelopes en base', async () => {
      mockClient.search.mockResolvedValueOnce([1, 2]);
      mockClient.fetch.mockReturnValueOnce(
        fakeFetch([makeFetchMsg(1, 'Facture EDF'), makeFetchMsg(2, 'Facture Orange')]),
      );

      const imported = await importSearchResultsFromServer(makeAccount(), makeQuery({ q: 'facture' }));

      expect(imported).toBe(2);
      expect(mockClient.mailboxOpen).toHaveBeenCalledWith('INBOX', { readOnly: true });
      expect(mockClient.search).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'facture' }),
        { uid: true },
      );

      const stored = await MessageModel.find({ accountId: ACCOUNT_ID }).sort({ uid: 1 }).lean();
      expect(stored).toHaveLength(2);
      expect(stored[0].subject).toBe('Facture EDF');
    });

    it('traduit les filtres structurés en critères IMAP', async () => {
      mockClient.search.mockResolvedValueOnce([]);
      mockClient.fetch.mockReturnValueOnce(fakeFetch([]));

      await importSearchResultsFromServer(
        makeAccount(),
        makeQuery({ from: 'alice', seen: false, folder: 'Archive' }),
      );

      expect(mockClient.mailboxOpen).toHaveBeenCalledWith('Archive', { readOnly: true });
      expect(mockClient.search).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'alice', seen: false }),
        { uid: true },
      );
    });

    it('retourne 0 si le serveur ne trouve rien', async () => {
      mockClient.search.mockResolvedValueOnce(false);

      const imported = await importSearchResultsFromServer(makeAccount(), makeQuery({ q: 'x' }));

      expect(imported).toBe(0);
      expect(mockClient.fetch).not.toHaveBeenCalled();
    });

    it('retente sans le critère text si le serveur le rejette', async () => {
      mockClient.search
        .mockRejectedValueOnce(new Error('BAD invalid search criteria'))
        .mockResolvedValueOnce([5]);
      mockClient.fetch.mockReturnValueOnce(fakeFetch([makeFetchMsg(5, 'Test')]));

      const imported = await importSearchResultsFromServer(makeAccount(), makeQuery({ q: 'facture' }));

      expect(imported).toBe(1);
      expect(mockClient.search).toHaveBeenNthCalledWith(2, {}, { uid: true });
    });

    it('libère le pool IMAP même en cas d\'erreur', async () => {
      const { imapPool } = await import('./imapPool.js');
      mockClient.search.mockRejectedValueOnce(new Error('IMAP down'));

      // Filtre sans `q` → pas de critère text → pas de retry dégradé.
      await expect(
        importSearchResultsFromServer(makeAccount(), makeQuery({ seen: false })),
      ).rejects.toThrow('IMAP down');

      expect(imapPool.release).toHaveBeenCalledWith(ACCOUNT_ID);
    });
  });
});
