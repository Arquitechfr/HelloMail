import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IAccountDocument } from '../../models/Account.js';

// Mock de listFolders (utilisé par specialFolders).
const mockListFolders = vi.fn();

vi.mock('./folderService.js', () => ({
  listFolders: mockListFolders,
}));

const {
  findSpecialFolder,
  findSentFolder,
  findTrashFolder,
  findDraftsFolder,
  findJunkFolder,
  findArchiveFolder,
  invalidateSpecialFolderCache,
  clearAllSpecialFolderCaches,
} = await import('./specialFolders.js');

function makeAccount(id = '507f1f77bcf86cd799439011'): IAccountDocument {
  return { _id: id } as unknown as IAccountDocument;
}

function makeFolder(path: string, specialUse?: string) {
  return {
    path,
    name: path,
    delimiter: '/',
    specialUse,
    flags: [],
    status: undefined,
  };
}

describe('specialFolders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAllSpecialFolderCaches();
  });

  afterEach(() => {
    clearAllSpecialFolderCaches();
  });

  describe('findSpecialFolder — détection par flag specialUse', () => {
    it('trouve le dossier par flag \\Sent', async () => {
      mockListFolders.mockResolvedValueOnce([
        makeFolder('INBOX', '\\Inbox'),
        makeFolder('Mes messages envoyés', '\\Sent'),
      ]);

      const result = await findSentFolder(makeAccount());

      expect(result).toBe('Mes messages envoyés');
    });

    it('trouve le dossier par flag \\Trash', async () => {
      mockListFolders.mockResolvedValueOnce([
        makeFolder('INBOX', '\\Inbox'),
        makeFolder('Corbeille', '\\Trash'),
      ]);

      const result = await findTrashFolder(makeAccount());

      expect(result).toBe('Corbeille');
    });

    it('trouve le dossier par flag \\Junk', async () => {
      mockListFolders.mockResolvedValueOnce([
        makeFolder('INBOX', '\\Inbox'),
        makeFolder('Spam', '\\Junk'),
      ]);

      const result = await findJunkFolder(makeAccount());

      expect(result).toBe('Spam');
    });

    it('trouve le dossier par flag \\Drafts', async () => {
      mockListFolders.mockResolvedValueOnce([
        makeFolder('Brouillons', '\\Drafts'),
      ]);

      const result = await findDraftsFolder(makeAccount());

      expect(result).toBe('Brouillons');
    });

    it('trouve le dossier par flag \\Archive', async () => {
      mockListFolders.mockResolvedValueOnce([
        makeFolder('Archives', '\\Archive'),
      ]);

      const result = await findArchiveFolder(makeAccount());

      expect(result).toBe('Archives');
    });
  });

  describe('findSpecialFolder — fallbacks par nom', () => {
    it('fallback "Sent" si pas de flag \\Sent', async () => {
      mockListFolders.mockResolvedValueOnce([
        makeFolder('INBOX', '\\Inbox'),
        makeFolder('Sent'),
      ]);

      const result = await findSentFolder(makeAccount());

      expect(result).toBe('Sent');
    });

    it('fallback "Sent Items" (insensible à la casse)', async () => {
      mockListFolders.mockResolvedValueOnce([
        makeFolder('SENT ITEMS'),
      ]);

      const result = await findSentFolder(makeAccount());

      expect(result).toBe('SENT ITEMS');
    });

    it('fallback "Envoyés" pour les comptes français', async () => {
      mockListFolders.mockResolvedValueOnce([
        makeFolder('Envoyés'),
      ]);

      const result = await findSentFolder(makeAccount());

      expect(result).toBe('Envoyés');
    });

    it('fallback "Trash" si pas de flag \\Trash', async () => {
      mockListFolders.mockResolvedValueOnce([
        makeFolder('Trash'),
      ]);

      const result = await findTrashFolder(makeAccount());

      expect(result).toBe('Trash');
    });

    it('fallback "Corbeille" pour les comptes français', async () => {
      mockListFolders.mockResolvedValueOnce([
        makeFolder('Corbeille'),
      ]);

      const result = await findTrashFolder(makeAccount());

      expect(result).toBe('Corbeille');
    });

    it('fallback "Junk" si pas de flag \\Junk', async () => {
      mockListFolders.mockResolvedValueOnce([
        makeFolder('Junk'),
      ]);

      const result = await findJunkFolder(makeAccount());

      expect(result).toBe('Junk');
    });

    it('fallback "Spam" pour \\Junk', async () => {
      mockListFolders.mockResolvedValueOnce([
        makeFolder('Spam'),
      ]);

      const result = await findJunkFolder(makeAccount());

      expect(result).toBe('Spam');
    });

    it('retourne null si aucun dossier correspondant', async () => {
      mockListFolders.mockResolvedValueOnce([
        makeFolder('INBOX', '\\Inbox'),
        makeFolder('Random'),
      ]);

      const result = await findSentFolder(makeAccount());

      expect(result).toBeNull();
    });
  });

  describe('cache par compte', () => {
    it('met en cache le résultat et ne rappelle pas listFolders', async () => {
      mockListFolders.mockResolvedValueOnce([
        makeFolder('Sent', '\\Sent'),
      ]);

      const result1 = await findSentFolder(makeAccount());
      const result2 = await findSentFolder(makeAccount());

      expect(result1).toBe('Sent');
      expect(result2).toBe('Sent');
      // listFolders n'est appelé qu'une seule fois grâce au cache.
      expect(mockListFolders).toHaveBeenCalledTimes(1);
    });

    it('cache séparé par compte', async () => {
      mockListFolders
        .mockResolvedValueOnce([makeFolder('Sent1', '\\Sent')])
        .mockResolvedValueOnce([makeFolder('Sent2', '\\Sent')]);

      const result1 = await findSentFolder(makeAccount('acc1'));
      const result2 = await findSentFolder(makeAccount('acc2'));

      expect(result1).toBe('Sent1');
      expect(result2).toBe('Sent2');
      expect(mockListFolders).toHaveBeenCalledTimes(2);
    });

    it('invalidateSpecialFolderCache force une nouvelle résolution', async () => {
      mockListFolders
        .mockResolvedValueOnce([makeFolder('OldSent', '\\Sent')])
        .mockResolvedValueOnce([makeFolder('NewSent', '\\Sent')]);

      const accountId = 'acc-invalidate';
      const account = makeAccount(accountId);

      const result1 = await findSentFolder(account);
      expect(result1).toBe('OldSent');

      invalidateSpecialFolderCache(accountId);

      const result2 = await findSentFolder(account);
      expect(result2).toBe('NewSent');
      expect(mockListFolders).toHaveBeenCalledTimes(2);
    });

    it('plusieurs specialUse résolus avec un seul appel listFolders', async () => {
      // Utilise mockResolvedValue (pas Once) car le cache peut déclencher
      // plusieurs appels si les Promise sont lancés en parallèle.
      mockListFolders.mockResolvedValue([
        makeFolder('Sent', '\\Sent'),
        makeFolder('Trash', '\\Trash'),
        makeFolder('Junk', '\\Junk'),
      ]);

      const account = makeAccount();

      const sent = await findSentFolder(account);
      const trash = await findTrashFolder(account);
      const junk = await findJunkFolder(account);

      expect(sent).toBe('Sent');
      expect(trash).toBe('Trash');
      expect(junk).toBe('Junk');
      // Un seul appel listFolders grâce au cache (les appels sont séquentiels).
      expect(mockListFolders).toHaveBeenCalledTimes(1);
    });
  });

  describe('findSpecialFolder — specialUse inconnu', () => {
    it('retourne null pour un specialUse non listé dans les fallbacks', async () => {
      mockListFolders.mockResolvedValueOnce([
        makeFolder('INBOX', '\\Inbox'),
      ]);

      const result = await findSpecialFolder(makeAccount(), '\\UnknownFlag');

      expect(result).toBeNull();
    });
  });
});
