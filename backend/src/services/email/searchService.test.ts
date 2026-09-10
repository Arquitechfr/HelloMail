import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IAccountDocument } from '../../models/Account.js';

// Mock MessageModel avec find et countDocuments.
const mockFind = vi.fn();
const mockCountDocuments = vi.fn();
const mockSort = vi.fn();
const mockSkip = vi.fn();
const mockLimit = vi.fn();
const mockLean = vi.fn();

vi.mock('../../models/Message.js', () => ({
  MessageModel: {
    find: (...args: unknown[]) => {
      mockFind(...args);
      return {
        sort: (...s: unknown[]) => {
          mockSort(...s);
          return {
            skip: (...sk: unknown[]) => {
              mockSkip(...sk);
              return {
                limit: (...l: unknown[]) => {
                  mockLimit(...l);
                  return { lean: (...ln: unknown[]) => {
                    mockLean(...ln);
                    return Promise.resolve([{ uid: 1, subject: 'Test' }]);
                  } };
                },
              };
            },
          };
        },
      };
    },
    countDocuments: (...args: unknown[]) => {
      mockCountDocuments(...args);
      return Promise.resolve(1);
    },
  },
}));

const { parseSearchQuery, searchMessages } = await import('./searchService.js');

function makeAccount(): IAccountDocument {
  return {
    _id: '507f1f77bcf86cd799439011',
  } as unknown as IAccountDocument;
}

describe('parseSearchQuery', () => {
  it('retourne vide pour une requête undefined', () => {
    const result = parseSearchQuery(undefined);
    expect(result.textQuery).toBeUndefined();
    expect(result.filters).toEqual({});
  });

  it('extrait le texte libre sans opérateurs', () => {
    const result = parseSearchQuery('hello world');
    expect(result.textQuery).toBe('hello world');
    expect(result.filters).toEqual({});
  });

  it('extrait l\'opérateur from:', () => {
    const result = parseSearchQuery('from:alice@test.com');
    expect(result.filters.from).toBe('alice@test.com');
    expect(result.textQuery).toBeUndefined();
  });

  it('extrait l\'opérateur to:', () => {
    const result = parseSearchQuery('to:bob@test.com');
    expect(result.filters.to).toBe('bob@test.com');
  });

  it('extrait l\'opérateur subject:', () => {
    const result = parseSearchQuery('subject:test');
    expect(result.filters.subject).toBe('test');
  });

  it('extrait is:unread', () => {
    const result = parseSearchQuery('is:unread');
    expect(result.filters.seen).toBe(false);
  });

  it('extrait is:read', () => {
    const result = parseSearchQuery('is:read');
    expect(result.filters.seen).toBe(true);
  });

  it('extrait is:flagged', () => {
    const result = parseSearchQuery('is:flagged');
    expect(result.filters.flagged).toBe(true);
  });

  it('extrait is:unflagged', () => {
    const result = parseSearchQuery('is:unflagged');
    expect(result.filters.flagged).toBe(false);
  });

  it('extrait has:attachment', () => {
    const result = parseSearchQuery('has:attachment');
    expect(result.filters.hasAttachments).toBe(true);
  });

  it('extrait has:attachments', () => {
    const result = parseSearchQuery('has:attachments');
    expect(result.filters.hasAttachments).toBe(true);
  });

  it('extrait before:2026-01-01', () => {
    const result = parseSearchQuery('before:2026-01-01');
    expect(result.filters.before).toEqual(new Date('2026-01-01'));
  });

  it('extrait since:2026-01-01', () => {
    const result = parseSearchQuery('since:2026-01-01');
    expect(result.filters.since).toEqual(new Date('2026-01-01'));
  });

  it('combine opérateurs et texte libre', () => {
    const result = parseSearchQuery('from:alice@test.com hello world is:unread');
    expect(result.filters.from).toBe('alice@test.com');
    expect(result.filters.seen).toBe(false);
    expect(result.textQuery).toBe('hello world');
  });

  it('ignore les opérateurs inconnus (gardés comme texte)', () => {
    const result = parseSearchQuery('unknown:foo bar');
    expect(result.textQuery).toBe('unknown:foo bar');
  });

  it('ignore les dates invalides', () => {
    const result = parseSearchQuery('before:notadate');
    expect(result.filters.before).toBeUndefined();
    expect(result.textQuery).toBe('before:notadate');
  });
});

describe('searchMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('recherche avec texte plein uniquement', async () => {
    const result = await searchMessages(makeAccount(), {
      q: 'hello world',
      page: 1,
      limit: 20,
    });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(mockFind).toHaveBeenCalled();
    expect(mockCountDocuments).toHaveBeenCalled();
  });

  it('applique les filtres explicites', async () => {
    await searchMessages(makeAccount(), {
      folder: 'INBOX',
      seen: false,
      flagged: true,
      hasAttachments: true,
      from: 'alice@test.com',
      page: 1,
      limit: 20,
    });

    expect(mockFind).toHaveBeenCalled();
    const query = mockFind.mock.calls[0][0] as Record<string, unknown>;
    expect(query.accountId).toBeDefined();
    expect(query.folder).toBe('INBOX');
    expect(query['flags.seen']).toBe(false);
    expect(query['flags.flagged']).toBe(true);
    expect(query.hasAttachments).toBe(true);
    expect(query['from.address']).toEqual({ $regex: 'alice@test.com', $options: 'i' });
  });

  it('applique le filtre par plage de dates', async () => {
    const since = new Date('2026-01-01');
    const before = new Date('2026-12-31');

    await searchMessages(makeAccount(), {
      since,
      before,
      page: 1,
      limit: 20,
    });

    const query = mockFind.mock.calls[0][0] as Record<string, unknown>;
    expect(query.date).toEqual({ $gte: since, $lte: before });
  });

  it('retourne la pagination correcte', async () => {
    const result = await searchMessages(makeAccount(), {
      q: 'test',
      page: 2,
      limit: 10,
    });

    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
  });
});
