import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import type { IAccountDocument } from '../../models/Account.js';
import { FolderModel } from '../../models/Folder.js';
import { setupTestDb, teardownTestDb, clearDb } from '../../test/setup.js';

const mockClient = {
  usable: true,
  connect: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn().mockResolvedValue(undefined),
  list: vi.fn(),
  mailboxCreate: vi.fn(),
  mailboxRename: vi.fn(),
  mailboxDelete: vi.fn(),
  status: vi.fn(),
};

vi.mock('./imapPool.js', () => ({
  imapPool: {
    acquire: vi.fn().mockResolvedValue(mockClient),
    release: vi.fn(),
  },
}));

// Mock de specialFolders (utilisé par folderService pour invalider le cache).
vi.mock('./specialFolders.js', () => ({
  invalidateSpecialFolderCache: vi.fn(),
}));

const {
  listFolders,
  createFolder,
  renameFolder,
  deleteFolder,
  getFolderStatus,
  findSpecialUseFolder,
  folderExists,
  resolveCanonicalFolder,
  folderPathExists,
} = await import('./folderService.js');

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

describe('folderService', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await clearDb();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('listFolders', () => {
    it('retourne la liste des dossiers avec status', async () => {
      mockClient.list.mockResolvedValueOnce([
        {
          path: 'INBOX',
          name: 'INBOX',
          delimiter: '/',
          specialUse: '\\Inbox',
          flags: new Set(['\\HasNoChildren']),
          status: { messages: 42, unseen: 5, uidNext: 100 },
        },
        {
          path: 'Sent',
          name: 'Sent',
          delimiter: '/',
          specialUse: '\\Sent',
          flags: new Set(['\\HasNoChildren']),
          status: { messages: 10, unseen: 0, uidNext: 50 },
        },
      ]);

      const result = await listFolders(makeAccount());

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        path: 'INBOX',
        name: 'INBOX',
        delimiter: '/',
        specialUse: '\\Inbox',
        flags: ['\\HasNoChildren'],
        status: { messages: 42, unseen: 5, uidNext: 100 },
      });
      expect(result[1].path).toBe('Sent');
    });

    it('gère les dossiers sans status', async () => {
      mockClient.list.mockResolvedValueOnce([
        {
          path: 'Drafts',
          name: 'Drafts',
          delimiter: '/',
          flags: new Set(),
          status: undefined,
        },
      ]);

      const result = await listFolders(makeAccount());

      expect(result[0].status).toBeUndefined();
    });
  });

  describe('createFolder', () => {
    it('crée un dossier avec succès', async () => {
      mockClient.mailboxCreate.mockResolvedValueOnce({ path: 'NewFolder' });

      await createFolder(makeAccount(), 'NewFolder');

      expect(mockClient.mailboxCreate).toHaveBeenCalledWith('NewFolder');
    });

    it('lance 409 si le dossier existe déjà', async () => {
      mockClient.mailboxCreate.mockRejectedValueOnce(new Error('Mailbox already exists'));

      await expect(createFolder(makeAccount(), 'Existing')).rejects.toThrow('Ce dossier existe déjà');
    });

    it('lance 422 pour une autre erreur', async () => {
      mockClient.mailboxCreate.mockRejectedValueOnce(new Error('Permission denied'));

      await expect(createFolder(makeAccount(), 'X')).rejects.toThrow('Création du dossier échouée');
    });
  });

  describe('renameFolder', () => {
    it('renomme un dossier avec succès', async () => {
      mockClient.mailboxRename.mockResolvedValueOnce({ path: 'NewName' });

      await renameFolder(makeAccount(), 'OldName', 'NewName');

      expect(mockClient.mailboxRename).toHaveBeenCalledWith('OldName', 'NewName');
    });

    it('lance 403 si le dossier source est un dossier système protégé', async () => {
      await expect(renameFolder(makeAccount(), 'INBOX', 'NewInbox')).rejects.toThrow(
        'Le dossier système « INBOX » est protégé et ne peut pas être renommé',
      );
      await expect(renameFolder(makeAccount(), 'Sent', 'NewSent')).rejects.toThrow(
        'Le dossier système « Sent » est protégé et ne peut pas être renommé',
      );
    });

    it('lance 403 si le nouveau nom est un nom de dossier système protégé', async () => {
      await expect(renameFolder(makeAccount(), 'MyFolder', 'INBOX')).rejects.toThrow(
        'Impossible de renommer vers un nom de dossier système protégé',
      );
    });

    it('lance 404 si le dossier est introuvable', async () => {
      mockClient.mailboxRename.mockRejectedValueOnce(new Error('Mailbox not found'));

      await expect(renameFolder(makeAccount(), 'X', 'Y')).rejects.toThrow('Dossier introuvable');
    });
  });

  describe('deleteFolder', () => {
    it('supprime un dossier personnalisé avec succès', async () => {
      mockClient.mailboxDelete.mockResolvedValueOnce({ path: 'CustomFolder' });

      await deleteFolder(makeAccount(), 'CustomFolder');

      expect(mockClient.mailboxDelete).toHaveBeenCalledWith('CustomFolder');
    });

    it('lance 403 si le dossier à supprimer est un dossier système protégé', async () => {
      await expect(deleteFolder(makeAccount(), 'INBOX')).rejects.toThrow(
        'Le dossier système « INBOX » est protégé et ne peut pas être supprimé',
      );
      await expect(deleteFolder(makeAccount(), 'Trash')).rejects.toThrow(
        'Le dossier système « Trash » est protégé et ne peut pas être supprimé',
      );
      await expect(deleteFolder(makeAccount(), 'Corbeille')).rejects.toThrow(
        'Le dossier système « Corbeille » est protégé et ne peut pas être supprimé',
      );
    });

    it('lance 404 si le dossier est introuvable', async () => {
      mockClient.mailboxDelete.mockRejectedValueOnce(new Error('Mailbox not found'));

      await expect(deleteFolder(makeAccount(), 'X')).rejects.toThrow('Dossier introuvable');
    });
  });


  describe('getFolderStatus', () => {
    it('retourne les compteurs d\'un dossier', async () => {
      mockClient.status.mockResolvedValueOnce({
        path: 'INBOX',
        messages: 42,
        unseen: 5,
        uidNext: 100,
      });

      const result = await getFolderStatus(makeAccount(), 'INBOX');

      expect(result).toEqual({ messages: 42, unseen: 5, uidNext: 100 });
    });
  });

  describe('findSpecialUseFolder', () => {
    it('trouve le dossier Trash par specialUse', async () => {
      mockClient.list.mockResolvedValueOnce([
        {
          path: 'INBOX',
          name: 'INBOX',
          delimiter: '/',
          specialUse: '\\Inbox',
          flags: new Set(),
        },
        {
          path: 'Corbeille',
          name: 'Corbeille',
          delimiter: '/',
          specialUse: '\\Trash',
          flags: new Set(),
        },
      ]);

      const result = await findSpecialUseFolder(makeAccount(), '\\Trash');

      expect(result).toBe('Corbeille');
    });

    it('retourne null si le dossier n\'existe pas', async () => {
      mockClient.list.mockResolvedValueOnce([
        {
          path: 'INBOX',
          name: 'INBOX',
          delimiter: '/',
          specialUse: '\\Inbox',
          flags: new Set(),
        },
      ]);

      const result = await findSpecialUseFolder(makeAccount(), '\\Trash');

      expect(result).toBeNull();
    });
  });

  describe('gestion des erreurs', () => {
    it('renameFolder lance 422 pour une erreur non-404', async () => {
      mockClient.mailboxRename.mockRejectedValueOnce(new Error('Permission denied'));

      await expect(renameFolder(makeAccount(), 'X', 'Y')).rejects.toThrow('Renommage du dossier échoué');
    });

    it('deleteFolder lance 422 pour une erreur non-404', async () => {
      mockClient.mailboxDelete.mockRejectedValueOnce(new Error('Permission denied'));

      await expect(deleteFolder(makeAccount(), 'X')).rejects.toThrow('Suppression du dossier échouée');
    });

    it('renameFolder gère "n\'existe pas" comme 404', async () => {
      mockClient.mailboxRename.mockRejectedValueOnce(new Error('Le dossier n\'existe pas'));

      await expect(renameFolder(makeAccount(), 'X', 'Y')).rejects.toThrow('Dossier introuvable');
    });

    it('deleteFolder gère "n\'existe pas" comme 404', async () => {
      mockClient.mailboxDelete.mockRejectedValueOnce(new Error('Le dossier n\'existe pas'));

      await expect(deleteFolder(makeAccount(), 'X')).rejects.toThrow('Dossier introuvable');
    });
  });

  describe('folderExists', () => {
    it('retourne true pour INBOX même si le cache liste un nom localisé (Zoho)', async () => {
      const account = makeAccount();
      await FolderModel.create({
        accountId: account._id,
        path: 'Boîte de réception',
        name: 'Boîte de réception',
        specialUse: '\\Inbox',
        syncedAt: new Date(),
      });

      expect(await folderExists(account, 'INBOX')).toBe(true);
      expect(await folderExists(account, 'inbox')).toBe(true);
      expect(await folderExists(account, 'Boîte de réception')).toBe(true);
    });

    it('retourne false pour un dossier inconnu quand le cache est peuplé', async () => {
      const account = makeAccount();
      await FolderModel.create({
        accountId: account._id,
        path: 'INBOX',
        name: 'INBOX',
        specialUse: '\\Inbox',
        syncedAt: new Date(),
      });

      expect(await folderExists(account, 'DossierInexistant')).toBe(false);
    });
  });

  describe('resolveCanonicalFolder', () => {
    it('canonicalise un inbox localisé (flag \\Inbox) vers INBOX', async () => {
      const account = makeAccount();
      await FolderModel.create({
        accountId: account._id,
        path: 'Boîte de réception',
        name: 'Boîte de réception',
        specialUse: '\\Inbox',
        syncedAt: new Date(),
      });

      expect(await resolveCanonicalFolder(String(account._id), 'Boîte de réception')).toBe('INBOX');
      expect(await resolveCanonicalFolder(String(account._id), 'INBOX')).toBe('INBOX');
      expect(await resolveCanonicalFolder(String(account._id), 'inbox')).toBe('INBOX');
    });

    it('laisse les autres dossiers inchangés', async () => {
      const account = makeAccount();
      await FolderModel.create({
        accountId: account._id,
        path: 'Envoyé',
        name: 'Envoyé',
        specialUse: '\\Sent',
        syncedAt: new Date(),
      });

      expect(await resolveCanonicalFolder(String(account._id), 'Envoyé')).toBe('Envoyé');
      expect(await resolveCanonicalFolder(String(account._id), 'Projets')).toBe('Projets');
    });
  });

  describe('folderPathExists', () => {
    it('détecte un vrai dossier nommé Snoozed (collision dossier virtuel)', async () => {
      const account = makeAccount();
      await FolderModel.create({
        accountId: account._id,
        path: 'Snoozed',
        name: 'Snoozed',
        syncedAt: new Date(),
      });

      expect(await folderPathExists(String(account._id), 'Snoozed')).toBe(true);
      expect(await folderPathExists(String(account._id), 'Inexistant')).toBe(false);
    });
  });

  describe('protection des dossiers système localisés', () => {
    it('interdit de renommer un dossier avec specialUse \\Inbox même si le nom est localisé', async () => {
      const account = makeAccount();
      await FolderModel.create({
        accountId: account._id,
        path: 'Boîte de réception',
        name: 'Boîte de réception',
        specialUse: '\\Inbox',
        syncedAt: new Date(),
      });

      await expect(renameFolder(account, 'Boîte de réception', 'X')).rejects.toThrow(
        'est protégé et ne peut pas être renommé',
      );
      expect(mockClient.mailboxRename).not.toHaveBeenCalled();
    });

    it('interdit de supprimer un dossier avec specialUse \\Trash localisé', async () => {
      const account = makeAccount();
      await FolderModel.create({
        accountId: account._id,
        path: 'Poubelle',
        name: 'Poubelle',
        specialUse: '\\Trash',
        syncedAt: new Date(),
      });

      await expect(deleteFolder(account, 'Poubelle')).rejects.toThrow(
        'est protégé et ne peut pas être supprimé',
      );
      expect(mockClient.mailboxDelete).not.toHaveBeenCalled();
    });
  });
});
