import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SenderListService } from './senderListService.js';
import { AppError } from '../../utils/AppError.js';

const {
  mockSenderListFind,
  mockSenderListFindOne,
  mockSenderListCreate,
  mockSenderListDeleteOne,
} = vi.hoisted(() => ({
  mockSenderListFind: vi.fn(),
  mockSenderListFindOne: vi.fn(),
  mockSenderListCreate: vi.fn(),
  mockSenderListDeleteOne: vi.fn(),
}));

vi.mock('../../models/SenderList.js', () => ({
  SenderListModel: class MockModel {
    data: unknown;
    constructor(data: unknown) {
      this.data = data;
    }
    save = vi.fn().mockImplementation(() => Promise.resolve(this.data));
    static find = mockSenderListFind;
    static findOne = mockSenderListFindOne;
    static create = mockSenderListCreate;
    static deleteOne = mockSenderListDeleteOne;
  },
}));

describe('SenderListService', () => {
  const userId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listSenderEntries', () => {
    it('retourne les entrées triées par date de création descendante', async () => {
      const mockSort = vi.fn().mockResolvedValue([{ target: 'trusted@bank.com', type: 'allow' }]);
      mockSenderListFind.mockReturnValue({ sort: mockSort });

      const res = await SenderListService.listSenderEntries(userId, { type: 'allow' });

      expect(mockSenderListFind).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'allow',
        }),
      );
      expect(mockSort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(res).toHaveLength(1);
    });
  });

  describe('createSenderEntry', () => {
    it('enregistre une nouvelle entrée si elle n\'existe pas encore', async () => {
      mockSenderListFindOne.mockResolvedValue(null);

      const entry = await SenderListService.createSenderEntry(userId, {
        type: 'allow',
        target: 'newsletter@goodnews.com',
        note: 'Infolettre tech',
      });

      expect(entry).toBeDefined();
    });

    it('lève un conflit (409) si la cible existe déjà pour ce type', async () => {
      mockSenderListFindOne.mockResolvedValue({ _id: '123' });

      await expect(
        SenderListService.createSenderEntry(userId, {
          type: 'deny',
          target: 'spam@evil.com',
        }),
      ).rejects.toThrow(AppError);
    });
  });

  describe('deleteSenderEntry', () => {
    it('supprime l\'entrée si elle existe', async () => {
      mockSenderListDeleteOne.mockResolvedValue({ deletedCount: 1 });

      await expect(
        SenderListService.deleteSenderEntry(userId, '507f1f77bcf86cd799439012'),
      ).resolves.not.toThrow();
    });

    it('lève une erreur 404 si l\'entrée est introuvable', async () => {
      mockSenderListDeleteOne.mockResolvedValue({ deletedCount: 0 });

      await expect(
        SenderListService.deleteSenderEntry(userId, '507f1f77bcf86cd799439012'),
      ).rejects.toThrow(AppError);
    });
  });

  describe('checkSenderStatus', () => {
    it('identifie un expéditeur dans la liste blanche par son email exact', async () => {
      mockSenderListFind.mockReturnValue({
        lean: vi.fn().mockResolvedValue([{ type: 'allow', target: 'vip@corp.com' }]),
      });

      const status = await SenderListService.checkSenderStatus(userId, 'vip@corp.com');

      expect(status).toBe('allow');
    });

    it('identifie un expéditeur par son nom de domaine (@domaine.com)', async () => {
      mockSenderListFind.mockReturnValue({
        lean: vi.fn().mockResolvedValue([{ type: 'deny', target: '@scam.org' }]),
      });

      const status = await SenderListService.checkSenderStatus(userId, 'attacker@scam.org');

      expect(status).toBe('deny');
    });

    it('donne la priorité à la liste blanche en cas de règle concurrente', async () => {
      mockSenderListFind.mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { type: 'deny', target: '@company.com' },
          { type: 'allow', target: 'ceo@company.com' },
        ]),
      });

      const status = await SenderListService.checkSenderStatus(userId, 'ceo@company.com');

      expect(status).toBe('allow');
    });

    it('retourne null si l\'expéditeur n\'est dans aucune liste', async () => {
      mockSenderListFind.mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      });

      const status = await SenderListService.checkSenderStatus(userId, 'unknown@random.fr');

      expect(status).toBeNull();
    });
  });
});
