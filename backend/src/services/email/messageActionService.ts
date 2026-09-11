import type { ImapFlow } from 'imapflow';
import type { IAccountDocument } from '../../models/Account.js';
import { AppError } from '../../utils/AppError.js';
import { imapPool } from './imapPool.js';
import { MessageModel } from '../../models/Message.js';
import { MessageBodyModel } from '../../models/MessageBody.js';
import { findTrashFolder, findJunkFolder, invalidateSpecialFolderCache } from './specialFolders.js';
import { invalidateFolderCache } from './folderService.js';
import { adjustFolderCounters } from './folderCounters.js';
import {
  safeMoveMessages,
  resolveDestinationUids,
  relocateLocalMessage,
} from './messageRelocation.js';
import { publishEvent } from '../realtime/eventPublisher.js';
import type { RelocatableMessage } from './messageRelocation.js';

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
 * Publie un événement SSE silencieux après une suppression/déplacement
 * initié par l'API — rafraîchit les autres sessions/onglets du même
 * utilisateur. Best-effort : aucune erreur ne remonte.
 */
function publishFolderChanged(account: IAccountDocument, folder: string, uids: number[]): void {
  const accountId = String(account._id);
  publishEvent({
    type: 'message:deleted',
    accountId,
    userId: String(account.userId),
    payload: { folder, uids },
  }).catch(() => {});
}

/**
 * Résout le dossier Corbeille : specialUse + fallbacks, et si rien n'existe,
 * tente de créer « Trash » (comportement standard des clients mail) avant de
 * retomber sur le nom littéral — le move décidera si le serveur refuse.
 */
async function resolveTrashPath(
  client: ImapFlow,
  account: IAccountDocument,
): Promise<string> {
  const existing = await findTrashFolder(account);
  if (existing) return existing;

  const accountId = String(account._id);
  try {
    await client.mailboxCreate('Trash');
    invalidateSpecialFolderCache(accountId);
    await invalidateFolderCache(accountId);
  } catch {
    // Le dossier existe peut-être déjà ou le serveur refuse la création.
  }
  return 'Trash';
}

/**
 * Déplace des messages IMAP vers `destFolder` puis relocalise les documents
 * locaux (nouveau folder + nouvel UID) au lieu de les supprimer : la vue
 * destination affiche les messages immédiatement, sans attendre le polling.
 * Met à jour les compteurs du cache Folder (source et destination).
 */
async function moveWithTracking(params: {
  account: IAccountDocument;
  client: ImapFlow;
  sourceFolder: string;
  uids: number[];
  destFolder: string;
  errorLabel: string;
  /** Range IMAP à passer à MOVE — par défaut uid seul si unique, sinon tableau. */
  range?: number | number[];
}): Promise<void> {
  const { account, client, sourceFolder, uids, destFolder, errorLabel } = params;
  const range = params.range ?? (uids.length === 1 ? uids[0] : uids);
  const accountId = String(account._id);

  // Docs locaux : _id (relocalisation), messageId (fallback de résolution UID),
  // flags.seen (deltas de compteurs).
  const docs = (await MessageModel.find({
    accountId,
    folder: sourceFolder,
    uid: { $in: uids },
  })
    .select('_id uid messageId flags.seen')
    .lean()) as RelocatableMessage[];

  const moveResult = await safeMoveMessages(client, range, destFolder, errorLabel);

  const destUidMap = await resolveDestinationUids(client, destFolder, docs, moveResult);

  let unreadMoved = 0;
  for (const doc of docs) {
    const destUid = destUidMap.get(doc.uid);
    if (destUid) {
      await relocateLocalMessage(accountId, sourceFolder, doc, destFolder, destUid);
    } else {
      // UID destination inconnu → suppression locale ; le polling rattrape.
      await MessageModel.deleteOne({ _id: doc._id });
      await deleteCachedBody(accountId, sourceFolder, doc.uid);
    }
    if (doc.flags?.seen === false) unreadMoved++;
  }

  await adjustFolderCounters(accountId, sourceFolder, {
    messagesDelta: -uids.length,
    unseenDelta: -unreadMoved,
  });
  await adjustFolderCounters(accountId, destFolder, {
    messagesDelta: uids.length,
    unseenDelta: unreadMoved,
  });

  publishFolderChanged(account, sourceFolder, uids);
}

/**
 * Suppression permanente côté IMAP + purge locale + compteurs.
 */
