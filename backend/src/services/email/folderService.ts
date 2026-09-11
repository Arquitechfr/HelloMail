import type { ImapFlow, ListResponse, StatusObject } from 'imapflow';
import mongoose from 'mongoose';
import type { IAccountDocument } from '../../models/Account.js';
import { FolderModel } from '../../models/Folder.js';
import { AppError } from '../../utils/AppError.js';
import { imapPool } from './imapPool.js';
import { invalidateSpecialFolderCache } from './specialFolders.js';
import { isProtectedFolder } from './folderProtection.js';
import { getFolderSpecialUse } from './folderResolution.js';

export { isProtectedFolder };
// Ré-export des helpers de résolution (implémentés dans folderResolution.ts).
export {
  VIRTUAL_SNOOZED_FOLDER,
  resolveCanonicalFolder,
  folderPathExists,
  resolveMessageFolder,
} from './folderResolution.js';

/** Durée de fraîcheur du cache Folder en base (5 min). */
const FOLDER_CACHE_TTL_MS = 5 * 60 * 1000;

export interface FolderInfo {
  path: string;
  name: string;
  delimiter: string;
  specialUse?: string;
  flags: string[];
  status?: {
    messages: number;
    unseen: number;
    uidNext: number;
  };
}

/**
 * Liste tous les dossiers IMAP d'un compte avec leurs compteurs (si LIST-STATUS supporté).
 *
 * Lit le cache `Folder` en base si frais (< 5 min) — sinon interroge IMAP,
 * met à jour le cache et retourne la liste fraîche.
 */
export async function listFolders(account: IAccountDocument): Promise<FolderInfo[]> {
  const accountId = String(account._id);

  const cached = await readFolderCache(accountId);
  if (cached) {
    return cached;
  }

  const client = await imapPool.acquire(account);

  try {
    const folders = await fetchFoldersFromImap(client);
    await writeFolderCache(accountId, folders);
    return folders;
  } finally {
    imapPool.release(accountId);
  }
}

/**
 * Rafraîchit le cache Folder depuis une connexion IMAP déjà ouverte.
 * Utilisé par le sync worker (après runInitialSyncAll) pour garder le cache
 * chaud sans passer par le pool API.
 */
export async function syncFolderCacheFromClient(
  client: ImapFlow,
  accountId: string,
): Promise<void> {
  const folders = await fetchFoldersFromImap(client);
  await writeFolderCache(accountId, folders);
}

/**
 * Indique si un dossier existe pour ce compte, d'après le cache Folder.
 * Retourne `true` si le cache est vide (inconnu) — dégradation permissive,
 * le comportement historique retournait une liste vide.
 *
 * `INBOX` (toute casse) retourne toujours `true` : c'est un nom réservé
 * garanti par la RFC 3501, même quand le serveur liste la boîte de
 * réception sous un nom localisé (ex. « Boîte de réception » chez Zoho).
 */
export async function folderExists(account: IAccountDocument, path: string): Promise<boolean> {
  if (path.toUpperCase() === 'INBOX') {
    return true;
  }
  if (!dbReady()) {
    return true;
  }
  const paths = await FolderModel.find({ accountId: account._id }).select('path').lean();
  if (paths.length === 0) {
    return true;
  }
  return paths.some((f) => f.path === path);
}

/** Invalide le cache Folder d'un compte (CRUD dossiers). */
async function invalidateFolderCache(accountId: string): Promise<void> {
  if (!dbReady()) return;
  await FolderModel.deleteMany({ accountId });
}

/** MongoDB connectée ? Le cache est ignoré si la base n'est pas disponible. */
function dbReady(): boolean {
  return mongoose.connection.readyState === 1;
}

/** Lit le cache Folder s'il est peuplé et frais. Null sinon. */
async function readFolderCache(accountId: string): Promise<FolderInfo[] | null> {
  if (!dbReady()) {
    return null;
  }
  const freshSince = new Date(Date.now() - FOLDER_CACHE_TTL_MS);
  const docs = await FolderModel.find({ accountId, syncedAt: { $gt: freshSince } }).lean();

  if (docs.length === 0) {
    return null;
  }

  return docs.map((doc) => ({
    path: doc.path,
    name: doc.name,
    delimiter: doc.delimiter,
    specialUse: doc.specialUse,
    flags: doc.flags,
    status: { messages: doc.messages, unseen: doc.unseen, uidNext: doc.uidNext },
  }));
}

/** Fetch la liste des dossiers via IMAP LIST (+ STATUS si supporté). */
async function fetchFoldersFromImap(client: ImapFlow): Promise<FolderInfo[]> {
  const list = await client.list({
    statusQuery: { messages: true, unseen: true, uidNext: true },
  });

  return (list as ListResponse[]).map((folder) => ({
    path: folder.path,
    name: folder.name,
    delimiter: folder.delimiter,
    specialUse: folder.specialUse,
    flags: Array.from(folder.flags),
    status: folder.status
      ? {
          messages: folder.status.messages ?? 0,
          unseen: folder.status.unseen ?? 0,
          uidNext: folder.status.uidNext ?? 0,
        }
      : undefined,
  }));
}

