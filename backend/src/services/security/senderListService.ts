import { Types } from 'mongoose';
import {
  SenderListModel,
  type SenderListDocument,
  type SenderListType,
} from '../../models/SenderList.js';
import { AppError } from '../../utils/AppError.js';
import type {
  CreateSenderListInput,
  QuerySenderListInput,
} from '../../schemas/senderListSchemas.js';

export class SenderListService {
  /**
   * Liste les entrées de listes blanches / noires d'un utilisateur.
   */
  static async listSenderEntries(
    userId: string,
    query?: QuerySenderListInput,
  ): Promise<SenderListDocument[]> {
    const filter: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
    };

    if (query?.type) {
      filter.type = query.type;
    }

    if (query?.search) {
      const searchRegex = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ target: searchRegex }, { note: searchRegex }];
    }

    return SenderListModel.find(filter).sort({ createdAt: -1 });
  }

  /**
   * Ajoute une nouvelle règle de liste blanche ou noire.
   */
  static async createSenderEntry(
    userId: string,
    input: CreateSenderListInput,
  ): Promise<SenderListDocument> {
    const userObjectId = new Types.ObjectId(userId);
    const target = input.target.trim().toLowerCase();

    // Vérifie si la cible existe déjà pour ce type
    const existing = await SenderListModel.findOne({
      userId: userObjectId,
      type: input.type,
      target,
    });

    if (existing) {
      throw AppError.conflict(
        `Cette adresse ou ce domaine est déjà présent dans votre liste ${input.type === 'allow' ? 'blanche' : 'noire'}`,
      );
    }

    const entry = new SenderListModel({
      userId: userObjectId,
      type: input.type,
      target,
      note: input.note,
    });

    return entry.save();
  }

  /**
   * Supprime une entrée de la liste.
   */
  static async deleteSenderEntry(userId: string, entryId: string): Promise<void> {
    const res = await SenderListModel.deleteOne({
      _id: new Types.ObjectId(entryId),
      userId: new Types.ObjectId(userId),
    });

    if (res.deletedCount === 0) {
      throw AppError.notFound('Entrée introuvable ou déjà supprimée');
    }
  }

  /**
   * Vérifie le statut d'un expéditeur (allow, deny ou null) pour un utilisateur donné.
   * Analyse l'adresse email complète ainsi que le nom de domaine (@domaine.com et domaine.com).
   * En cas de présence conflictuelle, la liste blanche ('allow') prévaut par mesure de sécurité.
   */
  static async checkSenderStatus(
    userId: string,
    senderEmail?: string,
  ): Promise<SenderListType | null> {
    if (!senderEmail) return null;

    const email = senderEmail.trim().toLowerCase();
    const atIndex = email.lastIndexOf('@');
    const domain = atIndex > 0 ? email.substring(atIndex + 1) : '';

    const candidates = [email];
    if (domain) {
      candidates.push(`@${domain}`, domain);
    }

    const matches = await SenderListModel.find({
      userId: new Types.ObjectId(userId),
      target: { $in: candidates },
    }).lean();

    if (matches.length === 0) {
      return null;
    }

    // Priorité à l'allowlist pour éviter qu'un email légitime soit perdu
    const hasAllow = matches.some((m) => m.type === 'allow');
    if (hasAllow) {
      return 'allow';
    }

    const hasDeny = matches.some((m) => m.type === 'deny');
    if (hasDeny) {
      return 'deny';
    }

    return null;
  }
}
