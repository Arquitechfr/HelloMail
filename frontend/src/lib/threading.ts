import type { Message } from "./api-types";

export interface ThreadGroup {
  threadId: string;
  rootMessage: Message;
  messages: Message[];
  count: number;
  hasUnread: boolean;
  isPinned: boolean;
  isFlagged: boolean;
}

/**
 * Normalise un sujet d'email en supprimant les préfixes de réponse et transfert usuels.
 */
export function normalizeSubject(subject: string): string {
  if (!subject) return "";
  return subject
    .replace(/^((re|fwd|fw|tr|aw|sv|vs)\s*:\s*)+/gi, "")
    .trim()
    .toLowerCase();
}

/**
 * Regroupe une liste de messages par fil de discussion (conversation).
 * Associe les messages par messageId / inReplyTo et par sujet normalisé.
 * Préserve l'ordre chronologique décroissant (le message le plus récent représente la conversation).
 */
export function groupMessagesIntoThreads(messages: Message[]): ThreadGroup[] {
  if (!messages || messages.length === 0) {
    return [];
  }

  // Map : normalizedSubject ou messageId -> ThreadGroup temporaire
  const threadMap = new Map<string, Message[]>();
  const idToThreadKey = new Map<string, string>();

  // 1. Première passe : associe les identifiants messageId et inReplyTo
  for (const msg of messages) {
    const normSubj = normalizeSubject(msg.subject);
    let threadKey = "";

    if (msg.inReplyTo && idToThreadKey.has(msg.inReplyTo)) {
      threadKey = idToThreadKey.get(msg.inReplyTo)!;
    } else if (normSubj) {
      threadKey = `subj:${normSubj}`;
    } else if (msg.messageId) {
      threadKey = `id:${msg.messageId}`;
    } else {
      threadKey = `uid:${msg.folder}:${msg.uid}`;
    }

    if (msg.messageId) {
      idToThreadKey.set(msg.messageId, threadKey);
    }
    if (msg.inReplyTo && !idToThreadKey.has(msg.inReplyTo)) {
      idToThreadKey.set(msg.inReplyTo, threadKey);
    }

    const group = threadMap.get(threadKey);
    if (group) {
      group.push(msg);
    } else {
      threadMap.set(threadKey, [msg]);
    }
  }

  const result: ThreadGroup[] = [];

  // 2. Deuxième passe : construction des ThreadGroup avec tri et métadonnées
  for (const [threadId, groupMessages] of threadMap.entries()) {
    // Tri chronologique décroissant pour trouver le message le plus récent
    groupMessages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const rootMessage = groupMessages[0];

    const hasUnread = groupMessages.some((m) => !m.flags.seen);
    const isPinned = groupMessages.some((m) => Boolean(m.isPinned));
    const isFlagged = groupMessages.some((m) => m.flags.flagged);

    result.push({
      threadId,
      rootMessage,
      messages: groupMessages,
      count: groupMessages.length,
      hasUnread,
      isPinned,
      isFlagged,
    });
  }

  // 3. Tri final des conversations : épinglés en tête, puis date décroissante
  result.sort((a, b) => {
    if (a.isPinned !== b.isPinned) {
      return a.isPinned ? -1 : 1;
    }
    return new Date(b.rootMessage.date).getTime() - new Date(a.rootMessage.date).getTime();
  });

  return result;
}
