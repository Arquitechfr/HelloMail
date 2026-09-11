import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IAccountDocument } from '../../models/Account.js';

/** Chaîne de requête Mongoose simulée : .select().lean() → valeur. */
function chainable(value: unknown) {
  return {
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(value),
    }),
  };
}

const mockClient = {
  usable: true,
  connect: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn().mockResolvedValue(undefined),
  mailboxOpen: vi.fn().mockResolvedValue({ exists: 1 }),
  mailboxCreate: vi.fn().mockResolvedValue({ path: 'Trash' }),
  messageFlagsAdd: vi.fn().mockResolvedValue(true),
  messageFlagsRemove: vi.fn().mockResolvedValue(true),
  messageDelete: vi.fn().mockResolvedValue(true),
  messageMove: vi.fn().mockResolvedValue(true),
  messageCopy: vi.fn().mockResolvedValue({ uidMap: new Map([[100, 55]]) }),
  fetch: vi.fn().mockImplementation(() => (async function* () {})()),
};

// Mock du pool IMAP.
vi.mock('./imapPool.js', () => ({
  imapPool: {
    acquire: vi.fn().mockResolvedValue(mockClient),
    release: vi.fn(),
  },
}));

// Mock de specialFolders (findTrashFolder, findJunkFolder).
const mockFindTrashFolder = vi.fn().mockResolvedValue('Trash');
const mockFindJunkFolder = vi.fn().mockResolvedValue('Junk');

vi.mock('./specialFolders.js', () => ({
  findTrashFolder: mockFindTrashFolder,
  findJunkFolder: mockFindJunkFolder,
  invalidateSpecialFolderCache: vi.fn(),
}));

// Mock de folderService (invalidateFolderCache appelé si création de Trash).
vi.mock('./folderService.js', () => ({
  invalidateFolderCache: vi.fn().mockResolvedValue(undefined),
}));

// Mock de folderCounters (assert via spy).
const mockAdjustFolderCounters = vi.fn().mockResolvedValue(undefined);
vi.mock('./folderCounters.js', () => ({
  adjustFolderCounters: mockAdjustFolderCounters,
  setFolderCounts: vi.fn().mockResolvedValue(undefined),
}));

// Mock de l'eventPublisher (SSE).
const mockPublishEvent = vi.fn().mockResolvedValue(undefined);
vi.mock('../realtime/eventPublisher.js', () => ({
  publishEvent: mockPublishEvent,
}));

// Mock de MessageModel.
const mockUpdateOne = vi.fn().mockResolvedValue({ modifiedCount: 1 });
const mockDeleteOne = vi.fn().mockResolvedValue({ deletedCount: 1 });
const mockUpdateMany = vi.fn().mockResolvedValue({ modifiedCount: 1 });
const mockDeleteMany = vi.fn().mockResolvedValue({ deletedCount: 1 });
const mockFind = vi.fn().mockImplementation(() => chainable([]));
const mockFindOne = vi.fn().mockImplementation(() => chainable(null));

vi.mock('../../models/Message.js', () => ({
  MessageModel: {
    updateOne: mockUpdateOne,
    deleteOne: mockDeleteOne,
    updateMany: mockUpdateMany,
    deleteMany: mockDeleteMany,
    find: mockFind,
    findOne: mockFindOne,
  },
}));

vi.mock('../../models/MessageBody.js', () => ({
  MessageBodyModel: {
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 0 }),
    updateOne: vi.fn().mockResolvedValue({ modifiedCount: 0 }),
  },
}));

const { updateFlags, deleteMessage, moveMessage, markMessageAsJunk, batchAction } = await import('./messageActionService.js');

function makeAccount(): IAccountDocument {
  return {
    _id: '507f1f77bcf86cd799439011',
    userId: '507f1f77bcf86cd799439012',
    imapConfig: {
      host: 'imap.test.com', port: 993, secure: true,
      smtpHost: 'smtp.test.com', smtpPort: 465, smtpSecure: true,
      username: 'user@test.com',
      encryptedPassword: { iv: 'aa', authTag: 'bb', ciphertext: 'cc' },
    },
  } as unknown as IAccountDocument;
}

/** Document local minimal utilisé par les tests de relocalisation. */
function localDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'doc-objectid-1',
    uid: 100,
    messageId: '<msg-1@test.com>',
    flags: { seen: false, flagged: false, answered: false },
    ...overrides,
  };
}

