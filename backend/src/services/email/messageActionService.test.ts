import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IAccountDocument } from '../../models/Account.js';

const mockClient = {
  usable: true,
  connect: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn().mockResolvedValue(undefined),
  mailboxOpen: vi.fn().mockResolvedValue({ exists: 1 }),
  messageFlagsAdd: vi.fn().mockResolvedValue(true),
  messageFlagsRemove: vi.fn().mockResolvedValue(true),
  messageDelete: vi.fn().mockResolvedValue(true),
  messageMove: vi.fn().mockResolvedValue(true),
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
}));

// Mock de MessageModel.
const mockUpdateOne = vi.fn().mockResolvedValue({ modifiedCount: 1 });
const mockDeleteOne = vi.fn().mockResolvedValue({ deletedCount: 1 });
const mockUpdateMany = vi.fn().mockResolvedValue({ modifiedCount: 1 });
const mockDeleteMany = vi.fn().mockResolvedValue({ deletedCount: 1 });

vi.mock('../../models/Message.js', () => ({
  MessageModel: {
    updateOne: mockUpdateOne,
    deleteOne: mockDeleteOne,
    updateMany: mockUpdateMany,
    deleteMany: mockDeleteMany,
  },
}));

const { updateFlags, deleteMessage, moveMessage, markMessageAsJunk, batchAction } = await import('./messageActionService.js');

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

describe('messageActionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  describe('deleteMessage', () => {
    it('déplace vers Trash par défaut', async () => {
      await deleteMessage(makeAccount(), 'INBOX', 100);

      expect(mockClient.messageMove).toHaveBeenCalledWith(100, 'Trash', { uid: true });
      expect(mockClient.messageDelete).not.toHaveBeenCalled();
      expect(mockDeleteOne).toHaveBeenCalledWith({
        accountId: '507f1f77bcf86cd799439011',
        folder: 'INBOX',
        uid: 100,
      });
    });

    it('supprime définitivement si permanent=true', async () => {
      await deleteMessage(makeAccount(), 'INBOX', 100, true);

      expect(mockClient.messageDelete).toHaveBeenCalledWith(100, { uid: true });
      expect(mockClient.messageMove).not.toHaveBeenCalled();
    });
  });

  describe('moveMessage', () => {
    it('déplace un message vers un autre dossier', async () => {
      await moveMessage(makeAccount(), 'INBOX', 100, 'Archive');

      expect(mockClient.messageMove).toHaveBeenCalledWith(100, 'Archive', { uid: true });
      expect(mockDeleteOne).toHaveBeenCalledWith({
        accountId: '507f1f77bcf86cd799439011',
        folder: 'INBOX',
        uid: 100,
      });
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
      expect(mockDeleteMany).toHaveBeenCalled();
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
      expect(mockDeleteOne).toHaveBeenCalledWith({
        accountId: '507f1f77bcf86cd799439011',
        folder: 'INBOX',
        uid: 100,
      });
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
      expect(mockDeleteMany).toHaveBeenCalled();
    });

    it('utilise "Junk" comme fallback si findJunkFolder retourne null', async () => {
      mockFindJunkFolder.mockResolvedValueOnce(null);

      await batchAction(makeAccount(), 'INBOX', [100], 'markAsJunk');

      expect(mockClient.messageMove).toHaveBeenCalledWith([100], 'Junk', { uid: true });
    });
  });
});
