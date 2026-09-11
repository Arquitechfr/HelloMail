import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  scheduleEmail,
  listScheduledEmails,
  getScheduledEmail,
  cancelScheduledEmail,
} from './scheduledEmailService.js';

const {
  mockScheduledCreate,
  mockScheduledFind,
  mockScheduledFindOne,
  mockScheduledDeleteOne,
  mockAccountFindOne,
} = vi.hoisted(() => ({
  mockScheduledCreate: vi.fn(),
  mockScheduledFind: vi.fn(),
  mockScheduledFindOne: vi.fn(),
  mockScheduledDeleteOne: vi.fn(),
  mockAccountFindOne: vi.fn(),
}));

vi.mock('../../models/ScheduledMessage.js', () => ({
  ScheduledMessageModel: {
    create: mockScheduledCreate,
    find: mockScheduledFind,
    findOne: mockScheduledFindOne,
    deleteOne: mockScheduledDeleteOne,
  },
}));

vi.mock('../../models/Account.js', () => ({
  AccountModel: {
    findOne: mockAccountFindOne,
  },
}));

describe('scheduledEmailService', () => {
  const userId = '507f1f77bcf86cd799439011';
  const accountId = '507f1f77bcf86cd799439022';
  const scheduledId = '507f1f77bcf86cd799439033';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('programme un email avec succès', async () => {
    mockAccountFindOne.mockResolvedValue({
      _id: accountId,
      userId,
      emailAddress: 'test@example.com',
    });

    const fakeScheduled = {
      _id: scheduledId,
      userId,
      accountId,
      payload: { to: ['bob@test.com'], subject: 'Test' },
      status: 'pending',
    };
    mockScheduledCreate.mockResolvedValue(fakeScheduled);

    const result = await scheduleEmail(userId, accountId, {
      to: ['bob@test.com'],
      subject: 'Test',
      text: 'Corps',
      scheduledAt: new Date(Date.now() + 3600000),
    });

    expect(result).toEqual(fakeScheduled);
    expect(mockScheduledCreate).toHaveBeenCalled();
  });

  it('rejette la programmation si le compte est introuvable', async () => {
    mockAccountFindOne.mockResolvedValue(null);

    await expect(
      scheduleEmail(userId, accountId, {
        to: ['bob@test.com'],
        subject: 'Test',
        text: 'Corps',
        scheduledAt: new Date(Date.now() + 3600000),
      }),
    ).rejects.toThrow('Compte introuvable');
  });

  it('liste les emails programmés en attente', async () => {
    const mockExec = vi.fn().mockResolvedValue([
      { _id: '1', payload: { subject: 'Premier' } },
      { _id: '2', payload: { subject: 'Second' } },
    ]);
    const mockSort = vi.fn().mockReturnValue({ exec: mockExec });
    mockScheduledFind.mockReturnValue({ sort: mockSort });

    const list = await listScheduledEmails(userId, accountId);
    expect(list).toHaveLength(2);
    expect(mockScheduledFind).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending' }),
    );
  });

  it('récupère un email programmé par ID', async () => {
    const fakeDoc = { _id: scheduledId, payload: { subject: 'Trouvé' } };
    const mockExec = vi.fn().mockResolvedValue(fakeDoc);
    mockScheduledFindOne.mockReturnValue({ exec: mockExec });

    const result = await getScheduledEmail(userId, scheduledId);
    expect(result).toEqual(fakeDoc);
  });

  it('annule un email programmé en attente', async () => {
    mockScheduledFindOne.mockResolvedValue({
      _id: scheduledId,
      status: 'pending',
    });
    mockScheduledDeleteOne.mockResolvedValue({ acknowledged: true, deletedCount: 1 });

    await cancelScheduledEmail(userId, scheduledId);
    expect(mockScheduledDeleteOne).toHaveBeenCalledWith({ _id: scheduledId });
  });

  it('refuse d\'annuler un message déjà envoyé', async () => {
    mockScheduledFindOne.mockResolvedValue({
      _id: scheduledId,
      status: 'sent',
    });

    await expect(cancelScheduledEmail(userId, scheduledId)).rejects.toThrow(
      'Ce message a déjà été envoyé',
    );
  });
});
