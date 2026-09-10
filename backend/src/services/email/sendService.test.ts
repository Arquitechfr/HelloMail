import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IAccountDocument } from '../../models/Account.js';

// Mock du pool IMAP.
const mockClient = {
  usable: true,
  connect: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn().mockResolvedValue(undefined),
  append: vi.fn().mockResolvedValue({ uid: 1 }),
};

vi.mock('./imapPool.js', () => ({
  imapPool: {
    acquire: vi.fn().mockResolvedValue(mockClient),
    release: vi.fn(),
  },
}));

vi.mock('../security/encryptionService.js', () => ({
  decrypt: vi.fn().mockReturnValue('fake-password'),
}));

// Mock de specialFolders.findSentFolder.
const mockFindSentFolder = vi.fn().mockResolvedValue('Sent');

vi.mock('./specialFolders.js', () => ({
  findSentFolder: mockFindSentFolder,
}));

// Mock de nodemailer.
const mockSendMail = vi.fn();
const mockVerify = vi.fn().mockResolvedValue(true);
const mockClose = vi.fn();

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn().mockReturnValue({
      sendMail: mockSendMail,
      verify: mockVerify,
      close: mockClose,
    }),
  },
}));

const { sendEmail } = await import('./sendService.js');

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

const baseInput = {
  to: ['bob@test.com'],
  subject: 'Test',
  text: 'Bonjour',
};

describe('sendEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMail.mockResolvedValue({
      messageId: '<abc@test.com>',
      accepted: ['bob@test.com'],
      rejected: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('envoie un email nominal et sauvegarde dans Sent', async () => {
    const result = await sendEmail(makeAccount(), baseInput);

    expect(result.messageId).toBe('<abc@test.com>');
    expect(result.accepted).toEqual(['bob@test.com']);
    expect(result.rejected).toEqual([]);

    // Vérifie que sendMail a été appelé avec le bon from.
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const sendArgs = mockSendMail.mock.calls[0][0];
    expect(sendArgs.from).toBe('user@test.com');
    expect(sendArgs.to).toBe('bob@test.com');
    expect(sendArgs.subject).toBe('Test');
    expect(sendArgs.text).toBe('Bonjour');

    // Vérifie la sauvegarde dans Sent via IMAP append.
    expect(mockClient.append).toHaveBeenCalledTimes(1);
    expect(mockClient.append.mock.calls[0][0]).toBe('Sent');
    expect(mockClient.append.mock.calls[0][2]).toEqual(['\\Seen']);
  });

  it('gère les destinataires multiples (to, cc, bcc)', async () => {
    const input = {
      ...baseInput,
      to: ['bob@test.com', 'carol@test.com'],
      cc: ['dave@test.com'],
      bcc: ['eve@test.com'],
    };

    await sendEmail(makeAccount(), input);

    const sendArgs = mockSendMail.mock.calls[0][0];
    expect(sendArgs.to).toBe('bob@test.com, carol@test.com');
    expect(sendArgs.cc).toBe('dave@test.com');
    expect(sendArgs.bcc).toBe('eve@test.com');
  });

  it('gère reply avec inReplyTo et references', async () => {
    const input = {
      ...baseInput,
      inReplyTo: '<original@test.com>',
      references: ['<original@test.com>'],
    };

    await sendEmail(makeAccount(), input);

    const sendArgs = mockSendMail.mock.calls[0][0];
    expect(sendArgs.inReplyTo).toBe('<original@test.com>');
    expect(sendArgs.references).toBe('<original@test.com>');
  });

  it('gère les pièces jointes (base64 → Buffer)', async () => {
    const input = {
      ...baseInput,
      attachments: [
        { filename: 'doc.pdf', content: Buffer.from('PDF').toString('base64'), contentType: 'application/pdf' },
      ],
    };

    await sendEmail(makeAccount(), input);

    const sendArgs = mockSendMail.mock.calls[0][0];
    expect(sendArgs.attachments).toHaveLength(1);
    expect(sendArgs.attachments[0].filename).toBe('doc.pdf');
    expect(sendArgs.attachments[0].content).toEqual(Buffer.from('PDF'));
    expect(sendArgs.attachments[0].contentType).toBe('application/pdf');
  });

  it('gère le HTML optionnel', async () => {
    const input = { ...baseInput, html: '<p>Bonjour</p>' };

    await sendEmail(makeAccount(), input);

    const sendArgs = mockSendMail.mock.calls[0][0];
    expect(sendArgs.html).toBe('<p>Bonjour</p>');
  });

  it('lance 422 si l\'envoi SMTP échoue', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('SMTP refused'));

    await expect(sendEmail(makeAccount(), baseInput)).rejects.toThrow('Envoi SMTP échoué');
  });

  it('lance une AppError si imapConfig est manquant', async () => {
    const account = { _id: '507f1f77bcf86cd799439012', emailAddress: 'x@test.com' } as unknown as IAccountDocument;

    await expect(sendEmail(account, baseInput)).rejects.toThrow('Configuration IMAP/SMTP manquante');
  });

  it('ne fait pas échouer l\'envoi si la sauvegarde Sent échoue', async () => {
    mockClient.append.mockRejectedValueOnce(new Error('Sent folder not found'));

    const result = await sendEmail(makeAccount(), baseInput);

    expect(result.messageId).toBe('<abc@test.com>');
    // L'envoi a réussi malgré l'échec de sauvegarde.
    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });

  it('ferme le transport SMTP après envoi', async () => {
    await sendEmail(makeAccount(), baseInput);

    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('ferme le transport SMTP même en cas d\'échec', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('SMTP refused'));

    try {
      await sendEmail(makeAccount(), baseInput);
    } catch {
      // ignore
    }

    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('utilise le dossier Sent détecté via findSentFolder', async () => {
    mockFindSentFolder.mockResolvedValueOnce('Mes messages envoyés');

    await sendEmail(makeAccount(), baseInput);

    expect(mockFindSentFolder).toHaveBeenCalledTimes(1);
    expect(mockClient.append).toHaveBeenCalledWith('Mes messages envoyés', expect.any(Buffer), ['\\Seen']);
  });

  it('utilise "Sent" comme fallback si findSentFolder retourne null', async () => {
    mockFindSentFolder.mockResolvedValueOnce(null);

    await sendEmail(makeAccount(), baseInput);

    expect(mockClient.append).toHaveBeenCalledWith('Sent', expect.any(Buffer), ['\\Seen']);
  });
});
