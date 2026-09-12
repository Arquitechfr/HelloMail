import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IAccountDocument } from '../../models/Account.js';

// Mock des constantes — intervalle court pour les tests (pas de fake timers).
vi.mock('../../config/constants.js', () => ({
  POLLING_INTERVAL_MS: 10,
  SYNC_BACKOFF_BASE_MS: 1,
  SYNC_BACKOFF_MAX_MS: 10,
  INITIAL_SYNC_MESSAGE_COUNT: 50,
  ACCOUNT_POLL_INTERVAL_MS: 30_000,
  MAX_CONSECUTIVE_SYNC_FAILURES: 10,
  STABLE_CONNECTION_RESET_MS: 180_000,
  IMAP_POOL_IDLE_TTL_MS: 300_000,
  SMTP_TIMEOUT_MS: 30_000,
  SEND_RATE_LIMIT_WINDOW_MS: 60_000,
  SEND_RATE_LIMIT_MAX: 200,
  SEND_MAX_TOTAL_SIZE_BYTES: 25 * 1024 * 1024,
  RATE_LIMIT_AUTH_WINDOW_MS: 900_000,
  RATE_LIMIT_AUTH_MAX: 100,
  RATE_LIMIT_GLOBAL_WINDOW_MS: 900_000,
  RATE_LIMIT_GLOBAL_MAX: 1000,
  COOKIE_REFRESH_TOKEN: 'mailora_refresh',
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN_DAYS: 30,
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

// Mock de encryptionService.
vi.mock('../security/encryptionService.js', () => ({
  decrypt: vi.fn().mockReturnValue('decrypted-password'),
}));

// Mock de oauthService.getImapAuth — les tests utilisent des comptes IMAP.
vi.mock('../auth/oauthService.js', () => ({
  getImapAuth: vi.fn().mockResolvedValue({ user: 'user@test.com', pass: 'decrypted-password' }),
}));

// Mock de initialSync (runInitialSyncForFolder).
const mockRunInitialSyncForFolder = vi.fn();
vi.mock('./initialSync.js', () => ({
  runInitialSyncForFolder: mockRunInitialSyncForFolder,
}));

// Mock de reconcileFolder.
const mockReconcileFolder = vi.fn();
vi.mock('./reconcileFolder.js', () => ({
  reconcileFolder: mockReconcileFolder,
}));

// Mock de eventPublisher.
const mockPublishEvent = vi.fn().mockResolvedValue(undefined);
vi.mock('../realtime/eventPublisher.js', () => ({
  publishEvent: mockPublishEvent,
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

// Mock de ImapFlow (constructable — doit utiliser `function`, pas arrow).
const mockConnect = vi.fn().mockResolvedValue(undefined);
const mockLogout = vi.fn().mockResolvedValue(undefined);
const mockList = vi.fn().mockResolvedValue([]);

vi.mock('imapflow', () => ({
  ImapFlow: vi.fn().mockImplementation(function () {
    return {
      connect: mockConnect,
      logout: mockLogout,
      list: mockList,
    };
  }),
}));

const { startPollingSync } = await import('./pollingSync.js');

function makeAccount(): IAccountDocument {
  return {
    _id: '507f1f77bcf86cd799439011',
    userId: '507f1f77bcf86cd799439012',
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

/** Attend que les microtasks se vident (sans fake timers). */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 5));
}

describe('pollingSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnect.mockResolvedValue(undefined);
    mockLogout.mockResolvedValue(undefined);
    mockRunInitialSyncForFolder.mockResolvedValue(0);
    mockReconcileFolder.mockResolvedValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sync les dossiers spéciaux et publie des événements si changements', async () => {
    mockFindSentFolder.mockResolvedValue('Sent');
    mockFindDraftsFolder.mockResolvedValue('Drafts');
    mockFindTrashFolder.mockResolvedValue(null);
    mockFindJunkFolder.mockResolvedValue(null);
    mockFindArchiveFolder.mockResolvedValue(null);

    // Simule des changements sur Sent (sync) et Drafts (delete).
    mockRunInitialSyncForFolder.mockResolvedValueOnce(3); // Sent
    mockReconcileFolder.mockResolvedValueOnce(1); // Drafts

    const controller = new AbortController();
    const promise = startPollingSync(makeAccount(), controller.signal);

    // Laisse le premier cycle de polling s'exécuter.
    await flush();
    controller.abort();
    await flush();
    await promise;

    // Vérifie que les dossiers spéciaux trouvés ont été pollés.
    expect(mockRunInitialSyncForFolder).toHaveBeenCalledWith(expect.anything(), expect.any(String), 'Sent', expect.any(String));
    expect(mockRunInitialSyncForFolder).toHaveBeenCalledWith(expect.anything(), expect.any(String), 'Drafts', expect.any(String));
    expect(mockRunInitialSyncForFolder).not.toHaveBeenCalledWith(expect.anything(), expect.any(String), 'Trash', expect.anything());

    // Vérifie la publication d'événements (syncedTotal > 0 → message:new).
    expect(mockPublishEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'message:new' }),
    );
    // Vérifie la publication d'événements (deletedTotal > 0 → message:deleted).
    expect(mockPublishEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'message:deleted' }),
    );
  });

  it('continue si un dossier spécial échoue', async () => {
    mockFindSentFolder.mockResolvedValue('Sent');
    mockFindDraftsFolder.mockResolvedValue('Drafts');
    mockFindTrashFolder.mockResolvedValue(null);
    mockFindJunkFolder.mockResolvedValue(null);
    mockFindArchiveFolder.mockResolvedValue(null);

    // Sent réussit, Drafts lève.
    mockRunInitialSyncForFolder
      .mockResolvedValueOnce(0) // Sent
      .mockRejectedValueOnce(new Error('IMAP error')); // Drafts

    const controller = new AbortController();
    const promise = startPollingSync(makeAccount(), controller.signal);

    await flush();
    controller.abort();
    await flush();
    await promise;

    // Les deux dossiers ont été tentés.
    expect(mockRunInitialSyncForFolder).toHaveBeenCalledTimes(2);
  });

  it('ignore les dossiers spéciaux qui résolvent vers INBOX', async () => {
    mockFindSentFolder.mockResolvedValue('INBOX');
    mockFindDraftsFolder.mockResolvedValue(null);
    mockFindTrashFolder.mockResolvedValue(null);
    mockFindJunkFolder.mockResolvedValue(null);
    mockFindArchiveFolder.mockResolvedValue(null);

    const controller = new AbortController();
    const promise = startPollingSync(makeAccount(), controller.signal);

    await flush();
    controller.abort();
    await flush();
    await promise;

    // Aucun dossier pollé (Sent a résolu vers INBOX → skip).
    expect(mockRunInitialSyncForFolder).not.toHaveBeenCalled();
  });

  it('ne publie pas d\'événements si aucun changement', async () => {
    mockFindSentFolder.mockResolvedValue('Sent');
    mockFindDraftsFolder.mockResolvedValue(null);
    mockFindTrashFolder.mockResolvedValue(null);
    mockFindJunkFolder.mockResolvedValue(null);
    mockFindArchiveFolder.mockResolvedValue(null);

    mockRunInitialSyncForFolder.mockResolvedValue(0);
    mockReconcileFolder.mockResolvedValue(0);

    const controller = new AbortController();
    const promise = startPollingSync(makeAccount(), controller.signal);

    await flush();
    controller.abort();
    await flush();
    await promise;

    expect(mockPublishEvent).not.toHaveBeenCalled();
  });

  it('stop proprement sur abort signal', async () => {
    mockFindSentFolder.mockResolvedValue(null);
    mockFindDraftsFolder.mockResolvedValue(null);
    mockFindTrashFolder.mockResolvedValue(null);
    mockFindJunkFolder.mockResolvedValue(null);
    mockFindArchiveFolder.mockResolvedValue(null);

    const controller = new AbortController();
    const promise = startPollingSync(makeAccount(), controller.signal);

    await flush();
    controller.abort();
    await flush();

    // Doit se résoudre sans erreur.
    await expect(promise).resolves.toBeUndefined();
  });

  it('reconnecte après une erreur de connexion', async () => {
    // Premier connect échoue, deuxième réussit.
    mockConnect
      .mockRejectedValueOnce(new Error('Connection refused'))
      .mockResolvedValueOnce(undefined);

    mockFindSentFolder.mockResolvedValue(null);
    mockFindDraftsFolder.mockResolvedValue(null);
    mockFindTrashFolder.mockResolvedValue(null);
    mockFindJunkFolder.mockResolvedValue(null);
    mockFindArchiveFolder.mockResolvedValue(null);

    const controller = new AbortController();
    const promise = startPollingSync(makeAccount(), controller.signal);

    // Attend le backoff (1ms) + reconnexion + flush.
    await new Promise((r) => setTimeout(r, 50));

    controller.abort();
    await flush();
    await promise;

    // Vérifie que connect a été appelé deux fois (1er échec + 2e succès).
    expect(mockConnect).toHaveBeenCalledTimes(2);
  });

  it('polle également les dossiers personnalisés découverts via list()', async () => {
    [mockFindSentFolder, mockFindDraftsFolder, mockFindTrashFolder, mockFindJunkFolder, mockFindArchiveFolder].forEach((f) => f.mockResolvedValue(null));

    mockList.mockResolvedValueOnce([
      { path: 'INBOX', flags: new Set([]) },
      { path: 'Projets', flags: new Set([]) },
      { path: 'NonSelectable', flags: new Set(['\\Noselect']) },
    ]);

    mockRunInitialSyncForFolder.mockResolvedValueOnce(1);

    const controller = new AbortController();
    const promise = startPollingSync(makeAccount(), controller.signal);

    await flush();
    controller.abort();
    await flush();
    await promise;

    expect(mockRunInitialSyncForFolder).toHaveBeenCalledWith(expect.anything(), expect.any(String), 'Projets', expect.any(String));
    expect(mockRunInitialSyncForFolder).not.toHaveBeenCalledWith(expect.anything(), expect.any(String), 'NonSelectable', expect.anything());
  });

  it('exclut la boîte de réception localisée (flag \\Inbox) du polling', async () => {
    [mockFindSentFolder, mockFindDraftsFolder, mockFindTrashFolder, mockFindJunkFolder, mockFindArchiveFolder].forEach((f) => f.mockResolvedValue(null));

    // Zoho liste la boîte de réception sous un nom localisé avec le flag \Inbox.
    mockList.mockResolvedValueOnce([
      { path: 'Boîte de réception', flags: new Set([]), specialUse: '\\Inbox' },
      { path: 'Projets', flags: new Set([]) },
    ]);

    const controller = new AbortController();
    const promise = startPollingSync(makeAccount(), controller.signal);

    await flush();
    controller.abort();
    await flush();
    await promise;

    // « Boîte de réception » est exclue (doublon de l'IDLE INBOX) ; « Projets » est pollé.
    expect(mockRunInitialSyncForFolder).not.toHaveBeenCalledWith(expect.anything(), expect.any(String), 'Boîte de réception', expect.anything());
    expect(mockRunInitialSyncForFolder).toHaveBeenCalledWith(expect.anything(), expect.any(String), 'Projets', expect.any(String));
  });
});
