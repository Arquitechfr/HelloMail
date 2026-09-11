import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IAccountDocument } from '../../models/Account.js';

const { mockClient } = vi.hoisted(() => ({
  mockClient: {
    append: vi.fn(),
    mailboxOpen: vi.fn().mockResolvedValue(undefined),
    fetchOne: vi.fn(),
  },
}));

vi.mock('./imapPool.js', () => ({
  imapPool: {
    acquire: vi.fn().mockResolvedValue(mockClient),
    release: vi.fn(),
  },
}));

vi.mock('./folderService.js', () => ({
  folderExists: vi.fn(),
  folderPathExists: vi.fn().mockResolvedValue(false),
  VIRTUAL_SNOOZED_FOLDER: '__snoozed__',
}));

vi.mock('../../models/Message.js', () => ({
  MessageModel: {
    updateOne: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../sync/messageMapper.js', () => ({
  mapFetchResultToMessage: vi.fn().mockReturnValue({
    folder: 'INBOX',
    uid: 99,
    subject: 'Imported',
  }),
}));

vi.mock('../realtime/eventPublisher.js', () => ({
  publishEvent: vi.fn(),
}));

const { folderExists } = await import('./folderService.js');
const { MessageModel } = await import('../../models/Message.js');
const { publishEvent } = await import('../realtime/eventPublisher.js');
const { importEml } = await import('./importEmailService.js');

describe('importEmailService', () => {
  const mockAccount = {
    _id: '507f1f77bcf86cd799439011',
    userId: '507f1f77bcf86cd799439012',
    emailAddress: 'user@test.com',
  } as unknown as IAccountDocument;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('importe un email brut avec succès et synchronise MongoDB', async () => {
    vi.mocked(folderExists).mockResolvedValueOnce(true);
    mockClient.append.mockResolvedValueOnce({ uid: 99 });
    mockClient.fetchOne.mockResolvedValueOnce({
      uid: 99,
      envelope: { subject: 'Test' },
    });

    const emlData = 'From: sender@test.com\r\nSubject: Test\r\n\r\nHello World';
    const result = await importEml(mockAccount, 'INBOX', emlData, false);

    expect(result.success).toBe(true);
    expect(result.uid).toBe(99);
    expect(mockClient.append).toHaveBeenCalledWith('INBOX', expect.any(Buffer), ['\\Seen']);
    expect(MessageModel.updateOne).toHaveBeenCalledWith(
      { accountId: '507f1f77bcf86cd799439011', folder: 'INBOX', uid: 99 },
      { $set: expect.objectContaining({ uid: 99 }) },
      { upsert: true },
    );
    expect(publishEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'message:new',
      payload: { folder: 'INBOX', uid: 99 },
    }));
  });

  it('gère le contenu encodé en base64', async () => {
    vi.mocked(folderExists).mockResolvedValueOnce(true);
    mockClient.append.mockResolvedValueOnce({ uid: 100 });
    mockClient.fetchOne.mockResolvedValueOnce({ uid: 100 });

    const base64Content = Buffer.from('From: test@test.com\r\n\r\nBody').toString('base64');
    const result = await importEml(mockAccount, 'Archive', base64Content, true);

    expect(result.success).toBe(true);
    expect(mockClient.append).toHaveBeenCalledWith('Archive', expect.any(Buffer), ['\\Seen']);
  });

  it("rejette si le contenu est vide", async () => {
    await expect(importEml(mockAccount, 'INBOX', '', false)).rejects.toThrow(
      'Le fichier EML fourni est vide',
    );
  });

  it("rejette si le dossier est le dossier virtuel Snoozed", async () => {
    await expect(importEml(mockAccount, 'Snoozed', 'content', false)).rejects.toThrow(
      "Impossible d'importer des messages dans le dossier virtuel En sommeil",
    );
  });

  it("rejette avec AppError 404 si le dossier n'existe pas", async () => {
    vi.mocked(folderExists).mockResolvedValueOnce(false);
    await expect(importEml(mockAccount, 'Inconnu', 'content', false)).rejects.toThrow(
      'Dossier de destination introuvable',
    );
  });

  it("rejette avec AppError 422 si l'append IMAP échoue", async () => {
    vi.mocked(folderExists).mockResolvedValueOnce(true);
    mockClient.append.mockRejectedValueOnce(new Error('IMAP connection closed'));

    await expect(importEml(mockAccount, 'INBOX', 'content', false)).rejects.toThrow(
      "Le serveur IMAP a refusé l'import du message",
    );
  });
});
