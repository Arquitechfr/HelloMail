import { PgpKeyModel, type IPgpKeyDocument } from '../../models/PgpKey.js';
import { AppError } from '../../utils/AppError.js';
import type { SaveUserKeyInput, SaveContactKeyInput } from '../../schemas/pgpSchemas.js';

export class PgpKeyService {
  /**
   * Récupère les clés OpenPGP personnelles de l'utilisateur.
   */
  static async getUserKeys(userId: string): Promise<IPgpKeyDocument[]> {
    return PgpKeyModel.find({ userId, isOwnKey: true }).sort({ createdAt: -1 });
  }

  /**
   * Enregistre ou met à jour une clé OpenPGP personnelle pour l'utilisateur.
   */
  static async saveUserKey(userId: string, input: SaveUserKeyInput): Promise<IPgpKeyDocument> {
    const normalizedEmail = input.email.toLowerCase().trim();
    const normalizedFingerprint = input.fingerprint.toUpperCase().trim();
    const normalizedKeyId = input.keyId.toUpperCase().trim();

    const existing = await PgpKeyModel.findOne({
      userId,
      fingerprint: normalizedFingerprint,
    });

    if (existing) {
      existing.email = normalizedEmail;
      existing.name = input.name?.trim();
      existing.armoredPublicKey = input.armoredPublicKey;
      if (input.armoredPrivateKey) {
        existing.armoredPrivateKey = input.armoredPrivateKey;
      }
      existing.keyId = normalizedKeyId;
      existing.algorithm = input.algorithm;
      existing.isOwnKey = true;
      await existing.save();
      return existing;
    }

    return PgpKeyModel.create({
      userId,
      email: normalizedEmail,
      name: input.name?.trim(),
      armoredPublicKey: input.armoredPublicKey,
      armoredPrivateKey: input.armoredPrivateKey,
      fingerprint: normalizedFingerprint,
      keyId: normalizedKeyId,
      algorithm: input.algorithm,
      isOwnKey: true,
    });
  }

  /**
   * Supprime une clé personnelle de l'utilisateur par keyId ou fingerprint.
   */
  static async deleteUserKey(userId: string, keyId: string): Promise<void> {
    const normalizedKeyId = keyId.toUpperCase().trim();
    const result = await PgpKeyModel.deleteOne({
      userId,
      isOwnKey: true,
      $or: [{ keyId: normalizedKeyId }, { fingerprint: normalizedKeyId }],
    });

    if (result.deletedCount === 0) {
      throw AppError.notFound('Clé OpenPGP introuvable');
    }
  }

  /**
   * Récupère la clé publique d'un correspondant par son adresse email.
   * Recherche en priorité dans les contacts, puis dans les clés de l'utilisateur.
   */
  static async getContactPublicKey(
    userId: string,
    email: string,
  ): Promise<{ email: string; name?: string; armoredPublicKey: string; fingerprint: string; keyId: string } | null> {
    const normalizedEmail = email.toLowerCase().trim();

    const key = await PgpKeyModel.findOne({
      userId,
      email: normalizedEmail,
    }).sort({ isOwnKey: -1, createdAt: -1 });

    if (!key) return null;

    return {
      email: key.email,
      name: key.name,
      armoredPublicKey: key.armoredPublicKey,
      fingerprint: key.fingerprint,
      keyId: key.keyId,
    };
  }

  /**
   * Liste l'ensemble des clés publiques des correspondants enregistrées pour l'utilisateur.
   */
  static async listContactPublicKeys(userId: string): Promise<IPgpKeyDocument[]> {
    return PgpKeyModel.find({ userId, isOwnKey: false }).sort({ email: 1 });
  }

  /**
   * Enregistre ou met à jour la clé publique d'un correspondant.
   */
  static async saveContactPublicKey(
    userId: string,
    input: SaveContactKeyInput,
  ): Promise<IPgpKeyDocument> {
    const normalizedEmail = input.email.toLowerCase().trim();
    const normalizedFingerprint = input.fingerprint.toUpperCase().trim();
    const normalizedKeyId = input.keyId.toUpperCase().trim();

    const existing = await PgpKeyModel.findOne({
      userId,
      fingerprint: normalizedFingerprint,
    });

    if (existing) {
      existing.email = normalizedEmail;
      existing.name = input.name?.trim();
      existing.armoredPublicKey = input.armoredPublicKey;
      existing.keyId = normalizedKeyId;
      existing.algorithm = input.algorithm;
      existing.isOwnKey = false;
      await existing.save();
      return existing;
    }

    return PgpKeyModel.create({
      userId,
      email: normalizedEmail,
      name: input.name?.trim(),
      armoredPublicKey: input.armoredPublicKey,
      fingerprint: normalizedFingerprint,
      keyId: normalizedKeyId,
      algorithm: input.algorithm,
      isOwnKey: false,
    });
  }

  /**
   * Supprime la clé publique d'un correspondant.
   */
  static async deleteContactPublicKey(userId: string, keyId: string): Promise<void> {
    const normalizedKeyId = keyId.toUpperCase().trim();
    const result = await PgpKeyModel.deleteOne({
      userId,
      isOwnKey: false,
      $or: [{ keyId: normalizedKeyId }, { fingerprint: normalizedKeyId }],
    });

    if (result.deletedCount === 0) {
      throw AppError.notFound('Clé publique de contact introuvable');
    }
  }
}
