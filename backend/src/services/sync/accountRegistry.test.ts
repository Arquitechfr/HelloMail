import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDb, teardownTestDb, clearDb } from '../../test/setup.js';
import { AccountModel } from '../../models/Account.js';

// Mock SyncManager : on vérifie uniquement ce que le registry décide de démarrer.
const { mockStart, mockStop } = vi.hoisted(() => ({
  mockStart: vi.fn().mockResolvedValue(undefined),
  mockStop: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./syncManager.js', () => ({
  SyncManager: vi.fn(function (this: { start: unknown; stop: unknown }) {
    this.start = mockStart;
    this.stop = mockStop;
  }),
}));

import { accountRegistry } from './accountRegistry.js';

describe('accountRegistry', () => {
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

  it('démarre un SyncManager pour les comptes OAuth actifs (pas seulement imap)', async () => {
    // Régression : le registry filtrait provider: 'imap', les comptes
    // google_oauth/microsoft_oauth n'étaient jamais synchronisés.
    const findSpy = vi.spyOn(AccountModel, 'find');

    accountRegistry.start();
    // Laisse le premier cycle de polling s'exécuter.
    await new Promise((resolve) => setTimeout(resolve, 50));
    await accountRegistry.shutdown();

    expect(findSpy).toHaveBeenCalledWith({ isActive: true });
  });

  it('instancie un SyncManager pour un compte google_oauth actif', async () => {
    const { SyncManager } = await import('./syncManager.js');

    await AccountModel.create({
      userId: '507f1f77bcf86cd799439011',
      provider: 'google_oauth',
      emailAddress: 'user@gmail.com',
      imapConfig: { host: 'imap.gmail.com', port: 993, secure: true },
      oauthConfig: {
        encryptedRefreshToken: { iv: 'iv', authTag: 'tag', ciphertext: 'ct' },
        scope: ['https://mail.google.com/'],
      },
      isActive: true,
    });

    accountRegistry.start();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await accountRegistry.shutdown();

    expect(SyncManager).toHaveBeenCalledTimes(1);
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('ignore les comptes inactifs', async () => {
    const { SyncManager } = await import('./syncManager.js');

    await AccountModel.create({
      userId: '507f1f77bcf86cd799439011',
      provider: 'google_oauth',
      emailAddress: 'inactive@gmail.com',
      imapConfig: { host: 'imap.gmail.com', port: 993, secure: true },
      oauthConfig: {
        encryptedRefreshToken: { iv: 'iv', authTag: 'tag', ciphertext: 'ct' },
        scope: [],
      },
      isActive: false,
    });

    accountRegistry.start();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await accountRegistry.shutdown();

    expect(SyncManager).not.toHaveBeenCalled();
  });
});
