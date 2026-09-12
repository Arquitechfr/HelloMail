import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as messageFetchService from './messageFetchService.js';
import * as sendService from './sendService.js';
import * as messageActionService from './messageActionService.js';
import { MessageModel } from '../../models/Message.js';
import { AppError } from '../../utils/AppError.js';
import { sendReadReceipt } from './receiptService.js';

import type { IAccountDocument } from '../../models/Account.js';

vi.mock('../../models/Message.js', () => ({
  MessageModel: {
    updateOne: vi.fn().mockResolvedValue({}),
  },
}));

describe('receiptService', () => {
  const mockAccount = {
    _id: '64f1a2b3c4d5e6f7a8b9c0d1',
    emailAddress: 'user@mailora.me',
  } as unknown as IAccountDocument;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('envoie un accusé de réception si readReceiptRequestedTo est présent', async () => {
    vi.spyOn(messageFetchService, 'fetchMessageDetail').mockResolvedValue({
      subject: 'Proposition de projet',
      messageId: '<msg-123@sender.com>',
      readReceiptRequestedTo: 'sender@sender.com',
      from: { address: 'sender@sender.com' },
      to: [{ address: 'user@mailora.me' }],
      date: new Date('2026-09-10T12:00:00Z'),
      headers: {},
      flags: { seen: true, answered: false, flagged: false },
      size: 1000,
      attachments: [],
    });

    const sendEmailSpy = vi.spyOn(sendService, 'sendEmail').mockResolvedValue({
      messageId: '<ack-999@mailora.me>',
      accepted: ['sender@sender.com'],
      rejected: [],
    });

    const updateFlagsSpy = vi.spyOn(messageActionService, 'updateFlags').mockResolvedValue();

    const result = await sendReadReceipt(mockAccount, 'INBOX', 42);

    expect(result.ok).toBe(true);
    expect(result.sentTo).toBe('sender@sender.com');

    expect(sendEmailSpy).toHaveBeenCalledWith(mockAccount, expect.objectContaining({
      to: ['sender@sender.com'],
      subject: 'Lu : Proposition de projet',
      inReplyTo: '<msg-123@sender.com>',
    }));

    expect(updateFlagsSpy).toHaveBeenCalledWith(mockAccount, 'INBOX', 42, { answered: true });
  });

  it('ne renvoie pas d\'email si readReceiptSentAt est déjà renseigné (idempotence)', async () => {
    vi.spyOn(messageFetchService, 'fetchMessageDetail').mockResolvedValue({
      subject: 'Message déjà confirmé',
      messageId: '<msg-already@sender.com>',
      readReceiptRequestedTo: 'sender@sender.com',
      readReceiptSentAt: '2026-09-11T10:00:00.000Z',
      from: { address: 'sender@sender.com' },
      to: [{ address: 'user@mailora.me' }],
      date: new Date(),
      headers: {},
      flags: { seen: true, answered: true, flagged: false },
      size: 1000,
      attachments: [],
    });

    const sendEmailSpy = vi.spyOn(sendService, 'sendEmail');

    const result = await sendReadReceipt(mockAccount, 'INBOX', 42);

    expect(result.ok).toBe(true);
    expect(result.sentTo).toBe('sender@sender.com');
    expect(sendEmailSpy).not.toHaveBeenCalled();
  });

  it('échoue si aucun accusé n\'a été demandé', async () => {
    vi.spyOn(messageFetchService, 'fetchMessageDetail').mockResolvedValue({
      subject: 'Sans accusé',
      from: { address: 'sender@sender.com' },
      to: [{ address: 'user@mailora.me' }],
      date: new Date(),
      headers: {},
      flags: { seen: true, answered: false, flagged: false },
      size: 1000,
      attachments: [],
    });

    await expect(sendReadReceipt(mockAccount, 'INBOX', 42)).rejects.toThrow(AppError);
  });
});
