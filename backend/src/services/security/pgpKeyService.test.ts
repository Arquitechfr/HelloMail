import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PgpKeyService } from './pgpKeyService.js';
import { AppError } from '../../utils/AppError.js';

const {
  mockPgpKeyFind,
  mockPgpKeyFindOne,
  mockPgpKeyCreate,
  mockPgpKeyDeleteOne,
} = vi.hoisted(() => ({
  mockPgpKeyFind: vi.fn(),
  mockPgpKeyFindOne: vi.fn(),
  mockPgpKeyCreate: vi.fn(),
  mockPgpKeyDeleteOne: vi.fn(),
}));

vi.mock('../../models/PgpKey.js', () => ({
  PgpKeyModel: {
    find: mockPgpKeyFind,
    findOne: mockPgpKeyFindOne,
    create: mockPgpKeyCreate,
    deleteOne: mockPgpKeyDeleteOne,
  },
}));

describe('PgpKeyService', () => {
  const userId = '507f1f77bcf86cd799439011';
  const dummyPublicKey = '-----BEGIN PGP PUBLIC KEY BLOCK-----\ntest\n-----END PGP PUBLIC KEY BLOCK-----';
  const dummyPrivateKey = '-----BEGIN PGP PRIVATE KEY BLOCK-----\ntest\n-----END PGP PRIVATE KEY BLOCK-----';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserKeys', () => {
    it('retourne les clés personnelles triées par date décroissante', async () => {
      const mockSort = vi.fn().mockResolvedValue([{ keyId: 'KEY1', isOwnKey: true }]);
      mockPgpKeyFind.mockReturnValue({ sort: mockSort });

      const keys = await PgpKeyService.getUserKeys(userId);

      expect(mockPgpKeyFind).toHaveBeenCalledWith({ userId, isOwnKey: true });
      expect(mockSort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(keys).toHaveLength(1);
    });
  });

  describe('saveUserKey', () => {
    it('crée une nouvelle clé personnelle si aucune clé existante avec cette empreinte', async () => {
      mockPgpKeyFindOne.mockResolvedValue(null);
      const createdKey = {
        userId,
        email: 'user@test.com',
        armoredPublicKey: dummyPublicKey,
        fingerprint: 'ABCDEF1234567890',
        keyId: '1234567890ABCDEF',
        isOwnKey: true,
      };
      mockPgpKeyCreate.mockResolvedValue(createdKey);

      const result = await PgpKeyService.saveUserKey(userId, {
        email: 'USER@TEST.COM',
        name: 'Mon Nom',
        armoredPublicKey: dummyPublicKey,
        armoredPrivateKey: dummyPrivateKey,
        fingerprint: 'abcdef1234567890',
        keyId: '1234567890abcdef',
        algorithm: 'Curve25519',
      });

      expect(result).toBe(createdKey);
      expect(mockPgpKeyCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          email: 'user@test.com',
          fingerprint: 'ABCDEF1234567890',
          keyId: '1234567890ABCDEF',
          isOwnKey: true,
        }),
      );
    });

    it('met à jour la clé personnelle existante si même empreinte', async () => {
      const existing = {
        userId,
        email: 'old@test.com',
        armoredPublicKey: 'old',
        save: vi.fn().mockResolvedValue(undefined),
      };
      mockPgpKeyFindOne.mockResolvedValue(existing);

      const result = await PgpKeyService.saveUserKey(userId, {
        email: 'NEW@TEST.COM',
        armoredPublicKey: dummyPublicKey,
        fingerprint: 'ABCDEF1234567890',
        keyId: 'KEYID123',
        algorithm: 'Curve25519',
      });

      expect(existing.save).toHaveBeenCalled();
      expect(result.email).toBe('new@test.com');
      expect(result.armoredPublicKey).toBe(dummyPublicKey);
    });
  });

  describe('deleteUserKey', () => {
    it('supprime une clé personnelle existante', async () => {
      mockPgpKeyDeleteOne.mockResolvedValue({ deletedCount: 1 });

      await PgpKeyService.deleteUserKey(userId, 'KEY123');

      expect(mockPgpKeyDeleteOne).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          isOwnKey: true,
          $or: [{ keyId: 'KEY123' }, { fingerprint: 'KEY123' }],
        }),
      );
    });

    it('lance une 404 si la clé personnelle est introuvable', async () => {
      mockPgpKeyDeleteOne.mockResolvedValue({ deletedCount: 0 });

      await expect(PgpKeyService.deleteUserKey(userId, 'UNKNOWN')).rejects.toThrow(AppError);
    });
  });

  describe('getContactPublicKey', () => {
    it("retourne la clé publique d'un correspondant par email", async () => {
      const mockKey = {
        email: 'contact@test.com',
        name: 'Alice',
        armoredPublicKey: dummyPublicKey,
        fingerprint: 'FP123',
        keyId: 'KEY1',
      };
      const mockSort = vi.fn().mockResolvedValue(mockKey);
      mockPgpKeyFindOne.mockReturnValue({ sort: mockSort });

      const key = await PgpKeyService.getContactPublicKey(userId, 'CONTACT@TEST.COM');

      expect(mockPgpKeyFindOne).toHaveBeenCalledWith({
        userId,
        email: 'contact@test.com',
      });
      expect(key?.email).toBe('contact@test.com');
      expect(key?.armoredPublicKey).toBe(dummyPublicKey);
    });

    it('retourne null si aucune clé trouvée pour cet email', async () => {
      const mockSort = vi.fn().mockResolvedValue(null);
      mockPgpKeyFindOne.mockReturnValue({ sort: mockSort });

      const key = await PgpKeyService.getContactPublicKey(userId, 'unknown@test.com');
      expect(key).toBeNull();
    });
  });

  describe('saveContactPublicKey et deleteContactPublicKey', () => {
    it('enregistre une clé publique de contact', async () => {
      mockPgpKeyFindOne.mockResolvedValue(null);
      const created = { email: 'bob@test.com', isOwnKey: false };
      mockPgpKeyCreate.mockResolvedValue(created);

      const result = await PgpKeyService.saveContactPublicKey(userId, {
        email: 'bob@test.com',
        armoredPublicKey: dummyPublicKey,
        fingerprint: 'FPBOB',
        keyId: 'KEYBOB',
        algorithm: 'Curve25519',
      });

      expect(result).toBe(created);
      expect(mockPgpKeyCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          isOwnKey: false,
          email: 'bob@test.com',
        }),
      );
    });

    it('supprime une clé de contact', async () => {
      mockPgpKeyDeleteOne.mockResolvedValue({ deletedCount: 1 });

      await PgpKeyService.deleteContactPublicKey(userId, 'KEYBOB');
      expect(mockPgpKeyDeleteOne).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          isOwnKey: false,
        }),
      );
    });
  });
});
