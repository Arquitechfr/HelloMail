import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IAccountDocument } from '../../models/Account.js';

// Mock du pool — retourne un client mocké.
const mockClient = {
  usable: true,
  mailboxOpen: vi.fn().mockResolvedValue({ exists: 1 }),
  messageDelete: vi.fn().mockResolvedValue(true),
  append: vi.fn().mockResolvedValue({ uid: 42 }),
  logout: vi.fn().mockResolvedValue(undefined),
  connect: vi.fn().mockResolvedValue(undefined),
};

vi.mock('./imapPool.js', () => ({
  imapPool: {
    acquire: vi.fn().mockResolvedValue(mockClient),
    release: vi.fn(),
  },
}));

vi.mock('./specialFolders.js', () => ({
  findDraftsFolder: vi.fn().mockResolvedValue('Drafts'),
}));

const { saveDraft, deleteDraft } = await import('./draftService.js');

function makeAccount(): IAccountDocument {
  return {
    _id: '507f1f77bcf86cd799439011',
    emailAddress: 'user@test.com',
    imapConfig: {
      host: 'imap.test.com', port: 993, secure: true,
      smtpHost: 'smtp.test.com', smtpPort: 465, smtpSecure: true,
      username: 'user@test.com',
      encryptedPassword: { iv: 'aa', authTag: 'bb', ciphertext: 'cc' },
    },
  } as unknown as IAccountDocument;
}

describe('draftService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('saveDraft', () => {
    it('crée un nouveau brouillon (append uniquement)', async () => {
      const result = await saveDraft(makeAccount(), {
        to: ['bob@test.com'],
        subject: 'Test draft',
        text: 'Hello',
      });

      expect(result.ok).toBe(true);
      expect(result.uid).toBe(42);
      expect(mockClient.append).toHaveBeenCalledWith('Drafts', expect.any(Buffer), ['\\Draft']);
      expect(mockClient.messageDelete).not.toHaveBeenCalled();
    });

    it('crée un brouillon avec pièces jointes (multipart)', async () => {
      const result = await saveDraft(makeAccount(), {
        to: ['bob@test.com'],
        subject: 'Brouillon avec PJ',
        text: 'Voici le fichier joint',
        attachments: [
          {
            filename: 'document.pdf',
            content: Buffer.from('fake pdf content').toString('base64'),
            contentType: 'application/pdf',
          },
        ],
      });

      expect(result.ok).toBe(true);
      expect(mockClient.append).toHaveBeenCalledWith('Drafts', expect.any(Buffer), ['\\Draft']);
      const mimeBuffer = mockClient.append.mock.calls[0][1] as Buffer;
      expect(mimeBuffer.toString()).toContain('document.pdf');
    });

    it('modifie un brouillon existant (delete + append)', async () => {
      const result = await saveDraft(
        makeAccount(),
        { subject: 'Updated', text: 'Updated' },
        100,
      );

      expect(result.ok).toBe(true);
      expect(mockClient.messageDelete).toHaveBeenCalledWith(100, { uid: true });
      expect(mockClient.append).toHaveBeenCalledWith('Drafts', expect.any(Buffer), ['\\Draft']);
    });

    it('continue l\'append même si la suppression de l\'ancien échoue', async () => {
      mockClient.messageDelete.mockRejectedValueOnce(new Error('not found'));

      const result = await saveDraft(
        makeAccount(),
        { subject: 'Updated', text: 'Updated' },
        999,
      );

      expect(result.ok).toBe(true);
      expect(mockClient.append).toHaveBeenCalled();
    });

    it('lance une erreur si la config IMAP manque', async () => {
      const account = { _id: '507f1f77bcf86cd799439011', emailAddress: 'a@b.com' } as unknown as IAccountDocument;

      await expect(saveDraft(account, { subject: 'Test', text: '' })).rejects.toThrow(
        'Configuration IMAP/SMTP manquante pour ce compte',
      );
    });

    it('lance une erreur si un compte IMAP n\'a pas de mot de passe', async () => {
      const imapAccountNoPass = {
        _id: '507f1f77bcf86cd799439011',
        emailAddress: 'user@test.com',
        provider: 'imap',
        imapConfig: { host: 'imap.test.com', port: 993, secure: true },
      } as unknown as IAccountDocument;

      await expect(saveDraft(imapAccountNoPass, { subject: 'Test', text: '' })).rejects.toThrow(
        'Configuration IMAP/SMTP manquante pour ce compte',
      );
    });

    it('sauvegarde un brouillon avec succès pour un compte Google OAuth sans encryptedPassword', async () => {
      const oauthAccount = {
        _id: '507f1f77bcf86cd799439011',
        emailAddress: 'user@gmail.com',
        provider: 'google_oauth',
        imapConfig: { host: 'imap.gmail.com', port: 993, secure: true },
        oauthConfig: { encryptedRefreshToken: { iv: 'a', authTag: 'b', ciphertext: 'c' } },
      } as unknown as IAccountDocument;

      const result = await saveDraft(oauthAccount, {
        to: ['dest@test.com'],
        subject: 'Brouillon Google OAuth',
        text: 'Corps OAuth',
      });

      expect(result.ok).toBe(true);
      expect(result.uid).toBe(42);
      expect(mockClient.append).toHaveBeenCalledWith('Drafts', expect.any(Buffer), ['\\Draft']);
    });

    it('sauvegarde un brouillon avec succès pour un compte Microsoft OAuth sans encryptedPassword', async () => {
      const msAccount = {
        _id: '507f1f77bcf86cd799439011',
        emailAddress: 'user@outlook.com',
        provider: 'microsoft_oauth',
        imapConfig: { host: 'outlook.office365.com', port: 993, secure: true },
        oauthConfig: { encryptedRefreshToken: { iv: 'a', authTag: 'b', ciphertext: 'c' } },
      } as unknown as IAccountDocument;

      const result = await saveDraft(msAccount, {
        to: ['dest@test.com'],
        subject: 'Brouillon Microsoft OAuth',
        text: 'Corps MS',
      });

      expect(result.ok).toBe(true);
      expect(result.uid).toBe(42);
    });

    it('libère le pool en finally', async () => {
      const { imapPool } = await import('./imapPool.js');

      await saveDraft(makeAccount(), { subject: 'Test', text: '' });

      expect(imapPool.release).toHaveBeenCalled();
    });

    it('gère les images inline Data URI en les convertissant lors du saveDraft', async () => {
      const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const result = await saveDraft(makeAccount(), {
        subject: 'Brouillon avec logo',
        text: 'Logo :',
        html: `<p>Logo :</p><img src="data:image/png;base64,${b64}" alt="Logo" />`,
      });

      expect(result.ok).toBe(true);
      expect(mockClient.append).toHaveBeenCalledWith(
        'Drafts',
        expect.any(Buffer),
        ['\\Draft'],
      );
    });
  });

  describe('deleteDraft', () => {
    it('supprime un brouillon via IMAP', async () => {
      await deleteDraft(makeAccount(), 42);

      expect(mockClient.mailboxOpen).toHaveBeenCalledWith('Drafts', { readOnly: false });
      expect(mockClient.messageDelete).toHaveBeenCalledWith(42, { uid: true });
    });

    it('libère le pool en finally', async () => {
      const { imapPool } = await import('./imapPool.js');

      await deleteDraft(makeAccount(), 42);

      expect(imapPool.release).toHaveBeenCalled();
    });
  });
});
