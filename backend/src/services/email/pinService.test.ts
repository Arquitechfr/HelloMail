import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pinMessage } from './pinService.js';
import { MessageModel } from '../../models/Message.js';
import { publishEvent } from '../realtime/eventPublisher.js';
import type { IAccountDocument } from '../../models/Account.js';

vi.mock('../../models/Message.js', () => ({
  MessageModel: {
    findOneAndUpdate: vi.fn(),
  },
}));

vi.mock('../realtime/eventPublisher.js', () => ({
  publishEvent: vi.fn(),
}));

describe('pinService', () => {
  const fakeAccount = {
    _id: 'acc-123',
    userId: 'user-456',
  } as unknown as IAccountDocument;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('met en avant un message et publie un événement', async () => {
    const fakeUpdated = {
      _id: 'msg-1',
      accountId: 'acc-123',
      folder: 'INBOX',
      uid: 42,
      isPinned: true,
      pinnedAt: new Date(),
    };

    vi.mocked(MessageModel.findOneAndUpdate).mockResolvedValue(fakeUpdated as unknown as ReturnType<typeof MessageModel.findOneAndUpdate>);

    const result = await pinMessage(fakeAccount, 'INBOX', 42, true);

    expect(MessageModel.findOneAndUpdate).toHaveBeenCalledWith(
      { accountId: 'acc-123', folder: 'INBOX', uid: 42 },
      expect.objectContaining({
        $set: expect.objectContaining({ isPinned: true }),
      }),
      { new: true },
    );

    expect(publishEvent).toHaveBeenCalledWith({
      type: 'message:flags',
      accountId: 'acc-123',
      userId: 'user-456',
      payload: { folder: 'INBOX', uid: 42, isPinned: true },
    });

    expect(result).toEqual(fakeUpdated);
  });

  it('lève une erreur 404 si le message n\'existe pas', async () => {
    vi.mocked(MessageModel.findOneAndUpdate).mockResolvedValue(null);

    await expect(pinMessage(fakeAccount, 'INBOX', 999, false)).rejects.toThrow('Message introuvable');
  });
});
