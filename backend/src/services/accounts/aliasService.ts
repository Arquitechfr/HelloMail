import mongoose from 'mongoose';
import { AccountModel, IAccountDocument, IAccountAlias } from '../../models/Account.js';
import { AppError } from '../../utils/AppError.js';
import type { CreateAliasInput, UpdateAliasInput } from '../../schemas/aliasSchemas.js';

export class AliasService {
  /**
   * Liste les alias déclarés pour un compte donné.
   */
  static async listAliases(userId: string, accountId: string): Promise<IAccountAlias[]> {
    const account = await AccountModel.findOne({ _id: accountId, userId });
    if (!account) {
      throw AppError.notFound('Compte introuvable');
    }
    return account.aliases || [];
  }

  /**
   * Ajoute un nouvel alias à un compte.
   * Vérifie l'unicité par rapport à l'adresse principale et aux autres alias du compte.
   */
  static async createAlias(
    userId: string,
    accountId: string,
    input: CreateAliasInput,
  ): Promise<IAccountAlias> {
    const account = await AccountModel.findOne({ _id: accountId, userId });
    if (!account) {
      throw AppError.notFound('Compte introuvable');
    }

    const normalizedEmail = input.email.toLowerCase().trim();

    if (account.emailAddress.toLowerCase() === normalizedEmail) {
      throw AppError.conflict("L'adresse principale du compte ne peut pas être ajoutée comme alias");
    }

    const existingAliases = account.aliases || [];
    const duplicate = existingAliases.some((a) => a.email.toLowerCase() === normalizedEmail);
    if (duplicate) {
      throw AppError.conflict('Cet alias existe déjà pour ce compte');
    }

    if (input.isDefault) {
      for (const alias of existingAliases) {
        alias.isDefault = false;
      }
    }

    const newAlias: IAccountAlias = {
      _id: new mongoose.Types.ObjectId(),
      name: input.name?.trim(),
      email: normalizedEmail,
      isDefault: !!input.isDefault,
      signature: input.signature
        ? {
            enabled: input.signature.enabled,
            text: input.signature.text || '',
            html: input.signature.html,
            variables: input.signature.variables,
          }
        : undefined,
    };

    account.aliases = [...existingAliases, newAlias];
    await account.save();

    return newAlias;
  }

  /**
   * Met à jour un alias existant.
   */
  static async updateAlias(
    userId: string,
    accountId: string,
    aliasId: string,
    input: UpdateAliasInput,
  ): Promise<IAccountAlias> {
    const account = await AccountModel.findOne({ _id: accountId, userId });
    if (!account) {
      throw AppError.notFound('Compte introuvable');
    }

    const aliases = account.aliases || [];
    const aliasIndex = aliases.findIndex((a) => String(a._id) === aliasId);
    if (aliasIndex === -1) {
      throw AppError.notFound('Alias introuvable');
    }

    if (input.email) {
      const normalizedEmail = input.email.toLowerCase().trim();
      if (account.emailAddress.toLowerCase() === normalizedEmail) {
        throw AppError.conflict("L'adresse principale du compte ne peut pas être un alias");
      }
      const duplicate = aliases.some(
        (a, i) => i !== aliasIndex && a.email.toLowerCase() === normalizedEmail,
      );
      if (duplicate) {
        throw AppError.conflict('Cet email est déjà utilisé par un autre alias');
      }
      aliases[aliasIndex].email = normalizedEmail;
    }

    if (input.name !== undefined) {
      aliases[aliasIndex].name = input.name ? input.name.trim() : undefined;
    }

    if (input.isDefault !== undefined) {
      if (input.isDefault) {
        for (let i = 0; i < aliases.length; i++) {
          aliases[i].isDefault = i === aliasIndex;
        }
      } else {
        aliases[aliasIndex].isDefault = false;
      }
    }

    if (input.signature !== undefined) {
      aliases[aliasIndex].signature = input.signature
        ? {
            enabled: input.signature.enabled,
            text: input.signature.text || '',
            html: input.signature.html,
            variables: input.signature.variables,
          }
        : undefined;
    }

    account.markModified('aliases');
    await account.save();

    return aliases[aliasIndex];
  }

  /**
   * Met à jour la signature d'un alias.
   */
  static async updateAliasSignature(
    userId: string,
    accountId: string,
    aliasId: string,
    signature: { enabled: boolean; text: string; html?: string; variables?: { phone?: string; jobTitle?: string; company?: string } },
  ): Promise<IAccountAlias> {
    return this.updateAlias(userId, accountId, aliasId, { signature });
  }

  /**
   * Supprime un alias.
   */
  static async deleteAlias(userId: string, accountId: string, aliasId: string): Promise<void> {
    const account = await AccountModel.findOne({ _id: accountId, userId });
    if (!account) {
      throw AppError.notFound('Compte introuvable');
    }

    const initialLength = (account.aliases || []).length;
    account.aliases = (account.aliases || []).filter((a) => String(a._id) !== aliasId);

    if (account.aliases.length === initialLength) {
      throw AppError.notFound('Alias introuvable');
    }

    account.markModified('aliases');
    await account.save();
  }

  /**
   * Vérifie que l'adresse d'expédition demandée est bien autorisée pour ce compte.
   * Retourne l'adresse normalisée et le nom d'affichage associé.
   */
  static verifySenderIdentity(
    account: IAccountDocument,
    requestedAddress: string,
    requestedName?: string,
  ): { address: string; name?: string; isAlias: boolean } {
    const normalized = requestedAddress.toLowerCase().trim();

    if (normalized === account.emailAddress.toLowerCase()) {
      return {
        address: account.emailAddress,
        name: requestedName ?? account.displayName,
        isAlias: false,
      };
    }

    const match = (account.aliases || []).find((a) => a.email.toLowerCase() === normalized);
    if (match) {
      return {
        address: match.email,
        name: requestedName ?? match.name ?? account.displayName,
        isAlias: true,
      };
    }

    throw AppError.badRequest("L'adresse d'expédition spécifiée n'est pas autorisée pour ce compte");
  }
}
