import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '../../utils/AppError.js';

const mockAcquire = vi.fn();
const mockRelease = vi.fn();
vi.mock('./imapPool.js', () => ({
  imapPool: {
    acquire: (...args: unknown[]) => mockAcquire(...args),
    release: (...args: unknown[]) => mockRelease(...args),
  },
}));

const mockFindOne = vi.fn();
const mockUpdateOne = vi.fn().mockResolvedValue({ modifiedCount: 1 });
vi.mock('../../models/Account.js', () => ({
  AccountModel: {
    findOne: (...args: unknown[]) => mockFindOne(...args),
    updateOne: (...args: unknown[]) => mockUpdateOne(...args),
  },
}));

const mockRunInitialSyncForFolder = vi.fn();
const mockRunInitialSyncAll = vi.fn();
vi.mock('../sync/initialSync.js', () => ({
  runInitialSyncForFolder: (...args: unknown[]) => mockRunInitialSyncForFolder(...args),
  runInitialSyncAll: (...args: unknown[]) => mockRunInitialSyncAll(...args),
}));

const mockReconcileFolder = vi.fn();
vi.mock('../sync/reconcileFolder.js', () => ({
  reconcileFolder: (...args: unknown[]) => mockReconcileFolder(...args),
}));

const mockReconcileAllFolders = vi.fn();
vi.mock('../sync/reconcileAllFolders.js', () => ({
  reconcileAllFolders: (...args: unknown[]) => mockReconcileAllFolders(...args),
}));

const mockSyncFolderCacheFromClient = vi.fn().mockResolvedValue(undefined);
const mockResolveCanonicalFolder = vi.fn().mockImplementation((_acc, f) => Promise.resolve(f));
vi.mock('./folderService.js', () => ({
  syncFolderCacheFromClient: (...args: unknown[]) => mockSyncFolderCacheFromClient(...args),
  resolveCanonicalFolder: (...args: unknown[]) => mockResolveCanonicalFolder(...args),
}));

const mockPublishEvent = vi.fn().mockResolvedValue(undefined);
vi.mock('../realtime/eventPublisher.js', () => ({
  publishEvent: (...args: unknown[]) => mockPublishEvent(...args),
}));

vi.mock('../../config/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const { syncAccountOnDemand } = await import('./onDemandSyncService.js');

describe('onDemandSyncService', () => {
  const accountId = '507f1f77bcf86cd799439011';
  const userId = '507f1f77bcf86cd799439012';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lance une 404 si le compte n\'existe pas', async () => {
    mockFindOne.mockResolvedValue(null);

    await expect(syncAccountOnDemand(accountId, userId)).rejects.toThrow(AppError);
    expect(mockAcquire).not.toHaveBeenCalled();
  });

  it('lance une 400 si le compte est inactif', async () => {
    mockFindOne.mockResolvedValue({ _id: accountId, userId, isActive: false });

    await expect(syncAccountOnDemand(accountId, userId)).rejects.toThrow(
      'Ce compte est désactivé',
    );
    expect(mockAcquire).not.toHaveBeenCalled();
  });

  it('synchronise un dossier spécifique et publie un événement si nouveaux messages', async () => {
    const fakeAccount = { _id: accountId, userId, isActive: true };
    mockFindOne.mockResolvedValue(fakeAccount);
    const mockClient = { usable: true };
    mockAcquire.mockResolvedValue(mockClient);
    mockRunInitialSyncForFolder.mockResolvedValue(3);
    mockReconcileFolder.mockResolvedValue(0);

    const result = await syncAccountOnDemand(accountId, userId, 'INBOX');

    expect(result.success).toBe(true);
    expect(result.syncedCount).toBe(3);
    expect(result.deletedCount).toBe(0);
    expect(result.folder).toBe('INBOX');
    expect(mockRunInitialSyncForFolder).toHaveBeenCalledWith(mockClient, accountId, 'INBOX', userId);
    expect(mockReconcileFolder).toHaveBeenCalledWith(mockClient, accountId, 'INBOX');
    expect(mockPublishEvent).toHaveBeenCalledWith({
      type: 'message:new',
      accountId,
      userId,
      payload: { folder: 'INBOX' },
    });
    expect(mockRelease).toHaveBeenCalledWith(accountId);
    expect(mockUpdateOne).toHaveBeenCalled();
  });

  it('synchronise tous les dossiers quand aucun dossier n\'est précisé', async () => {
    const fakeAccount = { _id: accountId, userId, isActive: true };
    mockFindOne.mockResolvedValue(fakeAccount);
    const mockClient = { usable: true };
    mockAcquire.mockResolvedValue(mockClient);
    mockRunInitialSyncAll.mockResolvedValue(5);
    mockReconcileAllFolders.mockResolvedValue(1);

    const result = await syncAccountOnDemand(accountId, userId);

    expect(result.success).toBe(true);
    expect(result.syncedCount).toBe(5);
    expect(result.deletedCount).toBe(1);
    expect(result.folder).toBe('ALL');
    expect(mockRunInitialSyncAll).toHaveBeenCalledWith(mockClient, accountId, fakeAccount);
    expect(mockReconcileAllFolders).toHaveBeenCalledWith(mockClient, accountId, fakeAccount);
    expect(mockPublishEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'message:new' }),
    );
    expect(mockPublishEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'message:deleted' }),
    );
    expect(mockRelease).toHaveBeenCalledWith(accountId);
  });

  it('libère toujours la connexion IMAP en cas d\'erreur', async () => {
    const fakeAccount = { _id: accountId, userId, isActive: true };
    mockFindOne.mockResolvedValue(fakeAccount);
    mockAcquire.mockResolvedValue({ usable: true });
    mockRunInitialSyncForFolder.mockRejectedValue(new Error('IMAP error'));

    await expect(syncAccountOnDemand(accountId, userId, 'INBOX')).rejects.toThrow('IMAP error');
    expect(mockRelease).toHaveBeenCalledWith(accountId);
  });
});
