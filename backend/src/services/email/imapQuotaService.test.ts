import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import type { IAccountDocument } from '../../models/Account.js';
import { AccountModel } from '../../models/Account.js';
import { setupTestDb, teardownTestDb, clearDb } from '../../test/setup.js';
import { imapPool } from './imapPool.js';

const { mockClient } = vi.hoisted(() => ({
  mockClient: {
    getQuota: vi.fn(),
  },
}));

vi.mock('./imapPool.js', () => ({
  imapPool: {
    acquire: vi.fn().mockResolvedValue(mockClient),
    release: vi.fn(),
  },
}));

const { getAccountQuota, QUOTA_CACHE_TTL_MS } = await import('./imapQuotaService.js');

describe('imapQuotaService', () => {
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

  function makeAccount(overrides?: Partial<IAccountDocument>): IAccountDocument {
    return {
      _id: '507f1f77bcf86cd799439011',
      userId: '507f1f77bcf86cd799439099',
      provider: 'imap',
      emailAddress: 'test@example.com',
      imapConfig: {
        host: 'imap.example.com',
        port: 993,
        secure: true,
        smtpHost: 'smtp.example.com',
        smtpPort: 465,
        smtpSecure: true,
        username: 'test@example.com',
        encryptedPassword: { iv: 'iv', authTag: 'tag', ciphertext: 'cipher' },
      },
      ...overrides,
    } as unknown as IAccountDocument;
  }

  it('interroge le serveur IMAP et enregistre le quota en base', async () => {
    mockClient.getQuota.mockResolvedValueOnce({
      path: 'INBOX',
      storage: {
        used: 1048576000, // 1 Go
        limit: 2097152000, // 2 Go
      },
      messages: {
        used: 1500,
        limit: 10000,
      },
    });

    const account = makeAccount();
    const result = await getAccountQuota(account);

    expect(imapPool.acquire).toHaveBeenCalledWith(account);
    expect(mockClient.getQuota).toHaveBeenCalledWith('INBOX');
    expect(imapPool.release).toHaveBeenCalledWith(String(account._id));

    expect(result.supported).toBe(true);
    expect(result.usedBytes).toBe(1048576000);
    expect(result.totalBytes).toBe(2097152000);
    expect(result.percentage).toBe(50);
    expect(result.usedMessages).toBe(1500);
    expect(result.totalMessages).toBe(10000);
    expect(result.updatedAt).toBeInstanceOf(Date);
  });

  it('réutilise le quota en cache si le délai est inférieur au TTL (15 min)', async () => {
    const cachedDate = new Date(Date.now() - 5 * 60 * 1000); // il y a 5 min
    const account = makeAccount({
      storageQuota: {
        supported: true,
        usedBytes: 500000,
        totalBytes: 1000000,
        percentage: 50,
        updatedAt: cachedDate,
      },
    });

    const result = await getAccountQuota(account, false);

    expect(result.usedBytes).toBe(500000);
    expect(result.totalBytes).toBe(1000000);
    expect(imapPool.acquire).not.toHaveBeenCalled();
    expect(mockClient.getQuota).not.toHaveBeenCalled();
  });

  it('force le rafraîchissement si forceRefresh est true même avec un cache frais', async () => {
    const cachedDate = new Date(Date.now() - 2 * 60 * 1000);
    const account = makeAccount({
      storageQuota: {
        supported: true,
        usedBytes: 500000,
        totalBytes: 1000000,
        percentage: 50,
        updatedAt: cachedDate,
      },
    });

    mockClient.getQuota.mockResolvedValueOnce({
      path: 'INBOX',
      storage: {
        used: 600000,
        limit: 1000000,
      },
    });

    const result = await getAccountQuota(account, true);

    expect(imapPool.acquire).toHaveBeenCalled();
    expect(result.usedBytes).toBe(600000);
    expect(result.percentage).toBe(60);
  });

  it('gère correctement un serveur ne supportant pas l extension QUOTA (retour false)', async () => {
    mockClient.getQuota.mockResolvedValueOnce(false);

    const account = makeAccount();
    const result = await getAccountQuota(account);

    expect(result.supported).toBe(false);
    expect(result.usedBytes).toBeUndefined();
    expect(imapPool.release).toHaveBeenCalledWith(String(account._id));
  });

  it('libère la connexion et retombe sur le cache en cas d erreur réseau', async () => {
    const cachedDate = new Date(Date.now() - (QUOTA_CACHE_TTL_MS + 1000));
    const account = makeAccount({
      storageQuota: {
        supported: true,
        usedBytes: 300000,
        totalBytes: 1000000,
        percentage: 30,
        updatedAt: cachedDate,
      },
    });

    mockClient.getQuota.mockRejectedValueOnce(new Error('Socket timeout'));

    const result = await getAccountQuota(account, true);

    expect(imapPool.release).toHaveBeenCalledWith(String(account._id));
    expect(result.usedBytes).toBe(300000);
    expect(result.percentage).toBe(30);
  });
});
