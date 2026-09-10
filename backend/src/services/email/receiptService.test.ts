import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendReadReceipt } from './receiptService.js';
import * as messageFetchService from './messageFetchService.js';
import * as sendService from './sendService.js';
import * as messageActionService from './messageActionService.js';
import { AppError } from '../../utils/AppError.js';

import type { IAccountDocument } from '../../models/Account.js';

describe('receiptService', () => {
  const mockAccount = {
    _id: '64f1a2b3c4d5e6f7a8b9c0d1',
    emailAddress: 'user@hellomail.com',
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
      to: [{ address: 'user@hellomail.com' }],
      date: new Date('2026-09-10T12:00:00Z'),
      headers: {},
      flags: { seen: true, answered: false, flagged: false },
      size: 1000,
      attachments: [],
    });

    const sendEmailSpy = vi.spyOn(sendService, 'sendEmail').mockResolvedValue({
      messageId: '<ack-999@hellomail.com>',
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

  it('échoue si aucun accusé n\'a été demandé', async () => {
    vi.spyOn(messageFetchService, 'fetchMessageDetail').mockResolvedValue({
      subject: 'Sans accusé',
      from: { address: 'sender@sender.com' },
      to: [{ address: 'user@hellomail.com' }],
      date: new Date(),
      headers: {},
      flags: { seen: true, answered: false, flagged: false },
      size: 1000,
      attachments: [],
    });

    await expect(sendReadReceipt(mockAccount, 'INBOX', 42)).rejects.toThrow(AppError);
  });
});
