import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { AliasService } from './aliasService.js';
import { AccountModel, type IAccountDocument } from '../../models/Account.js';
import { AppError } from '../../utils/AppError.js';

const { mockAccountFindOne } = vi.hoisted(() => ({
  mockAccountFindOne: vi.fn(),
}));

vi.mock('../../models/Account.js', () => ({
  AccountModel: {
    findOne: mockAccountFindOne,
  },
}));

describe('AliasService', () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const accountId = new mongoose.Types.ObjectId().toString();

  const mockSave = vi.fn().mockResolvedValue(undefined);
  const mockMarkModified = vi.fn();

  function makeMockAccount(aliases: Array<{ _id?: mongoose.Types.ObjectId; name?: string; email: string; isDefault?: boolean }> = []): IAccountDocument {
    return {
      _id: new mongoose.Types.ObjectId(accountId),
      userId: new mongoose.Types.ObjectId(userId),
      emailAddress: 'principal@test.com',
      displayName: 'Utilisateur Principal',
      aliases,
      save: mockSave,
      markModified: mockMarkModified,
    } as unknown as IAccountDocument;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listAliases', () => {
    it('retourne la liste des alias pour un compte valide', async () => {
      const aliasId = new mongoose.Types.ObjectId();
      const account = makeMockAccount([
        { _id: aliasId, name: 'Support', email: 'support@test.com', isDefault: true },
      ]);
      mockAccountFindOne.mockResolvedValueOnce(account);

      const result = await AliasService.listAliases(userId, accountId);
      expect(result).toHaveLength(1);
      expect(result[0].email).toBe('support@test.com');
      expect(result[0].name).toBe('Support');
    });

    it('lance une 404 si le compte est introuvable', async () => {
      mockAccountFindOne.mockResolvedValueOnce(null);

      await expect(AliasService.listAliases(userId, accountId)).rejects.toThrow(AppError);
    });
  });

  describe('createAlias', () => {
    it('ajoute un alias avec succès', async () => {
      const account = makeMockAccount([]);
      mockAccountFindOne.mockResolvedValueOnce(account);

      const created = await AliasService.createAlias(userId, accountId, {
        name: 'Contact Pro',
        email: 'contact@test.com',
        isDefault: false,
      });

      expect(created.email).toBe('contact@test.com');
      expect(created.name).toBe('Contact Pro');
      expect(created.isDefault).toBe(false);
      expect(account.aliases).toHaveLength(1);
      expect(mockSave).toHaveBeenCalled();
    });

    it("refuse un alias identique à l'adresse principale du compte", async () => {
      const account = makeMockAccount([]);
      mockAccountFindOne.mockResolvedValueOnce(account);

      await expect(
        AliasService.createAlias(userId, accountId, {
          email: 'principal@test.com',
        }),
      ).rejects.toThrow(AppError);
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('refuse un alias en doublon', async () => {
      const account = makeMockAccount([
        { _id: new mongoose.Types.ObjectId(), email: 'info@test.com' },
      ]);
      mockAccountFindOne.mockResolvedValueOnce(account);

      await expect(
        AliasService.createAlias(userId, accountId, {
          email: 'INFO@test.com',
        }),
      ).rejects.toThrow(AppError);
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('réinitialise les autres isDefault si le nouvel alias est par défaut', async () => {
      const existing = {
        _id: new mongoose.Types.ObjectId(),
        email: 'existant@test.com',
        isDefault: true,
      };
      const account = makeMockAccount([existing]);
      mockAccountFindOne.mockResolvedValueOnce(account);

      const created = await AliasService.createAlias(userId, accountId, {
        email: 'nouveau@test.com',
        isDefault: true,
      });

      expect(created.isDefault).toBe(true);
      expect(existing.isDefault).toBe(false);
      expect(mockSave).toHaveBeenCalled();
    });
  });

  describe('updateAlias', () => {
    it("met à jour un alias existant et modifie l'état isDefault", async () => {
      const id1 = new mongoose.Types.ObjectId();
      const id2 = new mongoose.Types.ObjectId();
      const a1 = { _id: id1, name: 'Ancien', email: 'a1@test.com', isDefault: false };
      const a2 = { _id: id2, name: 'Autre', email: 'a2@test.com', isDefault: true };

      const account = makeMockAccount([a1, a2]);
      mockAccountFindOne.mockResolvedValueOnce(account);

      const updated = await AliasService.updateAlias(userId, accountId, id1.toString(), {
        name: 'Nouveau Nom',
        isDefault: true,
      });

      expect(updated.name).toBe('Nouveau Nom');
      expect(updated.isDefault).toBe(true);
      expect(a2.isDefault).toBe(false);
      expect(mockMarkModified).toHaveBeenCalledWith('aliases');
      expect(mockSave).toHaveBeenCalled();
    });

    it('lance une 404 si aliasId est introuvable', async () => {
      const account = makeMockAccount([]);
      mockAccountFindOne.mockResolvedValueOnce(account);

      await expect(
        AliasService.updateAlias(userId, accountId, new mongoose.Types.ObjectId().toString(), {
          name: 'Inconnu',
        }),
      ).rejects.toThrow(AppError);
    });
  });

  describe('deleteAlias', () => {
    it('supprime un alias existant', async () => {
      const id1 = new mongoose.Types.ObjectId();
      const a1 = { _id: id1, email: 'supprimer@test.com' };
      const account = makeMockAccount([a1]);
      mockAccountFindOne.mockResolvedValueOnce(account);

      await AliasService.deleteAlias(userId, accountId, id1.toString());

      expect(account.aliases).toHaveLength(0);
      expect(mockMarkModified).toHaveBeenCalledWith('aliases');
      expect(mockSave).toHaveBeenCalled();
    });
  });

  describe('verifySenderIdentity', () => {
    const aliasId = new mongoose.Types.ObjectId();
    const account = makeMockAccount([
      { _id: aliasId, name: 'Equipe Pro', email: 'pro@test.com', isDefault: true },
    ]);

    it("accepte l'adresse principale du compte", () => {
      const identity = AliasService.verifySenderIdentity(account, 'principal@test.com');
      expect(identity.address).toBe('principal@test.com');
      expect(identity.isAlias).toBe(false);
    });

    it('accepte un alias déclaré et retourne son nom', () => {
      const identity = AliasService.verifySenderIdentity(account, 'PRO@test.com');
      expect(identity.address).toBe('pro@test.com');
      expect(identity.name).toBe('Equipe Pro');
      expect(identity.isAlias).toBe(true);
    });

    it('rejette une adresse non autorisée avec une 400', () => {
      expect(() => {
        AliasService.verifySenderIdentity(account, 'hacker@autre.com');
      }).toThrow(AppError);
    });
  });
});
