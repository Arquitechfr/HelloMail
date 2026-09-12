import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addSenderContactIfEnabled, searchContacts } from './contactService.js';
import { UserModel } from '../../models/User.js';
import { ContactModel } from '../../models/Contact.js';
import { Types } from 'mongoose';

vi.mock('../../models/User.js', () => ({
  UserModel: {
    findById: vi.fn(),
  },
}));

vi.mock('../../models/Contact.js', () => ({
  ContactModel: {
    updateOne: vi.fn(),
    find: vi.fn(),
  },
}));

vi.mock('../../config/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('contactService - addSenderContactIfEnabled', () => {
  const userId = '64f1a2b3c4d5e6f7a8b9c0d1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ne fait rien si autoAddContacts est désactivé', async () => {
    vi.spyOn(UserModel, 'findById').mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ preferences: { autoAddContacts: false } }),
      }),
    } as never);

    const result = await addSenderContactIfEnabled(userId, {
      name: 'Alice',
      address: 'alice@example.com',
    });

    expect(result).toBe(false);
    expect(ContactModel.updateOne).not.toHaveBeenCalled();
  });

  it('ignore les adresses noreply ou invalides', async () => {
    vi.spyOn(UserModel, 'findById').mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ preferences: { autoAddContacts: true } }),
      }),
    } as never);

    const res1 = await addSenderContactIfEnabled(userId, { address: 'no-reply@service.com' });
    const res2 = await addSenderContactIfEnabled(userId, { address: 'invalid-email' });
    const res3 = await addSenderContactIfEnabled(userId, { address: 'mailer-daemon@mx.com' });

    expect(res1).toBe(false);
    expect(res2).toBe(false);
    expect(res3).toBe(false);
    expect(ContactModel.updateOne).not.toHaveBeenCalled();
  });

  it('ajoute le contact si autoAddContacts est activé', async () => {
    vi.spyOn(UserModel, 'findById').mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ preferences: { autoAddContacts: true } }),
      }),
    } as never);

    vi.spyOn(ContactModel, 'updateOne').mockResolvedValue({ upsertedCount: 1 } as never);

    const result = await addSenderContactIfEnabled(userId, {
      name: 'Bob Martin',
      address: '<bob@example.com>',
    });

    expect(result).toBe(true);
    expect(ContactModel.updateOne).toHaveBeenCalledWith(
      { userId: new Types.ObjectId(userId), email: 'bob@example.com' },
      {
        $setOnInsert: {
          userId: new Types.ObjectId(userId),
          name: 'Bob Martin',
          email: 'bob@example.com',
        },
      },
      { upsert: true },
    );
  });

  describe('searchContacts', () => {
    it('échappe les caractères spéciaux regex dans la requête de recherche', async () => {
      const mockChain = {
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        lean: vi.fn().mockResolvedValue([
          { _id: '1', name: 'Support Dev', email: 'support+dev@test.com' },
        ]),
      };
      vi.spyOn(ContactModel, 'find').mockReturnValue(mockChain as never);

      const results = await searchContacts(userId, 'support+dev@test.com');

      expect(results).toHaveLength(1);
      expect(ContactModel.find).toHaveBeenCalledWith({
        userId,
        $or: [
          { name: { $regex: 'support\\+dev@test\\.com', $options: 'i' } },
          { email: { $regex: 'support\\+dev@test\\.com', $options: 'i' } },
        ],
      });
    });
  });
});
