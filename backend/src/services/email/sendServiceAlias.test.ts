import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IAccountDocument } from '../../models/Account.js';
import { AppError } from '../../utils/AppError.js';
import mongoose from 'mongoose';

const { mockSendMail, mockClient } = vi.hoisted(() => ({
  mockSendMail: vi.fn().mockResolvedValue({
    messageId: '<msg-123@test.com>',
    accepted: ['dest@test.com'],
    rejected: [],
  }),
  mockClient: {
    usable: true,
    connect: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    append: vi.fn().mockResolvedValue({ uid: 10 }),
    mailboxOpen: vi.fn().mockResolvedValue({ exists: 1 }),
    fetchOne: vi.fn().mockResolvedValue({
      uid: 10,
      envelope: {},
      flags: new Set(),
      bodyStructure: {},
      size: 512,
    }),
  },
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn().mockReturnValue({
      sendMail: mockSendMail,
      close: vi.fn(),
    }),
  },
}));

vi.mock('./imapPool.js', () => ({
  imapPool: {
    acquire: vi.fn().mockResolvedValue(mockClient),
    release: vi.fn(),
  },
}));

vi.mock('../security/encryptionService.js', () => ({
  decrypt: vi.fn().mockReturnValue('mock-password'),
}));

vi.mock('../auth/oauthService.js', () => ({
  getSmtpAuth: vi.fn().mockResolvedValue({ user: 'main@test.com', pass: 'mock-pass' }),
}));

vi.mock('./specialFolders.js', () => ({
  findSentFolder: vi.fn().mockResolvedValue('Sent'),
}));

vi.mock('../../models/Message.js', () => ({
  MessageModel: {
    updateOne: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../sync/messageMapper.js', () => ({
  mapFetchResultToMessage: vi.fn().mockReturnValue({
    accountId: 'acc1',
    folder: 'Sent',
    uid: 10,
    subject: 'Test',
    date: new Date(),
    flags: { seen: true, answered: false, flagged: false },
    hasAttachments: false,
    size: 512,
  }),
}));

import { sendEmail, type SendEmailInput } from './sendService.js';

describe('sendEmail avec alias ("Send As")', () => {
  const aliasId = new mongoose.Types.ObjectId();
  const makeAccount = (): IAccountDocument =>
    ({
      _id: new mongoose.Types.ObjectId(),
      userId: new mongoose.Types.ObjectId(),
      emailAddress: 'main@test.com',
      displayName: 'Compte Principal',
      imapConfig: {
        host: 'imap.test.com',
        port: 993,
        secure: true,
        smtpHost: 'smtp.test.com',
        smtpPort: 465,
        smtpSecure: true,
        username: 'main@test.com',
      },
      aliases: [
        {
          _id: aliasId,
          name: 'Equipe Support',
          email: 'support@test.com',
          isDefault: true,
        },
      ],
    }) as unknown as IAccountDocument;

  const baseInput: SendEmailInput = {
    to: ['client@example.com'],
    subject: 'Assistance HelloMail',
    text: 'Bonjour, voici notre retour.',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('envoie avec un alias configuré en positionnant from et sender (RFC 5322)', async () => {
    const account = makeAccount();
    const result = await sendEmail(account, {
      ...baseInput,
      from: {
        address: 'support@test.com',
        name: 'Equipe Support',
      },
    });

    expect(result.messageId).toBe('<msg-123@test.com>');
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '"Equipe Support" <support@test.com>',
        sender: 'main@test.com',
        replyTo: 'support@test.com',
        to: 'client@example.com',
      }),
    );
  });

  it('rejette l\'envoi avec une 400 si l\'adresse d\'expédition n\'est pas autorisée', async () => {
    const account = makeAccount();

    await expect(
      sendEmail(account, {
        ...baseInput,
        from: {
          address: 'pirate@autre.com',
        },
      }),
    ).rejects.toThrow(AppError);

    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('utilise l\'adresse principale par défaut sans sender si aucun from n\'est spécifié', async () => {
    const account = makeAccount();
    const result = await sendEmail(account, baseInput);

    expect(result.messageId).toBe('<msg-123@test.com>');
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '"Compte Principal" <main@test.com>',
        sender: undefined,
      }),
    );
  });
});