describe('messageActionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFind.mockImplementation(() => chainable([]));
    mockFindOne.mockImplementation(() => chainable(null));
    mockFindTrashFolder.mockResolvedValue('Trash');
    mockFindJunkFolder.mockResolvedValue('Junk');
    mockClient.messageMove.mockResolvedValue(true);
    mockClient.messageDelete.mockResolvedValue(true);
    mockClient.fetch.mockImplementation(() => (async function* () {})());
    delete (mockClient as Record<string, unknown>).capabilities;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('updateFlags', () => {
    it('marque comme lu (seen=true)', async () => {
      await updateFlags(makeAccount(), 'INBOX', 100, { seen: true });

      expect(mockClient.messageFlagsAdd).toHaveBeenCalledWith(100, ['\\Seen'], { uid: true });
      expect(mockClient.messageFlagsRemove).not.toHaveBeenCalled();
      expect(mockUpdateOne).toHaveBeenCalledWith(
        { accountId: '507f1f77bcf86cd799439011', folder: 'INBOX', uid: 100 },
        { $set: { 'flags.seen': true } },
      );
    });

    it('marque comme non-lu (seen=false)', async () => {
      await updateFlags(makeAccount(), 'INBOX', 100, { seen: false });

      expect(mockClient.messageFlagsRemove).toHaveBeenCalledWith(100, ['\\Seen'], { uid: true });
      expect(mockClient.messageFlagsAdd).not.toHaveBeenCalled();
    });

    it('marque comme favori (flagged=true)', async () => {
      await updateFlags(makeAccount(), 'INBOX', 100, { flagged: true });

      expect(mockClient.messageFlagsAdd).toHaveBeenCalledWith(100, ['\\Flagged'], { uid: true });
    });

    it('met à jour plusieurs flags simultanément', async () => {
      await updateFlags(makeAccount(), 'INBOX', 100, { seen: true, flagged: true });

      expect(mockClient.messageFlagsAdd).toHaveBeenCalledWith(100, ['\\Seen'], { uid: true });
      expect(mockClient.messageFlagsAdd).toHaveBeenCalledWith(100, ['\\Flagged'], { uid: true });
    });

    it('ouvre le dossier en read-write', async () => {
      await updateFlags(makeAccount(), 'INBOX', 100, { seen: true });

      expect(mockClient.mailboxOpen).toHaveBeenCalledWith('INBOX', { readOnly: false });
    });

    it('ajuste le compteur unseen quand le flag seen bascule', async () => {
      mockFindOne.mockImplementation(() => chainable({ flags: { seen: false } }));

      await updateFlags(makeAccount(), 'INBOX', 100, { seen: true });

      expect(mockAdjustFolderCounters).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        'INBOX',
        { unseenDelta: -1 },
      );
    });

    it('n\'ajuste pas le compteur si le flag seen ne change pas', async () => {
      mockFindOne.mockImplementation(() => chainable({ flags: { seen: true } }));

      await updateFlags(makeAccount(), 'INBOX', 100, { seen: true });

      expect(mockAdjustFolderCounters).not.toHaveBeenCalled();
    });
  });

  describe('deleteMessage', () => {
    it('déplace vers Trash par défaut', async () => {
      await deleteMessage(makeAccount(), 'INBOX', 100);

      expect(mockClient.messageMove).toHaveBeenCalledWith(100, 'Trash', { uid: true });
      expect(mockClient.messageDelete).not.toHaveBeenCalled();
    });

    it('relocalise le doc local vers Trash quand uidMap est présent', async () => {
      mockFind.mockImplementation(() => chainable([localDoc()]));
      mockClient.messageMove.mockResolvedValueOnce({ uidMap: new Map([[100, 55]]) });

      await deleteMessage(makeAccount(), 'INBOX', 100);

      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: 'doc-objectid-1' },
        { $set: { folder: 'Trash', uid: 55 } },
      );
      expect(mockDeleteOne).not.toHaveBeenCalled();
    });

    it('supprime le doc local si l\'UID destination est inconnu', async () => {
      mockFind.mockImplementation(() => chainable([localDoc()]));
      // uidMap absent + fallback fetch vide → pas de relocalisation possible.
      mockClient.messageMove.mockResolvedValueOnce({});

      await deleteMessage(makeAccount(), 'INBOX', 100);

      expect(mockDeleteOne).toHaveBeenCalledWith({ _id: 'doc-objectid-1' });
    });

    it('ajuste les compteurs des dossiers source et destination', async () => {
      mockFind.mockImplementation(() => chainable([localDoc()]));
      mockClient.messageMove.mockResolvedValueOnce({ uidMap: new Map([[100, 55]]) });

      await deleteMessage(makeAccount(), 'INBOX', 100);

      expect(mockAdjustFolderCounters).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        'INBOX',
        { messagesDelta: -1, unseenDelta: -1 },
      );
      expect(mockAdjustFolderCounters).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        'Trash',
        { messagesDelta: 1, unseenDelta: 1 },
      );
    });

    it('supprime définitivement si permanent=true', async () => {
      await deleteMessage(makeAccount(), 'INBOX', 100, true);

      expect(mockClient.messageDelete).toHaveBeenCalledWith(100, { uid: true });
      expect(mockClient.messageMove).not.toHaveBeenCalled();
      expect(mockDeleteMany).toHaveBeenCalledWith({
        accountId: '507f1f77bcf86cd799439011',
        folder: 'INBOX',
        uid: { $in: [100] },
      });
    });

    it('supprime définitivement quand le message est déjà dans Trash', async () => {
      await deleteMessage(makeAccount(), 'Trash', 100);

      expect(mockClient.messageDelete).toHaveBeenCalledWith(100, { uid: true });
      expect(mockClient.messageMove).not.toHaveBeenCalled();
    });

    it('lance une erreur si le serveur refuse le déplacement (retour false)', async () => {
      mockClient.messageMove.mockResolvedValueOnce(false);

      await expect(
        deleteMessage(makeAccount(), 'INBOX', 100),
      ).rejects.toThrow('le serveur a refusé le déplacement');
      expect(mockDeleteOne).not.toHaveBeenCalled();
      expect(mockDeleteMany).not.toHaveBeenCalled();
    });

    it('crée le dossier Trash s\'il n\'existe pas avant de déplacer', async () => {
      mockFindTrashFolder.mockResolvedValueOnce(null);

      await deleteMessage(makeAccount(), 'INBOX', 100);

      expect(mockClient.mailboxCreate).toHaveBeenCalledWith('Trash');
      expect(mockClient.messageMove).toHaveBeenCalledWith(100, 'Trash', { uid: true });
    });

    it('serveur sans extension MOVE : copy + delete manuel', async () => {
      (mockClient as Record<string, unknown>).capabilities = new Map();

      await deleteMessage(makeAccount(), 'INBOX', 100);

      expect(mockClient.messageCopy).toHaveBeenCalledWith(100, 'Trash', { uid: true });
      expect(mockClient.messageDelete).toHaveBeenCalledWith(100, { uid: true });
      expect(mockClient.messageMove).not.toHaveBeenCalled();
    });

    it('serveur sans MOVE : n\'efface pas si la copie échoue (retour false)', async () => {
      (mockClient as Record<string, unknown>).capabilities = new Map();
      mockClient.messageCopy.mockResolvedValueOnce(false);

      await expect(
        deleteMessage(makeAccount(), 'INBOX', 100),
      ).rejects.toThrow('la copie vers « Trash » a échoué');
      expect(mockClient.messageDelete).not.toHaveBeenCalled();
      expect(mockDeleteOne).not.toHaveBeenCalled();
    });
  });

  describe('moveMessage', () => {
    it('déplace un message vers un autre dossier', async () => {
      mockFind.mockImplementation(() => chainable([localDoc()]));
      mockClient.messageMove.mockResolvedValueOnce({ uidMap: new Map([[100, 77]]) });

      await moveMessage(makeAccount(), 'INBOX', 100, 'Archive');

      expect(mockClient.messageMove).toHaveBeenCalledWith(100, 'Archive', { uid: true });
      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: 'doc-objectid-1' },
        { $set: { folder: 'Archive', uid: 77 } },
      );
    });

    it('no-op si la destination est le dossier courant', async () => {
      await moveMessage(makeAccount(), 'INBOX', 100, 'INBOX');

      expect(mockClient.messageMove).not.toHaveBeenCalled();
    });
  });

  describe('batchAction', () => {
    it('marque plusieurs messages comme lus (markRead)', async () => {
      const result = await batchAction(makeAccount(), 'INBOX', [100, 101, 102], 'markRead');

      expect(result.affected).toBe(3);
      expect(mockClient.messageFlagsAdd).toHaveBeenCalledWith([100, 101, 102], ['\\Seen'], { uid: true });
      expect(mockUpdateMany).toHaveBeenCalled();
    });

    it('marque plusieurs messages comme non-lus (markUnread)', async () => {
      const result = await batchAction(makeAccount(), 'INBOX', [100, 101], 'markUnread');

      expect(result.affected).toBe(2);
      expect(mockClient.messageFlagsRemove).toHaveBeenCalledWith([100, 101], ['\\Seen'], { uid: true });
    });

    it('ajuste le compteur unseen lors d\'un markRead en masse', async () => {
      mockFind.mockImplementation(() => chainable([{ _id: 'a' }, { _id: 'b' }]));

      await batchAction(makeAccount(), 'INBOX', [100, 101], 'markRead');

      expect(mockAdjustFolderCounters).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        'INBOX',
        { unseenDelta: -2 },
      );
    });

    it('marque plusieurs messages comme favoris (flag)', async () => {
      const result = await batchAction(makeAccount(), 'INBOX', [100], 'flag');

      expect(result.affected).toBe(1);
      expect(mockClient.messageFlagsAdd).toHaveBeenCalledWith([100], ['\\Flagged'], { uid: true });
    });

    it('retire le favori de plusieurs messages (unflag)', async () => {
      const result = await batchAction(makeAccount(), 'INBOX', [100, 101], 'unflag');

      expect(result.affected).toBe(2);
      expect(mockClient.messageFlagsRemove).toHaveBeenCalledWith([100, 101], ['\\Flagged'], { uid: true });
    });

    it('supprime plusieurs messages (delete → Trash)', async () => {
      const result = await batchAction(makeAccount(), 'INBOX', [100, 101], 'delete');

      expect(result.affected).toBe(2);
      expect(mockClient.messageMove).toHaveBeenCalledWith([100, 101], 'Trash', { uid: true });
    });

    it('delete depuis Trash supprime définitivement', async () => {
      const result = await batchAction(makeAccount(), 'Trash', [100, 101], 'delete');

      expect(result.affected).toBe(2);
      expect(mockClient.messageDelete).toHaveBeenCalledWith([100, 101], { uid: true });
      expect(mockClient.messageMove).not.toHaveBeenCalled();
    });

    it('relocalise les docs en batch via uidMap', async () => {
      mockFind.mockImplementation(() =>
        chainable([localDoc(), localDoc({ _id: 'doc-objectid-2', uid: 101, messageId: '<m2@t>' })]),
      );
      mockClient.messageMove.mockResolvedValueOnce({ uidMap: new Map([[100, 55], [101, 56]]) });

      await batchAction(makeAccount(), 'INBOX', [100, 101], 'delete');

      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: 'doc-objectid-1' },
        { $set: { folder: 'Trash', uid: 55 } },
      );
      expect(mockUpdateOne).toHaveBeenCalledWith(
        { _id: 'doc-objectid-2' },
        { $set: { folder: 'Trash', uid: 56 } },
      );
    });

    it('déplace plusieurs messages (move)', async () => {
      const result = await batchAction(makeAccount(), 'INBOX', [100, 101], 'move', 'Archive');

      expect(result.affected).toBe(2);
      expect(mockClient.messageMove).toHaveBeenCalledWith([100, 101], 'Archive', { uid: true });
    });

    it('lance une erreur si destination est manquant pour move', async () => {
      await expect(
        batchAction(makeAccount(), 'INBOX', [100], 'move'),
      ).rejects.toThrow('Dossier de destination requis');
    });
  });

  describe('gestion des erreurs IMAP', () => {
    it('updateFlags lance 422 si l\'IMAP échoue', async () => {
      mockClient.messageFlagsAdd.mockRejectedValueOnce(new Error('IMAP error'));

      await expect(
        updateFlags(makeAccount(), 'INBOX', 100, { seen: true }),
      ).rejects.toThrow('Mise à jour des flags échouée');
    });

    it('deleteMessage lance 422 si l\'IMAP échoue', async () => {
      mockClient.messageMove.mockRejectedValueOnce(new Error('IMAP error'));

      await expect(
        deleteMessage(makeAccount(), 'INBOX', 100),
      ).rejects.toThrow('Suppression du message échouée');
    });

    it('moveMessage lance 422 si l\'IMAP échoue', async () => {
      mockClient.messageMove.mockRejectedValueOnce(new Error('IMAP error'));

      await expect(
        moveMessage(makeAccount(), 'INBOX', 100, 'Archive'),
      ).rejects.toThrow('Déplacement du message échoué');
    });

    it('batchAction lance 422 si l\'IMAP échoue', async () => {
      mockClient.messageFlagsAdd.mockRejectedValueOnce(new Error('IMAP error'));

      await expect(
        batchAction(makeAccount(), 'INBOX', [100], 'markRead'),
      ).rejects.toThrow('Action en masse échouée');
    });

    it('updateFlags ne met à jour rien si aucun flag n\'est spécifié', async () => {
      await updateFlags(makeAccount(), 'INBOX', 100, {});

      expect(mockClient.messageFlagsAdd).not.toHaveBeenCalled();
      expect(mockClient.messageFlagsRemove).not.toHaveBeenCalled();
      expect(mockUpdateOne).not.toHaveBeenCalled();
    });

    it('updateFlags gère answered=true et answered=false', async () => {
      await updateFlags(makeAccount(), 'INBOX', 100, { answered: true });
      expect(mockClient.messageFlagsAdd).toHaveBeenCalledWith(100, ['\\Answered'], { uid: true });

      vi.clearAllMocks();
      await updateFlags(makeAccount(), 'INBOX', 100, { answered: false });
      expect(mockClient.messageFlagsRemove).toHaveBeenCalledWith(100, ['\\Answered'], { uid: true });
    });

    it('updateFlags gère flagged=false', async () => {
      await updateFlags(makeAccount(), 'INBOX', 100, { flagged: false });

      expect(mockClient.messageFlagsRemove).toHaveBeenCalledWith(100, ['\\Flagged'], { uid: true });
    });

    it('deleteMessage avec permanent=true supprime définitivement', async () => {
      await deleteMessage(makeAccount(), 'INBOX', 100, true);

      expect(mockClient.messageDelete).toHaveBeenCalledWith(100, { uid: true });
      expect(mockClient.messageMove).not.toHaveBeenCalled();
    });
  });

  describe('markMessageAsJunk', () => {
    it('déplace un message vers le dossier Junk détecté', async () => {
      await markMessageAsJunk(makeAccount(), 'INBOX', 100);

      expect(mockClient.messageMove).toHaveBeenCalledWith(100, 'Junk', { uid: true });
    });

    it('no-op si le message est déjà dans Junk', async () => {
      await markMessageAsJunk(makeAccount(), 'Junk', 100);

      expect(mockClient.messageMove).not.toHaveBeenCalled();
      expect(mockClient.messageDelete).not.toHaveBeenCalled();
    });

    it('utilise "Junk" comme fallback si findJunkFolder retourne null', async () => {
      mockFindJunkFolder.mockResolvedValueOnce(null);

      await markMessageAsJunk(makeAccount(), 'INBOX', 100);

      expect(mockClient.messageMove).toHaveBeenCalledWith(100, 'Junk', { uid: true });
    });

    it('lance 422 si l\'IMAP échoue', async () => {
      mockClient.messageMove.mockRejectedValueOnce(new Error('IMAP error'));

      await expect(
        markMessageAsJunk(makeAccount(), 'INBOX', 100),
      ).rejects.toThrow('Marquage comme spam échoué');
    });
  });

  describe('batchAction — markAsJunk', () => {
    it('déplace plusieurs messages vers Junk', async () => {
      const result = await batchAction(makeAccount(), 'INBOX', [100, 101], 'markAsJunk');

      expect(result.affected).toBe(2);
      expect(mockClient.messageMove).toHaveBeenCalledWith([100, 101], 'Junk', { uid: true });
    });

    it('utilise "Junk" comme fallback si findJunkFolder retourne null', async () => {
      mockFindJunkFolder.mockResolvedValueOnce(null);

      await batchAction(makeAccount(), 'INBOX', [100], 'markAsJunk');

      expect(mockClient.messageMove).toHaveBeenCalledWith([100], 'Junk', { uid: true });
    });
  });
});
