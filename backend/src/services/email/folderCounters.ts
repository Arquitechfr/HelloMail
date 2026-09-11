import mongoose from 'mongoose';
import { FolderModel } from '../../models/Folder.js';
import { logger } from '../../config/logger.js';

/**
 * Ajustement incrémental des compteurs du cache Folder (messages/unseen).
 *
 * Le badge « non lus » de l'arbre de dossiers lit `Folder.status` servi depuis
 * ce cache (TTL 5 min). Sans ajustement, chaque action (suppression, déplacement,
 * marquage lu/non-lu) laisse le compteur périmé jusqu'au prochain LIST+STATUS.
 *
 * Mises à jour best-effort : aucun throw, aucun upsert (un doc absent est
 * ignoré — le prochain refresh IMAP réécrit les valeurs serveur exactes).
 * `syncedAt` n'est pas touché : le TTL continue de forcer un refresh périodique
 * qui corrige toute dérive éventuelle.
 */

function dbReady(): boolean {
  return mongoose.connection.readyState === 1;
}

/**
 * Applique un delta relatif aux compteurs d'un dossier, plafonné à 0.
 * No-op si le doc n'existe pas ou si les deux deltas sont nuls.
 */
export async function adjustFolderCounters(
  accountId: string,
  path: string,
  deltas: { messagesDelta?: number; unseenDelta?: number },
): Promise<void> {
  if (!dbReady()) return;

  const { messagesDelta = 0, unseenDelta = 0 } = deltas;
  if (messagesDelta === 0 && unseenDelta === 0) return;

  try {
    const set: Record<string, unknown> = {};
    if (messagesDelta !== 0) {
      set.messages = { $max: [0, { $add: [{ $ifNull: ['$messages', 0] }, messagesDelta] }] };
    }
    if (unseenDelta !== 0) {
      set.unseen = { $max: [0, { $add: [{ $ifNull: ['$unseen', 0] }, unseenDelta] }] };
    }
    await FolderModel.updateOne({ accountId, path }, [{ $set: set }], { updatePipeline: true });
  } catch (error) {
    logger.debug(
      { accountId, path, error: error instanceof Error ? error.message : 'erreur inconnue' },
      'Ajustement compteurs dossier échoué (non bloquant)',
    );
  }
}

/**
 * Écrit des valeurs absolues de compteurs quand elles sont connues
 * (ex. `mailbox.exists` après `mailboxOpen`). No-op si le doc n'existe pas.
 */
export async function setFolderCounts(
  accountId: string,
  path: string,
  counts: { messages?: number; unseen?: number },
): Promise<void> {
  if (!dbReady()) return;

  const set: Record<string, number> = {};
  if (counts.messages !== undefined) set.messages = Math.max(0, counts.messages);
  if (counts.unseen !== undefined) set.unseen = Math.max(0, counts.unseen);
  if (Object.keys(set).length === 0) return;

  try {
    await FolderModel.updateOne({ accountId, path }, { $set: set });
  } catch (error) {
    logger.debug(
      { accountId, path, error: error instanceof Error ? error.message : 'erreur inconnue' },
      'Écriture compteurs dossier échouée (non bloquant)',
    );
  }
}
