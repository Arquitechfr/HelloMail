import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { AccountModel } from '../../models/Account.js';
import { MessageModel } from '../../models/Message.js';
import { FolderModel } from '../../models/Folder.js';
import { searchUnifiedMessages } from './unifiedSearchService.js';

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

describe('unifiedSearchService', () => {
  const userId = '507f1f77bcf86cd799439011';
  const acc1Id = new Types.ObjectId('507f1f77bcf86cd799439012');
  const acc2Id = new Types.ObjectId('507f1f77bcf86cd799439013');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retourne des données vides si aucun compte actif', async () => {
    vi.mocked(AccountModel.find).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      }),
    } as unknown as ReturnType<typeof AccountModel.find>);

    const res = await searchUnifiedMessages(userId, { q: 'test' });
    expect(res.data).toEqual([]);
    expect(res.total).toBe(0);
  });

  it('interroge tous les comptes actifs et exclut par défaut Corbeille et Spams', async () => {
    const fakeAccounts = [
      { _id: acc1Id, emailAddress: 'user1@test.com', displayName: 'User 1', color: '#3b82f6' },
      { _id: acc2Id, emailAddress: 'user2@test.com', displayName: 'User 2', color: '#10b981' },
    ];
    vi.mocked(AccountModel.find).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(fakeAccounts),
      }),
    } as unknown as ReturnType<typeof AccountModel.find>);

    const fakeFolders = [
      { path: 'Trash', name: 'Trash', specialUse: '\\Trash' },
      { path: 'Spam', name: 'Junk', specialUse: '\\Junk' },
    ];
    vi.mocked(FolderModel.find).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(fakeFolders),
      }),
    } as unknown as ReturnType<typeof FolderModel.find>);

    const fakeMessages = [
      {
        _id: 'm1',
        accountId: acc1Id,
        subject: 'Facture Janvier',
        folder: 'INBOX',
        from: { address: 'facturation@acme.com', name: 'Acme Billing' },
        to: [{ address: 'user1@test.com' }],
        flags: { seen: true, flagged: false, answered: false },
        hasAttachments: true,
        size: 2048,
        date: new Date(),
      },
    ];

    const mockSort = vi.fn().mockReturnValue({
      skip: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(fakeMessages),
        }),
      }),
    });
    vi.mocked(MessageModel.find).mockReturnValue({ sort: mockSort } as unknown as ReturnType<typeof MessageModel.find>);
    vi.mocked(MessageModel.countDocuments).mockResolvedValue(1);

    const res = await searchUnifiedMessages(userId, {
      from: 'acme.com',
      hasAttachments: true,
      minSize: 1024,
      page: 1,
      limit: 20,
    });

    expect(res.data).toHaveLength(1);
    expect(res.data[0].accountColor).toBe('#3b82f6');
    expect(res.data[0].accountEmail).toBe('user1@test.com');
    expect(res.data[0].accountName).toBe('User 1');

    const mongoQuery = vi.mocked(MessageModel.find).mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(mongoQuery.accountId).toEqual({ $in: [acc1Id, acc2Id] });
    expect(mongoQuery.folder).toEqual({ $nin: ['Trash', 'Spam'] });
    expect(mongoQuery.hasAttachments).toBe(true);
    expect(mongoQuery.size).toEqual({ $gte: 1024 });
  });

  it('n\'exclut pas Corbeille et Spams si includeTrash et includeJunk sont vrais', async () => {
    const fakeAccounts = [
      { _id: acc1Id, emailAddress: 'user1@test.com', displayName: 'User 1', color: '#3b82f6' },
    ];
    vi.mocked(AccountModel.find).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(fakeAccounts),
      }),
    } as unknown as ReturnType<typeof AccountModel.find>);

    const mockSort = vi.fn().mockReturnValue({
      skip: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    vi.mocked(MessageModel.find).mockReturnValue({ sort: mockSort } as unknown as ReturnType<typeof MessageModel.find>);
    vi.mocked(MessageModel.countDocuments).mockResolvedValue(0);

    await searchUnifiedMessages(userId, {
      includeTrash: true,
      includeJunk: true,
    });

    const mongoQuery = vi.mocked(MessageModel.find).mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(mongoQuery.folder).toBeUndefined();
  });

  it('cible un compte unique si accountId est renseigné', async () => {
    const fakeAccounts = [
      { _id: acc1Id, emailAddress: 'user1@test.com', displayName: 'User 1', color: '#3b82f6' },
    ];
    vi.mocked(AccountModel.find).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(fakeAccounts),
      }),
    } as unknown as ReturnType<typeof AccountModel.find>);

    const mockSort = vi.fn().mockReturnValue({
      skip: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    vi.mocked(MessageModel.find).mockReturnValue({ sort: mockSort } as unknown as ReturnType<typeof MessageModel.find>);
    vi.mocked(MessageModel.countDocuments).mockResolvedValue(0);

    await searchUnifiedMessages(userId, {
      accountId: acc1Id.toString(),
      folder: 'INBOX',
    });

    const accountQuery = vi.mocked(AccountModel.find).mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(accountQuery._id).toEqual(acc1Id);

    const mongoQuery = vi.mocked(MessageModel.find).mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(mongoQuery.folder).toBe('INBOX');
  });
});
