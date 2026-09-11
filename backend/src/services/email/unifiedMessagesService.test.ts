import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUnifiedMessages, getUnifiedStatus } from './unifiedMessagesService.js';
import { AccountModel } from '../../models/Account.js';
import { MessageModel } from '../../models/Message.js';
import { FolderModel } from '../../models/Folder.js';

vi.mock('../../models/Account.js', () => ({
  AccountModel: {
    find: vi.fn(),
  },
}));

vi.mock('../../models/Message.js', () => ({
  MessageModel: {
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

vi.mock('../../models/Folder.js', () => ({
  FolderModel: {
    find: vi.fn(),
  },
}));

describe('unifiedMessagesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retourne des données vides si aucun compte actif', async () => {
    vi.mocked(AccountModel.find).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      }),
    } as unknown as ReturnType<typeof AccountModel.find>);

    const res = await getUnifiedMessages('user-1', { type: 'inbox' });
    expect(res.data).toEqual([]);
    expect(res.total).toBe(0);
  });

  it('récupère les messages INBOX pour les comptes actifs', async () => {
    const fakeAccounts = [{ _id: 'acc-1' }, { _id: 'acc-2' }];
    vi.mocked(AccountModel.find).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(fakeAccounts),
      }),
    } as unknown as ReturnType<typeof AccountModel.find>);

    vi.mocked(FolderModel.find).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      }),
    } as unknown as ReturnType<typeof FolderModel.find>);

    const fakeMessages = [
      { _id: 'm1', subject: 'Msg 1', isPinned: true, date: new Date() },
      { _id: 'm2', subject: 'Msg 2', isPinned: false, date: new Date() },
    ];

    vi.mocked(MessageModel.find).mockReturnValue({
      sort: vi.fn().mockReturnValue({
        skip: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue(fakeMessages),
          }),
        }),
      }),
    } as unknown as ReturnType<typeof MessageModel.find>);

    vi.mocked(MessageModel.countDocuments).mockResolvedValue(2);

    const res = await getUnifiedMessages('user-1', { type: 'inbox' });
    expect(res.total).toBe(2);
    expect(res.data.length).toBe(2);
    expect(MessageModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: { $in: ['acc-1', 'acc-2'] },
        folder: 'INBOX',
      }),
    );
  });

  it('calcule le statut unifié sans erreur', async () => {
    const fakeAccounts = [{ _id: 'acc-1' }];
    vi.mocked(AccountModel.find).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(fakeAccounts),
      }),
    } as unknown as ReturnType<typeof AccountModel.find>);

    const fakeFolders = [
      {
        accountId: 'acc-1',
        path: 'INBOX',
        name: 'INBOX',
        specialUse: '\\Inbox',
        unseen: 3,
        messages: 10,
      },
    ];

    vi.mocked(FolderModel.find).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(fakeFolders),
      }),
    } as unknown as ReturnType<typeof FolderModel.find>);

    vi.mocked(MessageModel.countDocuments).mockResolvedValue(1);

    const status = await getUnifiedStatus('user-1');
    expect(status.inbox.unseen).toBe(3);
    expect(status.inbox.total).toBe(10);
  });
});
