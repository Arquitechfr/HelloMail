import mongoose from 'mongoose';
import { FolderModel } from '../../models/Folder.js';
import { MessageModel } from '../../models/Message.js';

/**
 * Résolution des chemins de dossiers IMAP vers leur nom canonique en base.
 *
 * Certains serveurs localisent les noms de dossiers (ex. Zoho liste la boîte
 * de réception « Boîte de réception » avec le flag `\Inbox`, Infomaniak liste
 * `INBOX`). La sync stocke toujours les messages sous le nom canonique
 * `'INBOX'` — ces helpers traduisent les alias côté API.
 */

/**
 * Clé du dossier virtuel « En sommeil » — ne peut jamais entrer en conflit
 * avec un vrai dossier IMAP (certains serveurs, ex. Zoho, ont un dossier
 * réel nommé « Snoozed »).
 */
export const VIRTUAL_SNOOZED_FOLDER = '__snoozed__';
export const VIRTUAL_REMINDERS_FOLDER = '__reminders__';

function dbReady(): boolean {
  return mongoose.connection.readyState === 1;
}

/**
 * Résout un nom de dossier demandé vers son nom canonique en base.
 *
 * Tout alias de la boîte de réception — « INBOX » quelle que soit la casse,
 * ou le path listé portant le flag `\Inbox` (ex. « Boîte de réception ») —
 * est canonicalisé en `'INBOX'`, le nom sous lequel la sync stocke les
 * messages. Les autres dossiers sont retournés tels quels.
 */
export async function resolveCanonicalFolder(
  accountId: string,
  requestedPath: string,
): Promise<string> {
  if (requestedPath.toUpperCase() === 'INBOX') {
    return 'INBOX';
  }
  if (!dbReady()) {
    return requestedPath;
  }
  const doc = await FolderModel.findOne({ accountId, path: requestedPath })
    .select('specialUse')
    .lean();
  if (doc?.specialUse?.toLowerCase() === '\\inbox') {
    return 'INBOX';
  }
  return requestedPath;
}

/**
 * Indique si un path correspond à un dossier réellement listé par le
 * serveur (cache Folder). Strict — pas de dégradation permissive :
 * utilisé pour désambiguer un nom de dossier virtuel d'un vrai dossier.
 */
export async function folderPathExists(accountId: string, path: string): Promise<boolean> {
  if (!dbReady()) {
    return false;
  }
  return Boolean(await FolderModel.exists({ accountId, path }));
}

/**
 * Récupère le flag `specialUse` d'un dossier depuis le cache Folder.
 * Permet de protéger les dossiers système dont le nom est localisé
 * (ex. « Boîte de réception » porte `\Inbox` chez Zoho).
 */
export async function getFolderSpecialUse(
  accountId: string,
  path: string,
): Promise<string | undefined> {
  if (!dbReady()) {
    return undefined;
  }
  const doc = await FolderModel.findOne({ accountId, path })
    .select('specialUse')
    .lean();
  return doc?.specialUse;
}

/**
 * Résout le dossier réel d'un message quand la requête vient de la vue
 * virtuelle « En sommeil » (`__snoozed__`, ou « Snoozed » sans dossier
 * réel correspondant). Ce path n'existe pas côté IMAP — lecture, flags,
 * move, etc. doivent cibler le dossier où le message est stocké.
 */
export async function resolveMessageFolder(
  accountId: string,
  folder: string,
  uid: number,
): Promise<string> {
  if (
    folder !== VIRTUAL_SNOOZED_FOLDER &&
    folder !== VIRTUAL_REMINDERS_FOLDER &&
    folder !== 'Snoozed'
  ) {
    return folder;
  }
  if (!dbReady()) {
    return folder;
  }
  // Le dossier demandé contient l'UID → c'est un vrai dossier IMAP
  // (ex. « Snoozed » chez Zoho) — pas de résolution nécessaire.
  if (await MessageModel.exists({ accountId, folder, uid })) {
    return folder;
  }
  const doc = await MessageModel.findOne({
    accountId,
    uid,
  })
    .select('folder')
    .lean();
  return doc?.folder ?? folder;
}