async function deletePermanently(
  account: IAccountDocument,
  client: ImapFlow,
  folder: string,
  uids: number[],
  errorLabel: string,
  range?: number | number[],
): Promise<void> {
  const accountId = String(account._id);
  const docs = await MessageModel.find({ accountId, folder, uid: { $in: uids } })
    .select('flags.seen')
    .lean();

  const result = await client.messageDelete(range ?? (uids.length === 1 ? uids[0] : uids), { uid: true });
  if (result === false) {
    throw AppError.unprocessable(`${errorLabel} : le serveur a refusé la suppression`);
  }

  await MessageModel.deleteMany({ accountId, folder, uid: { $in: uids } });
  await Promise.all(uids.map((uid) => deleteCachedBody(accountId, folder, uid)));

  const unreadDeleted = docs.filter((d) => d.flags?.seen === false).length;
  await adjustFolderCounters(accountId, folder, {
    messagesDelta: -uids.length,
    unseenDelta: -unreadDeleted,
  });

  publishFolderChanged(account, folder, uids);
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

    // État « lu » antérieur pour ajuster le compteur unseen du dossier.
    let prevSeen: boolean | undefined;
    if (flags.seen !== undefined) {
      const doc = await MessageModel.findOne({ accountId, folder, uid })
        .select('flags.seen')
        .lean();
      prevSeen = doc?.flags?.seen;
    }

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

    if (flags.seen !== undefined && prevSeen !== undefined && prevSeen !== flags.seen) {
      await adjustFolderCounters(accountId, folder, {
        unseenDelta: flags.seen ? -1 : 1,
      });
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
 * Supprime un message. Par défaut, déplace vers Trash. Si permanent=true — ou
 * si le message est déjà dans la Corbeille — supprime définitivement.
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

    const trashPath = await resolveTrashPath(client, account);

    if (permanent || folder.toLowerCase() === trashPath.toLowerCase()) {
      await deletePermanently(account, client, folder, [uid], 'Suppression du message échouée');
      return;
    }

    await moveWithTracking({
      account,
      client,
      sourceFolder: folder,
      uids: [uid],
      destFolder: trashPath,
      errorLabel: 'Suppression du message échouée',
    });
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
    if (destination === folder) return;

    await client.mailboxOpen(folder, { readOnly: false });
    await moveWithTracking({
      account,
      client,
      sourceFolder: folder,
      uids: [uid],
      destFolder: destination,
      errorLabel: 'Déplacement du message échoué',
    });
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
 * No-op si le message est déjà dans le dossier Junk.
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

    if (folder.toLowerCase() === junkPath.toLowerCase()) return;

    await moveWithTracking({
      account,
      client,
      sourceFolder: folder,
      uids: [uid],
      destFolder: junkPath,
      errorLabel: 'Marquage comme spam échoué',
    });
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
      case 'markRead': {
        const docs = await MessageModel.find({ accountId, folder, uid: { $in: uids }, 'flags.seen': false })
          .select('_id')
          .lean();
        await client.messageFlagsAdd(uids, ['\\Seen'], { uid: true });
        affected = uids.length;
        await MessageModel.updateMany(
          { accountId, folder, uid: { $in: uids } },
          { $set: { 'flags.seen': true } },
        );
        await adjustFolderCounters(accountId, folder, { unseenDelta: -docs.length });
        break;
      }

      case 'markUnread': {
        const docs = await MessageModel.find({ accountId, folder, uid: { $in: uids }, 'flags.seen': true })
          .select('_id')
          .lean();
        await client.messageFlagsRemove(uids, ['\\Seen'], { uid: true });
        affected = uids.length;
        await MessageModel.updateMany(
          { accountId, folder, uid: { $in: uids } },
          { $set: { 'flags.seen': false } },
        );
        await adjustFolderCounters(accountId, folder, { unseenDelta: docs.length });
        break;
      }

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
        const trashPath = await resolveTrashPath(client, account);
        affected = uids.length;
        if (folder.toLowerCase() === trashPath.toLowerCase()) {
          await deletePermanently(account, client, folder, uids, 'Action en masse échouée', uids);
        } else {
          await moveWithTracking({
            account,
            client,
            sourceFolder: folder,
            uids,
            destFolder: trashPath,
            errorLabel: 'Action en masse échouée',
            range: uids,
          });
        }
        break;
      }

      case 'markAsJunk': {
        const junkPath = (await findJunkFolder(account)) ?? 'Junk';
        affected = uids.length;
        if (folder.toLowerCase() !== junkPath.toLowerCase()) {
          await moveWithTracking({
            account,
            client,
            sourceFolder: folder,
            uids,
            destFolder: junkPath,
            errorLabel: 'Action en masse échouée',
            range: uids,
          });
        }
        break;
      }

      case 'move': {
        if (!destination) {
          throw AppError.badRequest('Dossier de destination requis pour l\'action move');
        }
        affected = uids.length;
        if (destination !== folder) {
          await moveWithTracking({
            account,
            client,
            sourceFolder: folder,
            uids,
            destFolder: destination,
            errorLabel: 'Action en masse échouée',
            range: uids,
          });
        }
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
