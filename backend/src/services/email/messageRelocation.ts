import type { ImapFlow } from 'imapflow';
import type { Types } from 'mongoose';
import { MessageModel } from '../../models/Message.js';
import { MessageBodyModel } from '../../models/MessageBody.js';
import { AppError } from '../../utils/AppError.js';
import { logger } from '../../config/logger.js';

/**
 * Helpers de déplacement de messages avec suivi local immédiat.
 *
 * Problèmes adressés :
 * - `client.messageMove`/`messageCopy` d'ImapFlow retournent `false` au lieu de
 *   throw quand la commande échoue (ex. destination inexistante) — le résultat
 *   doit être vérifié, sinon la base locale supprime un message encore présent
 *   sur le serveur.
 * - Le fallback interne d'ImapFlow pour les serveurs sans extension MOVE fait
 *   `COPY` + `STORE \Deleted` + `EXPUNGE` **même si le COPY a échoué** — une
 *   suppression définitive sans passage par la corbeille. On fait donc le
 *   copy/delete nous-mêmes dans ce cas, avec vérification entre les deux.
 * - Le déplacement IMAP donne un nouvel UID dans le dossier destination. Sans
 *   mise à jour locale, le message déplacé n'apparaît dans la vue destination
 *   qu'au prochain polling (~60 s). On relocalise le document dès que l'UID
 *   destination est connu (COPYUID/uidMap, sinon correspondance par Message-ID).
 */

/** Document minimal nécessaire à la relocalisation. */
export interface RelocatableMessage {
  _id: Types.ObjectId;
  uid: number;
  messageId?: string;
  flags?: { seen?: boolean };
}

interface MoveResult {
  uidMap?: Map<number, number>;
}

function asMoveResult(result: unknown): MoveResult | null {
  if (result && typeof result === 'object') {
    return result as MoveResult;
  }
  return null;
}

/**
 * Déplace des messages IMAP vers `destination` en garantissant qu'un échec
 * lève une erreur au lieu d'être avalé (ImapFlow retourne `false`).
 *
 * Sur les serveurs sans extension MOVE, exécute COPY → vérification →
 * DELETE manuellement : la suppression n'est jamais tentée si la copie a
 * échoué (contrairement au fallback interne d'ImapFlow).
 *
 * @returns le résultat du déplacement (peut contenir `uidMap` source→dest).
 */
export async function safeMoveMessages(
  client: ImapFlow,
  range: number | number[] | string,
  destination: string,
  errorLabel: string,
): Promise<MoveResult | null> {
  // Même logique que tools.hasCapability('MOVE') : MOVE est pliée dans
  // IMAP4rev2 (RFC 9051) même sans capability explicite.
  const caps = (client as { capabilities?: Map<string, unknown> }).capabilities;
  const enabled = (client as { enabled?: Set<string> }).enabled;
  const supportsMove =
    !(caps instanceof Map) ||
    caps.has('MOVE') ||
    Boolean(
      enabled?.has('IMAP4REV2') ||
        (caps.has('IMAP4rev2') && !caps.has('IMAP4rev1')),
    );

  if (supportsMove) {
    const result = await client.messageMove(range, destination, { uid: true });
    if (!result) {
      throw AppError.unprocessable(`${errorLabel} : le serveur a refusé le déplacement vers « ${destination} »`);
    }
    return asMoveResult(result);
  }

  // Serveur sans extension MOVE : copy + delete manuel et vérifié.
  const copyResult = await client.messageCopy(range, destination, { uid: true });
  if (!copyResult) {
    throw AppError.unprocessable(`${errorLabel} : la copie vers « ${destination} » a échoué`);
  }
  await client.messageDelete(range, { uid: true });
  return asMoveResult(copyResult);
}

/**
 * Résout les UID de destination après un déplacement.
 *
 * 1. `uidMap` du résultat (COPYUID — extension UIDPLUS, quasi universelle).
 * 2. Fallback : fetch des N derniers messages de la destination et
 *    correspondance par `envelope.messageId`.
 *
 * @returns Map uidSource → uidDest (peut être partielle ou vide).
 */
export async function resolveDestinationUids(
  client: ImapFlow,
  destPath: string,
  sourceDocs: RelocatableMessage[],
  moveResult: MoveResult | null,
  options: { fetchFallback?: boolean } = {},
): Promise<Map<number, number>> {
  const mapping = new Map<number, number>();

  const uidMap = moveResult?.uidMap;
  if (uidMap instanceof Map && uidMap.size > 0) {
    for (const doc of sourceDocs) {
      const destUid = uidMap.get(doc.uid);
      if (typeof destUid === 'number') mapping.set(doc.uid, destUid);
    }
    return mapping;
  }

  // Fallback sans COPYUID : le serveur append les messages déplacés en fin de
  // mailbox → les N derniers. Correspondance par Message-ID pour fiabiliser.
  // Désactivable : sur la connexion IDLE du worker, mailboxOpen changerait le
  // dossier sélectionné (INBOX) et casserait le contexte temps réel.
  if (options.fetchFallback === false) return mapping;

  const wanted = sourceDocs.filter((d) => d.messageId);
  if (wanted.length === 0) return mapping;

  try {
    const mailbox = await client.mailboxOpen(destPath, { readOnly: true });
    const exists = Number(mailbox.exists ?? 0);
    if (exists === 0) return mapping;

    const start = Math.max(1, exists - wanted.length + 1);
    const byMessageId = new Map(wanted.map((d) => [d.messageId as string, d.uid]));

    for await (const msg of client.fetch(`${start}:${exists}`, { uid: true, envelope: true })) {
      const msgId = msg.envelope?.messageId;
      const sourceUid = msgId ? byMessageId.get(msgId) : undefined;
      if (sourceUid !== undefined && msg.uid) {
        mapping.set(sourceUid, msg.uid);
      }
    }
  } catch (error) {
    logger.debug(
      { destPath, error: error instanceof Error ? error.message : 'erreur inconnue' },
      'Résolution UID destination impossible (non bloquant)',
    );
  }

  return mapping;
}

/**
 * Relocalise un document Message vers le dossier destination avec son nouvel
 * UID, et déplace le cache corps associé. Remplace l'ancien `deleteOne` : la
 * vue destination affiche le message immédiatement, sans attendre le polling.
 */
export async function relocateLocalMessage(
  accountId: string,
  sourceFolder: string,
  doc: RelocatableMessage,
  destFolder: string,
  destUid: number,
): Promise<void> {
  await MessageModel.updateOne(
    { _id: doc._id },
    { $set: { folder: destFolder, uid: destUid } },
  );
  await MessageBodyModel.updateOne(
    { accountId, folder: sourceFolder, uid: doc.uid },
    { $set: { folder: destFolder, uid: destUid } },
  ).catch(() => {});
}
