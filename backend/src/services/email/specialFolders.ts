import type { IAccountDocument } from '../../models/Account.js';
import { listFolders } from './folderService.js';

/**
 * Dossiers spéciaux IMAP (RFC 6154 SPECIAL-USE).
 *
 * Chaque entrée associe un flag specialUse à une liste de noms de fallback
 * courants (insensibles à la casse) utilisés si aucun dossier n'a le flag.
 */
const SPECIAL_FOLDER_FALLBACKS: Record<string, string[]> = {
  '\\Sent': ['sent', 'sent items', 'sent mail', 'envoyés', 'envoye', 'outbox'],
  '\\Trash': ['trash', 'corbeille', 'deleted', 'deleted items', 'bin'],
  '\\Drafts': ['drafts', 'brouillons', 'brouillon'],
  '\\Junk': ['junk', 'spam', 'junk mail', 'junk email', 'courrier indésirable', 'indésirables'],
  '\\Archive': ['archive', 'archives', 'archivés'],
};

/** Durée de validité du cache par compte (ms). */
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  folders: Map<string, string | null>; // specialUse → path (ou null si non trouvé)
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * Normalise un chemin de dossier pour la comparaison (minuscules, trim).
 */
function normalizePath(path: string): string {
  return path.toLowerCase().trim();
}

/**
 * Résout le chemin d'un dossier spécial pour un compte.
 *
 * Stratégie :
 * 1. Cherche un dossier avec le flag `specialUse` correspondant.
 * 2. Si non trouvé, cherche un dossier dont le nom (insensible à la casse)
 *    matche un des fallbacks connus.
 * 3. Si toujours non trouvé, retourne null.
 *
 * Le résultat est mis en cache par compte pendant CACHE_TTL_MS pour éviter
 * un appel `list()` à chaque opération.
 */
export async function findSpecialFolder(
  account: IAccountDocument,
  specialUse: string,
): Promise<string | null> {
  const accountId = String(account._id);
  const now = Date.now();

  // Vérifie le cache.
  let entry = cache.get(accountId);
  if (!entry || entry.expiresAt < now) {
    entry = { folders: new Map(), expiresAt: now + CACHE_TTL_MS };
    cache.set(accountId, entry);
  }

  // Vérifie si ce specialUse est déjà résolu dans le cache.
  if (entry.folders.has(specialUse)) {
    return entry.folders.get(specialUse) ?? null;
  }

  // Résout via listFolders.
  const folders = await listFolders(account);

  // 1. Recherche par flag specialUse — remplit le cache pour tous les
  //    specialUse connus trouvés dans cette liste (optimisation : un seul
  //    appel listFolders résout tous les specialUse d'un coup).
  const knownFlags = Object.keys(SPECIAL_FOLDER_FALLBACKS);
  for (const flag of knownFlags) {
    const byFlag = folders.find((f) => f.specialUse === flag);
    if (byFlag) {
      entry.folders.set(flag, byFlag.path);
    }
  }

  // Vérifie si le specialUse demandé a été résolu par les flags.
  if (entry.folders.has(specialUse)) {
    return entry.folders.get(specialUse) ?? null;
  }

  // 2. Recherche par nom de fallback pour le specialUse demandé.
  const fallbacks = SPECIAL_FOLDER_FALLBACKS[specialUse] ?? [];
  const byName = folders.find((f) => fallbacks.includes(normalizePath(f.path)));

  const result = byName?.path ?? null;
  entry.folders.set(specialUse, result);
  return result;
}

/**
 * Raccourcis typés pour chaque dossier spécial.
 */
export function findSentFolder(account: IAccountDocument): Promise<string | null> {
  return findSpecialFolder(account, '\\Sent');
}

export function findTrashFolder(account: IAccountDocument): Promise<string | null> {
  return findSpecialFolder(account, '\\Trash');
}

export function findDraftsFolder(account: IAccountDocument): Promise<string | null> {
  return findSpecialFolder(account, '\\Drafts');
}

export function findJunkFolder(account: IAccountDocument): Promise<string | null> {
  return findSpecialFolder(account, '\\Junk');
}

export function findArchiveFolder(account: IAccountDocument): Promise<string | null> {
  return findSpecialFolder(account, '\\Archive');
}

/**
 * Invalide le cache pour un compte (à appeler après création/renommage/suppression
 * de dossiers pour forcer une résolution fraîche).
 */
export function invalidateSpecialFolderCache(accountId: string): void {
  cache.delete(accountId);
}

/**
 * Invalide tous les caches (utile au shutdown ou en test).
 */
export function clearAllSpecialFolderCaches(): void {
  cache.clear();
}
