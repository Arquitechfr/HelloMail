import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScheduledMessageModel } from '../../models/ScheduledMessage.js';
import { AccountModel } from '../../models/Account.js';
import { processDueScheduledEmails } from './scheduledEmailRunner.js';

vi.mock('../../models/ScheduledMessage.js', () => ({
  ScheduledMessageModel: {
    find: vi.fn(),
    findOneAndUpdate: vi.fn(),
    findOne: vi.fn(),
  },
}));

vi.mock('../../models/Account.js', () => ({
  AccountModel: {
    findById: vi.fn(),
  },
}));

vi.mock('../email/sendService.js', () => ({
  sendEmail: vi.fn().mockResolvedValue({
    messageId: '<msg123@example.com>',
    accepted: ['recipient@test.com'],
    rejected: [],
  }),
}));

vi.mock('../realtime/eventPublisher.js', () => ({
  publishEvent: vi.fn().mockResolvedValue(1),
}));

describe('scheduledEmailRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('traite et envoie les emails arrivés à échéance', async () => {
    const { sendEmail } = await import('../email/sendService.js');

    const fakeItem = { _id: 'sched-1' };
    const mockExec = vi.fn().mockResolvedValue([fakeItem]);
    const mockLean = vi.fn().mockReturnValue({ exec: mockExec });
    const mockLimit = vi.fn().mockReturnValue({ lean: mockLean });
    vi.mocked(ScheduledMessageModel.find).mockReturnValue({ limit: mockLimit } as unknown as ReturnType<typeof ScheduledMessageModel.find>);

    const mockLocked = {
      _id: 'sched-1',
      userId: 'user-1',
      accountId: 'acc-1',
      payload: { subject: 'Échu', to: ['test@test.com'] },
      status: 'processing',
      attempts: 1,
      save: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(ScheduledMessageModel.findOneAndUpdate).mockResolvedValue(mockLocked as unknown as ReturnType<typeof ScheduledMessageModel.findOneAndUpdate>);

    vi.mocked(AccountModel.findById).mockResolvedValue({
      _id: 'acc-1',
      isActive: true,
      emailAddress: 'me@test.com',
    } as unknown as ReturnType<typeof AccountModel.findById>);

    const count = await processDueScheduledEmails();
    expect(count).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(mockLocked.status).toBe('sent');
    expect(mockLocked.save).toHaveBeenCalled();
  });

  it('ignore si aucun message n\'est échu', async () => {
    const { sendEmail } = await import('../email/sendService.js');

    const mockExec = vi.fn().mockResolvedValue([]);
    const mockLean = vi.fn().mockReturnValue({ exec: mockExec });
    const mockLimit = vi.fn().mockReturnValue({ lean: mockLean });
    vi.mocked(ScheduledMessageModel.find).mockReturnValue({ limit: mockLimit } as unknown as ReturnType<typeof ScheduledMessageModel.find>);

    const count = await processDueScheduledEmails();
    expect(count).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('gère l\'échec d\'envoi avec incrémentation des tentatives', async () => {
    const { sendEmail } = await import('../email/sendService.js');
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error('SMTP down'));

    const fakeItem = { _id: 'sched-2' };
    const mockExec = vi.fn().mockResolvedValue([fakeItem]);
    const mockLean = vi.fn().mockReturnValue({ exec: mockExec });
    const mockLimit = vi.fn().mockReturnValue({ lean: mockLean });
    vi.mocked(ScheduledMessageModel.find).mockReturnValue({ limit: mockLimit } as unknown as ReturnType<typeof ScheduledMessageModel.find>);

    const mockLocked = {
      _id: 'sched-2',
      userId: 'user-1',
      accountId: 'acc-1',
      payload: { subject: 'Erreur SMTP' },
      status: 'processing',
      attempts: 1,
      errorMessage: undefined as string | undefined,
      save: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(ScheduledMessageModel.findOneAndUpdate).mockResolvedValue(mockLocked as unknown as ReturnType<typeof ScheduledMessageModel.findOneAndUpdate>);

    vi.mocked(AccountModel.findById).mockResolvedValue({
      _id: 'acc-1',
      isActive: true,
    } as unknown as ReturnType<typeof AccountModel.findById>);

    const count = await processDueScheduledEmails();
    expect(count).toBe(0);
    expect(mockLocked.status).toBe('pending');
    expect(mockLocked.errorMessage).toContain('SMTP down');
  });

  it('passe le statut à failed après 3 tentatives infructueuses', async () => {
    const { sendEmail } = await import('../email/sendService.js');
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error('SMTP permanent failure'));

    const fakeItem = { _id: 'sched-3' };
    const mockExec = vi.fn().mockResolvedValue([fakeItem]);
    const mockLean = vi.fn().mockReturnValue({ exec: mockExec });
    const mockLimit = vi.fn().mockReturnValue({ lean: mockLean });
    vi.mocked(ScheduledMessageModel.find).mockReturnValue({ limit: mockLimit } as unknown as ReturnType<typeof ScheduledMessageModel.find>);

    const mockLocked = {
      _id: 'sched-3',
      userId: 'user-1',
      accountId: 'acc-1',
      payload: { subject: 'Max attempts' },
      status: 'processing',
      attempts: 3,
      errorMessage: undefined as string | undefined,
      save: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(ScheduledMessageModel.findOneAndUpdate).mockResolvedValue(mockLocked as unknown as ReturnType<typeof ScheduledMessageModel.findOneAndUpdate>);

    vi.mocked(AccountModel.findById).mockResolvedValue({
      _id: 'acc-1',
      isActive: true,
    } as unknown as ReturnType<typeof AccountModel.findById>);

    const count = await processDueScheduledEmails();
    expect(count).toBe(0);
    expect(mockLocked.status).toBe('failed');
    expect(mockLocked.errorMessage).toContain('SMTP permanent failure');
  });
});
