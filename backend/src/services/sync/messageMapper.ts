import type { FetchMessageObject, MessageStructureObject } from 'imapflow';
import type { MessageAddress } from '../../models/Message.js';

/**
 * Type d'entrée prêt pour upsert dans la collection Message.
 * `accountId` et `folder` sont fournis par l'appelant (pas par le fetch IMAP).
 */
export interface MessageInput {
  accountId: string;
  folder: string;
  uid: number;
  messageId?: string;
  inReplyTo?: string;
  subject: string;
  from: MessageAddress;
  to: MessageAddress[];
  date: Date;
  flags: { seen: boolean; answered: boolean; flagged: boolean };
  hasAttachments: boolean;
  size: number;
}

/**
 * Parcourt récursivement les parties MIME d'un bodyStructure pour déterminer
 * si au moins une partie a `disposition === 'attachment'`.
 */
function hasAttachmentPart(node: MessageStructureObject | undefined): boolean {
  if (!node) return false;

  if (node.disposition === 'attachment') return true;

  if (node.childNodes) {
    for (const child of node.childNodes) {
      if (hasAttachmentPart(child)) return true;
    }
  }

  return false;
}

/**
 * Mappe un résultat de `client.fetch()` (FetchMessageObject) en objet prêt à upsert.
 * Fonction pure — aucun effet de bord, aucun log (les sujets peuvent être sensibles).
 */
export function mapFetchResultToMessage(
  accountId: string,
  folder: string,
  fetchResult: FetchMessageObject,
): MessageInput {
  const envelope = fetchResult.envelope;
  const flagsSet = fetchResult.flags ?? new Set<string>();

  const fromAddress: MessageAddress = {
    address: envelope?.from?.[0]?.address ?? '',
    ...(envelope?.from?.[0]?.name !== undefined && { name: envelope.from[0].name }),
  };

  const toAddresses: MessageAddress[] = (envelope?.to ?? [])
    .filter((addr) => addr.address !== undefined)
    .map((addr) => ({
      address: addr.address!,
      ...(addr.name !== undefined && { name: addr.name }),
    }));

  return {
    accountId,
    folder,
    uid: fetchResult.uid,
    messageId: envelope?.messageId,
    inReplyTo: envelope?.inReplyTo,
    subject: envelope?.subject ?? '',
    from: fromAddress,
    to: toAddresses,
    date: envelope?.date ?? new Date(0),
    flags: {
      seen: flagsSet.has('\\Seen'),
      answered: flagsSet.has('\\Answered'),
      flagged: flagsSet.has('\\Flagged'),
    },
    hasAttachments: hasAttachmentPart(fetchResult.bodyStructure),
    size: fetchResult.size ?? 0,
  };
}