/** Écrit le cache Folder : upsert par path + suppression des paths disparus. */
async function writeFolderCache(accountId: string, folders: FolderInfo[]): Promise<void> {
  if (!dbReady()) {
    return;
  }
  const now = new Date();

  await FolderModel.bulkWrite(
    folders.map((f) => ({
      updateOne: {
        filter: { accountId, path: f.path },
        update: {
          $set: {
            name: f.name,
            delimiter: f.delimiter,
            specialUse: f.specialUse,
            flags: f.flags,
            messages: f.status?.messages ?? 0,
            unseen: f.status?.unseen ?? 0,
            uidNext: f.status?.uidNext ?? 0,
            syncedAt: now,
          },
        },
        upsert: true,
      },
    })),
  );

  // Supprime les dossiers qui n'existent plus côté IMAP.
  await FolderModel.deleteMany({
    accountId,
    path: { $nin: folders.map((f) => f.path) },
  });
}

/**
 * Crée un nouveau dossier IMAP.
 */
export async function createFolder(account: IAccountDocument, path: string): Promise<void> {
  const accountId = String(account._id);
  const client = await imapPool.acquire(account);

  try {
    await client.mailboxCreate(path);
    // Invalide les caches (le nouveau dossier pourrait être un dossier spécial).
    invalidateSpecialFolderCache(accountId);
    await invalidateFolderCache(accountId);
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('already exists')) {
      throw AppError.conflict('Ce dossier existe déjà');
    }
    throw AppError.unprocessable(
      `Création du dossier échouée : ${error instanceof Error ? error.message : 'erreur inconnue'}`,
    );
  } finally {
    imapPool.release(accountId);
  }
}



/**
 * Renomme un dossier IMAP.
 */
export async function renameFolder(
  account: IAccountDocument,
  path: string,
  newPath: string,
): Promise<void> {
  const specialUse = await getFolderSpecialUse(String(account._id), path);
  if (isProtectedFolder(path, specialUse)) {
    throw AppError.forbidden(`Le dossier système « ${path} » est protégé et ne peut pas être renommé`);
  }
  if (isProtectedFolder(newPath)) {
    throw AppError.forbidden(`Impossible de renommer vers un nom de dossier système protégé (« ${newPath} »)`);
  }

  const accountId = String(account._id);
  const client = await imapPool.acquire(account);

  try {
    await client.mailboxRename(path, newPath);
    // Invalide les caches (le renommage peut affecter un dossier spécial).
    invalidateSpecialFolderCache(accountId);
    await invalidateFolderCache(accountId);

    if (dbReady()) {
      const { MessageModel } = await import('../../models/Message.js');
      await MessageModel.updateMany(
        { accountId: account._id, folder: path },
        { $set: { folder: newPath } },
      );
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof Error && /not found|n'existe pas/i.test(error.message)) {
      throw AppError.notFound('Dossier introuvable');
    }
    throw AppError.unprocessable(
      `Renommage du dossier échoué : ${error instanceof Error ? error.message : 'erreur inconnue'}`,
    );
  } finally {
    imapPool.release(accountId);
  }
}

/**
 * Supprime un dossier IMAP.
 */
export async function deleteFolder(account: IAccountDocument, path: string): Promise<void> {
  const specialUse = await getFolderSpecialUse(String(account._id), path);
  if (isProtectedFolder(path, specialUse)) {
    throw AppError.forbidden(`Le dossier système « ${path} » est protégé et ne peut pas être supprimé`);
  }

  const accountId = String(account._id);
  const client = await imapPool.acquire(account);

  try {
    await client.mailboxDelete(path);
    // Invalide les caches (la suppression peut affecter un dossier spécial).
    invalidateSpecialFolderCache(accountId);
    await invalidateFolderCache(accountId);

    if (dbReady()) {
      const { MessageModel } = await import('../../models/Message.js');
      const { MessageBodyModel } = await import('../../models/MessageBody.js');
      const { FolderSyncStateModel } = await import('../../models/FolderSyncState.js');

      await Promise.all([
        MessageModel.deleteMany({ accountId: account._id, folder: path }),
        MessageBodyModel.deleteMany({ accountId, folder: path }),
        FolderSyncStateModel.deleteOne({ accountId, folder: path }),
      ]);
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof Error && /not found|n'existe pas/i.test(error.message)) {
      throw AppError.notFound('Dossier introuvable');
    }
    throw AppError.unprocessable(
      `Suppression du dossier échouée : ${error instanceof Error ? error.message : 'erreur inconnue'}`,
    );
  } finally {
    imapPool.release(accountId);
  }
}


/**
 * Récupère les compteurs d'un dossier (messages, non lus, prochain UID).
 */
export async function getFolderStatus(
  account: IAccountDocument,
  path: string,
): Promise<{ messages: number; unseen: number; uidNext: number }> {
  const accountId = String(account._id);
  const client = await imapPool.acquire(account);

  try {
    const status = (await client.status(path, {
      messages: true,
      unseen: true,
      uidNext: true,
    })) as StatusObject;

    return {
      messages: status.messages ?? 0,
      unseen: status.unseen ?? 0,
      uidNext: status.uidNext ?? 0,
    };
  } finally {
    imapPool.release(accountId);
  }
}

/**
 * Recherche le dossier avec un specialUse donné (ex: \\Trash, \\Sent).
 * Retourne le path ou null si non trouvé.
 */
export async function findSpecialUseFolder(
  account: IAccountDocument,
  specialUse: string,
): Promise<string | null> {
  const folders = await listFolders(account);
  const found = folders.find((f) => f.specialUse === specialUse);
  return found?.path ?? null;
}
