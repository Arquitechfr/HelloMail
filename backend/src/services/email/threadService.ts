import mongoose from 'mongoose';
import { MessageModel, type IMessageDocument } from '../../models/Message.js';
import { AppError } from '../../utils/AppError.js';

export function normalizeSubject(subject: string): string {
  if (!subject) return '';
  return subject
    .replace(/^((re|fwd|fw|tr|aw)\s*:\s*)+/gi, '')
    .trim();
}

export interface ThreadItem {
  uid: number;
  folder: string;
  messageId?: string;
  inReplyTo?: string;
  subject: string;
  from: { name?: string; address: string };
  to: { name?: string; address: string }[];
  date: Date;
  flags: { seen: boolean; answered: boolean; flagged: boolean };
  hasAttachments: boolean;
  size: number;
}

export interface ThreadResponse {
  conversationSubject: string;
  count: number;
  messages: ThreadItem[];
}

/**
 * Récupère tous les messages appartenant au même fil de discussion pour un compte.
 * Combine les relations explicites (messageId / inReplyTo) et le regroupement par sujet normalisé.
 */
export async function getConversationThread(
  accountId: string,
  folder: string,
  uid: number,
): Promise<ThreadResponse> {
  const accountObjId = new mongoose.Types.ObjectId(accountId);

  const currentMsg = await MessageModel.findOne({
    accountId: accountObjId,
    folder,
    uid,
  }).lean<IMessageDocument | null>();

  if (!currentMsg) {
    throw AppError.notFound('Message introuvable');
  }

  const normalized = normalizeSubject(currentMsg.subject);

  // Critères de recherche combinés :
  // 1. Même messageId ou inReplyTo
  // 2. Ou sujet normalisé identique (si non vide)
  const orConditions: Array<Record<string, unknown>> = [];

  const ids: string[] = [];
  if (currentMsg.messageId) ids.push(currentMsg.messageId);
  if (currentMsg.inReplyTo) ids.push(currentMsg.inReplyTo);

  if (ids.length > 0) {
    orConditions.push({ messageId: { $in: ids } });
    orConditions.push({ inReplyTo: { $in: ids } });
  }

  if (normalized.length > 0) {
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    orConditions.push({
      subject: { $regex: new RegExp(`^(?:(?:re|fwd|fw|tr|aw)\\s*:\\s*)*${escaped}$`, 'i') },
    });
  }

  const query: Record<string, unknown> = {
    accountId: accountObjId,
  };

  if (orConditions.length > 0) {
    query.$or = orConditions;
  } else {
    query.uid = uid;
    query.folder = folder;
  }

  const messages = await MessageModel.find(query)
    .sort({ date: 1 })
    .lean<IMessageDocument[]>();

  const mappedMessages: ThreadItem[] = messages.map((m) => ({
    uid: m.uid,
    folder: m.folder,
    messageId: m.messageId,
    inReplyTo: m.inReplyTo,
    subject: m.subject,
    from: m.from,
    to: m.to,
    date: m.date,
    flags: m.flags,
    hasAttachments: m.hasAttachments,
    size: m.size,
  }));

  return {
    conversationSubject: normalized || currentMsg.subject || '(Sans objet)',
    count: mappedMessages.length,
    messages: mappedMessages,
  };
}
