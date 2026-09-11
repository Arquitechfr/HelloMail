import type { IAccountDocument } from '../../models/Account.js';
import { AppError } from '../../utils/AppError.js';
import { imapPool } from './imapPool.js';
import { MessageModel } from '../../models/Message.js';
import { MessageBodyModel } from '../../models/MessageBody.js';
import { findTrashFolder, findJunkFolder } from './specialFolders.js';

export interface FlagsUpdate {
  seen?: boolean;
  flagged?: boolean;
  answered?: boolean;
}

export type BatchAction = 'delete' | 'move' | 'markRead' | 'markUnread' | 'flag' | 'unflag' | 'markAsJunk' | 'pin' | 'unpin';

/** Supprime le corps mis en cache (best-effort — le TTL MongoDB nettoie le reste). */
async function deleteCachedBody(accountId: string, folder: string, uid: number): Promise<void> {
  try {
    await MessageBodyModel.deleteOne({ accountId, folder, uid });
  } catch {
    // Cache best-effort — ignoré.
  }
}

/**
 * Met à jour les flags d'un message côté IMAP et en base.
 * Ouvre le dossier en read-write (nécessaire pour STORE).
 */
export async function updateFlags(
  account: IAccountDocument,
  folder: string,
  uid: number,
  flags: FlagsUpdate,
): Promise<void> {
  const accountId = String(account._id);
  const client = await imapPool.acquire(account);

  try {
    await client.mailboxOpen(folder, { readOnly: false });

    if (flags.seen === true) {
      await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
    } else if (flags.seen === false) {
      await client.messageFlagsRemove(uid, ['\\Seen'], { uid: true });
    }

    if (flags.flagged === true) {
      await client.messageFlagsAdd(uid, ['\\Flagged'], { uid: true });
    } else if (flags.flagged === false) {
      await client.messageFlagsRemove(uid, ['\\Flagged'], { uid: true });
    }

    if (flags.answered === true) {
      await client.messageFlagsAdd(uid, ['\\Answered'], { uid: true });
    } else if (flags.answered === false) {
      await client.messageFlagsRemove(uid, ['\\Answered'], { uid: true });
    }

    // Synchronise en base.
    const updateFields: Record<string, boolean> = {};
    if (flags.seen !== undefined) updateFields['flags.seen'] = flags.seen;
    if (flags.flagged !== undefined) updateFields['flags.flagged'] = flags.flagged;
    if (flags.answered !== undefined) updateFields['flags.answered'] = flags.answered;

    if (Object.keys(updateFields).length > 0) {
      await MessageModel.updateOne({ accountId, folder, uid }, { $set: updateFields });
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw AppError.unprocessable(
      `Mise à jour des flags échouée : ${error instanceof Error ? error.message : 'erreur inconnue'}`,
    );
  } finally {
    imapPool.release(accountId);
  }
}

/**
 * Supprime un message. Par défaut, déplace vers Trash. Si permanent=true, supprime définitivement.
 */
export async function deleteMessage(
  account: IAccountDocument,
  folder: string,
  uid: number,
  permanent = false,
): Promise<void> {
  const accountId = String(account._id);
  const client = await imapPool.acquire(account);

  try {
    await client.mailboxOpen(folder, { readOnly: false });

    if (permanent) {
      await client.messageDelete(uid, { uid: true });
    } else {
      // Cherche le dossier Trash via specialUse + fallbacks, dernier recours 'Trash'.
      const trashPath = (await findTrashFolder(account)) ?? 'Trash';
      await client.messageMove(uid, trashPath, { uid: true });
    }

    await MessageModel.deleteOne({ accountId, folder, uid });
    await deleteCachedBody(accountId, folder, uid);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw AppError.unprocessable(
      `Suppression du message échouée : ${error instanceof Error ? error.message : 'erreur inconnue'}`,
    );
  } finally {
    imapPool.release(accountId);
  }
}

/**
 * Déplace un message vers un autre dossier.
 */
export async function moveMessage(
  account: IAccountDocument,
  folder: string,
  uid: number,
  destination: string,
): Promise<void> {
  const accountId = String(account._id);
  const client = await imapPool.acquire(account);

  try {
    await client.mailboxOpen(folder, { readOnly: false });
    await client.messageMove(uid, destination, { uid: true });
    await MessageModel.deleteOne({ accountId, folder, uid });
    await deleteCachedBody(accountId, folder, uid);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw AppError.unprocessable(
      `Déplacement du message échoué : ${error instanceof Error ? error.message : 'erreur inconnue'}`,
    );
  } finally {
    imapPool.release(accountId);
  }
}

/**
 * Marque un message comme spam (déplace vers le dossier Junk).
 * Détecte le dossier Junk via specialUse (\\Junk) avec fallbacks (Junk, Spam, etc.).
 */
export async function markMessageAsJunk(
  account: IAccountDocument,
  folder: string,
  uid: number,
): Promise<void> {
  const accountId = String(account._id);
  const client = await imapPool.acquire(account);

  try {
    await client.mailboxOpen(folder, { readOnly: false });
    const junkPath = (await findJunkFolder(account)) ?? 'Junk';
    await client.messageMove(uid, junkPath, { uid: true });
    await MessageModel.deleteOne({ accountId, folder, uid });
    await deleteCachedBody(accountId, folder, uid);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw AppError.unprocessable(
      `Marquage comme spam échoué : ${error instanceof Error ? error.message : 'erreur inconnue'}`,
    );
  } finally {
    imapPool.release(accountId);
  }
}

/**
 * Exécute une action sur un lot de messages.
 * Limite : 100 UIDs maximum (validé par le schéma Zod).
 */
export async function batchAction(
  account: IAccountDocument,
  folder: string,
  uids: number[],
  action: BatchAction,
  destination?: string,
): Promise<{ affected: number }> {
  const accountId = String(account._id);
  const client = await imapPool.acquire(account);

  try {
    await client.mailboxOpen(folder, { readOnly: false });

    let affected = 0;

    switch (action) {
      case 'markRead':
        await client.messageFlagsAdd(uids, ['\\Seen'], { uid: true });
        affected = uids.length;
        await MessageModel.updateMany(
          { accountId, folder, uid: { $in: uids } },
          { $set: { 'flags.seen': true } },
        );
        break;

      case 'markUnread':
        await client.messageFlagsRemove(uids, ['\\Seen'], { uid: true });
        affected = uids.length;
        await MessageModel.updateMany(
          { accountId, folder, uid: { $in: uids } },
          { $set: { 'flags.seen': false } },
        );
        break;

      case 'flag':
        await client.messageFlagsAdd(uids, ['\\Flagged'], { uid: true });
        affected = uids.length;
        await MessageModel.updateMany(
          { accountId, folder, uid: { $in: uids } },
          { $set: { 'flags.flagged': true } },
        );
        break;

      case 'unflag':
        await client.messageFlagsRemove(uids, ['\\Flagged'], { uid: true });
        affected = uids.length;
        await MessageModel.updateMany(
          { accountId, folder, uid: { $in: uids } },
          { $set: { 'flags.flagged': false } },
        );
        break;

      case 'delete': {
        const trashPath = (await findTrashFolder(account)) ?? 'Trash';
        await client.messageMove(uids, trashPath, { uid: true });
        affected = uids.length;
        await MessageModel.deleteMany({ accountId, folder, uid: { $in: uids } });
        break;
      }

      case 'markAsJunk': {
        // Déplace vers le dossier Junk (Spam) détecté via specialUse + fallbacks.
        const junkPath = (await findJunkFolder(account)) ?? 'Junk';
        await client.messageMove(uids, junkPath, { uid: true });
        affected = uids.length;
        await MessageModel.deleteMany({ accountId, folder, uid: { $in: uids } });
        break;
      }

      case 'move': {
        if (!destination) {
          throw AppError.badRequest('Dossier de destination requis pour l\'action move');
        }
        await client.messageMove(uids, destination, { uid: true });
        affected = uids.length;
        await MessageModel.deleteMany({ accountId, folder, uid: { $in: uids } });
        break;
      }

      case 'pin':
        affected = uids.length;
        await MessageModel.updateMany(
          { accountId, folder, uid: { $in: uids } },
          { $set: { isPinned: true, pinnedAt: new Date() } },
        );
        break;

      case 'unpin':
        affected = uids.length;
        await MessageModel.updateMany(
          { accountId, folder, uid: { $in: uids } },
          { $set: { isPinned: false, pinnedAt: null } },
        );
        break;
    }

    return { affected };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw AppError.unprocessable(
      `Action en masse échouée : ${error instanceof Error ? error.message : 'erreur inconnue'}`,
    );
  } finally {
    imapPool.release(accountId);
  }
}
