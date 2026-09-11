import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { blockSender } from './blockSenderService.js';
import type { IAccountDocument } from '../../models/Account.js';

vi.mock('../../models/Message.js', () => ({
  MessageModel: {
    findOne: vi.fn(),
  },
}));

vi.mock('../../models/Rule.js', () => ({
  RuleModel: {
    findOne: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('./messageActionService.js', () => ({
  markMessageAsJunk: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./messageFetchService.js', () => ({
  fetchMessageDetail: vi.fn(),
}));

vi.mock('../realtime/eventPublisher.js', () => ({
  publishEvent: vi.fn(),
}));

const { MessageModel } = await import('../../models/Message.js');
const { RuleModel } = await import('../../models/Rule.js');
const { markMessageAsJunk } = await import('./messageActionService.js');
const { publishEvent } = await import('../realtime/eventPublisher.js');

describe('blockSenderService', () => {
  const mockUserId = new Types.ObjectId().toString();
  const mockAccountId = new Types.ObjectId().toString();

  const mockAccount = {
    _id: mockAccountId,
    userId: mockUserId,
    emailAddress: 'user@test.com',
  } as unknown as IAccountDocument;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('crée une règle de blocage et déplace le message en spam si aucune règle existante', async () => {
    vi.mocked(MessageModel.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        from: { address: 'spammer@example.com' },
      }),
    } as unknown as ReturnType<typeof MessageModel.findOne>);

    vi.mocked(RuleModel.findOne)
      .mockResolvedValueOnce(null) // existingRule
      .mockReturnValueOnce({
        sort: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue({ order: 2 }),
        }),
      } as unknown as ReturnType<typeof RuleModel.findOne>); // highestRule

    vi.mocked(RuleModel.create).mockResolvedValueOnce({} as unknown as Awaited<ReturnType<typeof RuleModel.create>>);

    const res = await blockSender(mockAccount, 'INBOX', 55);

    expect(res.success).toBe(true);
    expect(res.senderEmail).toBe('spammer@example.com');
    expect(res.ruleCreated).toBe(true);

    expect(RuleModel.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Bloqué : spammer@example.com',
      order: 3,
      isActive: true,
      conditions: [{ field: 'from', operator: 'equals', value: 'spammer@example.com' }],
      actions: [{ type: 'markAsJunk' }],
    }));

    expect(markMessageAsJunk).toHaveBeenCalledWith(mockAccount, 'INBOX', 55);
    expect(publishEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'message:deleted',
      userId: mockUserId,
      accountId: mockAccountId,
      payload: { folder: 'INBOX', uid: 55 },
    }));
  });

  it('ne recrée pas de règle si une règle identique existe déjà', async () => {
    vi.mocked(MessageModel.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        from: { address: 'already-blocked@example.com' },
      }),
    } as unknown as ReturnType<typeof MessageModel.findOne>);

    vi.mocked(RuleModel.findOne).mockResolvedValueOnce({ _id: 'rule-123' } as unknown as Awaited<ReturnType<typeof RuleModel.findOne>>);

    const res = await blockSender(mockAccount, 'INBOX', 66);

    expect(res.success).toBe(true);
    expect(res.ruleCreated).toBe(false);
    expect(RuleModel.create).not.toHaveBeenCalled();
    expect(markMessageAsJunk).toHaveBeenCalledWith(mockAccount, 'INBOX', 66);
  });

  it("rejette avec AppError 400 si l'adresse de l'expéditeur est absente", async () => {
    vi.mocked(MessageModel.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue({ from: {} }),
    } as unknown as ReturnType<typeof MessageModel.findOne>);

    await expect(blockSender(mockAccount, 'INBOX', 77)).rejects.toThrow(
      "Impossible d'identifier l'adresse de l'expéditeur",
    );
  });
});
