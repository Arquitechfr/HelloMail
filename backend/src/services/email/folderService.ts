import type { ImapFlow, ListResponse, StatusObject } from 'imapflow';
import type { IAccountDocument } from '../../models/Account.js';
import { AppError } from '../../utils/AppError.js';
import { imapPool } from './imapPool.js';
import { invalidateSpecialFolderCache } from './specialFolders.js';

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
 */
export async function listFolders(account: IAccountDocument): Promise<FolderInfo[]> {
  const accountId = String(account._id);
  const client = await imapPool.acquire(account);

  try {
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
  } finally {
    imapPool.release(accountId);
  }
}

/**
 * Crée un nouveau dossier IMAP.
 */
export async function createFolder(account: IAccountDocument, path: string): Promise<void> {
  const accountId = String(account._id);
  const client = await imapPool.acquire(account);

  try {
    await client.mailboxCreate(path);
    // Invalide le cache des dossiers spéciaux (le nouveau dossier pourrait être un dossier spécial).
    invalidateSpecialFolderCache(accountId);
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
  const accountId = String(account._id);
  const client = await imapPool.acquire(account);

  try {
    await client.mailboxRename(path, newPath);
    // Invalide le cache (le renommage peut affecter un dossier spécial).
    invalidateSpecialFolderCache(accountId);
  } catch (error) {
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
  const accountId = String(account._id);
  const client = await imapPool.acquire(account);

  try {
    await client.mailboxDelete(path);
    // Invalide le cache (la suppression peut affecter un dossier spécial).
    invalidateSpecialFolderCache(accountId);
  } catch (error) {
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
