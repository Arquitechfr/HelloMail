import type { ImapFlow, MessageStructureObject } from 'imapflow';
import mongoose from 'mongoose';
import type { IAccountDocument } from '../../models/Account.js';
import { MessageBodyModel } from '../../models/MessageBody.js';
import { AppError } from '../../utils/AppError.js';
import { imapPool } from './imapPool.js';
import { sanitizeEmailHtml } from './sanitize.js';
import { logger } from '../../config/logger.js';

/** Taille max cumulée (texte + html) stockée en cache — ~2 Mo. */
const MAX_CACHED_BODY_BYTES = 2 * 1024 * 1024;

export interface AttachmentInfo {
  filename: string;
  contentType: string;
  size: number;
  part: string;
  disposition: 'attachment' | 'inline';
  contentId?: string;
}

export interface MessageDetail {
  subject: string;
  from: { name?: string; address: string };
  to: { name?: string; address: string }[];
  cc?: { name?: string; address: string }[];
  date: Date;
  messageId?: string;
  inReplyTo?: string;
  headers: Record<string, string>;
  text?: string;
  html?: string;
  flags: { seen: boolean; answered: boolean; flagged: boolean };
  size: number;
  attachments: AttachmentInfo[];
  readReceiptRequestedTo?: string;
}

interface ParsedParts {
  text?: string;
  html?: string;
  attachments: AttachmentInfo[];
}

/**
 * Parcourt récursivement le bodyStructure pour :
 * - identifier les parties text/plain et text/html (stocke le part number)
 * - collecter les pièces jointes (disposition attachment)
 * - collecter les images inline (disposition inline avec contentId)
 */
function parseBodyStructure(
  node: MessageStructureObject | undefined,
  parts: ParsedParts,
): void {
  if (!node) return;

  const type = node.type.toLowerCase();

  if (!node.childNodes || node.childNodes.length === 0) {
    // Pour un message non-multipart (text/plain ou text/html simple), ImapFlow
    // peut retourner `part: ''` (vide) pour le noeud racine. Fallback "1" pour
    // pouvoir télécharger le corps via BODY.PEEK[1].
    const part = node.part || '1';

    if (type === 'text/plain' && parts.text === undefined) {
      parts.text = part;
    } else if (type === 'text/html' && parts.html === undefined) {
      parts.html = part;
    } else if (node.part && node.disposition === 'attachment') {
      parts.attachments.push({
        filename: node.dispositionParameters?.filename ?? node.parameters?.name ?? 'sans-nom',
        contentType: node.type,
        size: node.size ?? 0,
        part: node.part,
        disposition: 'attachment',
      });
    } else if (node.part && node.disposition === 'inline' && node.id) {
      parts.attachments.push({
        filename: node.dispositionParameters?.filename ?? node.parameters?.name ?? 'inline',
        contentType: node.type,
        size: node.size ?? 0,
        part: node.part,
        disposition: 'inline',
        contentId: node.id,
      });
    }
    return;
  }

  for (const child of node.childNodes) {
    parseBodyStructure(child, parts);
  }
}

/**
 * Télécharge le contenu d'une partie MIME et retourne le texte décodé.
 */
async function downloadPart(
  client: ImapFlow,
  uid: number,
  part: string,
): Promise<string> {
  const { content } = await client.download(uid, part, { uid: true });
  const chunks: Buffer[] = [];
  for await (const chunk of content) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Récupère le détail complet d'un message : envelope, headers, corps
 * (text/plain + text/html sanitizé) et structure des pièces jointes.
 *
 * Ouvre le dossier en lecture seule (readOnly) — ne marque pas \Seen.
 * ImapFlow utilise automatiquement BODY.PEEK dans fetchOne et download.
 */
export async function fetchMessageDetail(
  account: IAccountDocument,
  folder: string,
  uid: number,
): Promise<MessageDetail> {
  const accountId = String(account._id);
  const client = await imapPool.acquire(account);

  try {
    await client.mailboxOpen(folder, { readOnly: true });

    const msg = await client.fetchOne(
      uid,
      {
        uid: true,
        envelope: true,
        flags: true,
        bodyStructure: true,
        size: true,
        headers: true,
      },
      { uid: true },
    );

    if (!msg) {
      throw AppError.notFound('Message introuvable');
    }

    // Parse le bodyStructure pour identifier les parties.
    const parts: ParsedParts = { attachments: [] };
    parseBodyStructure(msg.bodyStructure, parts);

    // Cache des corps (MessageBody) : si présent, on saute les downloads MIME.
    const cached = await readBodyCache(accountId, folder, uid);

    let textContent: string | undefined;
    let htmlContent: string | undefined;

    if (cached) {
      textContent = cached.text;
      htmlContent = cached.html; // déjà sanitizé lors de l'écriture
    } else {
      // Télécharge text/plain et text/html si trouvés.
      if (parts.text !== undefined) {
        textContent = await downloadPart(client, uid, parts.text);
      }
      if (parts.html !== undefined) {
        htmlContent = await downloadPart(client, uid, parts.html);
      }
    }

    // Sanitize le HTML (déjà fait en cache, mais coût négligeable et défense en profondeur).
    const sanitizedHtml = htmlContent !== undefined ? sanitizeEmailHtml(htmlContent) : undefined;

    // Écrit le corps en cache (best-effort, cap de taille).
    if (!cached) {
      writeBodyCache(accountId, folder, uid, textContent, sanitizedHtml).catch(() => {});
    }

    // Parse les headers bruts (msg.headers est un Buffer contenant les headers RFC 822).
    const headers: Record<string, string> = {};
    if (msg.headers && Buffer.isBuffer(msg.headers)) {
      const headerStr = msg.headers.toString('utf8');
      for (const line of headerStr.split('\r\n')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const key = line.substring(0, colonIdx).trim().toLowerCase();
          const value = line.substring(colonIdx + 1).trim();
          if (key && value) {
            headers[key] = value;
          }
        }
      }
    }

    const envelope = msg.envelope;
    const flagsSet = msg.flags ?? new Set<string>();

    return {
      subject: envelope?.subject ?? '',
      from: {
        address: envelope?.from?.[0]?.address ?? '',
        ...(envelope?.from?.[0]?.name !== undefined && { name: envelope.from[0].name }),
      },
      to: (envelope?.to ?? [])
        .filter((a) => a.address !== undefined)
        .map((a) => ({
          address: a.address!,
          ...(a.name !== undefined && { name: a.name }),
        })),
      cc: (envelope?.cc ?? [])
        .filter((a) => a.address !== undefined)
        .map((a) => ({
          address: a.address!,
          ...(a.name !== undefined && { name: a.name }),
        })),
      date: envelope?.date ?? new Date(0),
      messageId: envelope?.messageId,
      inReplyTo: envelope?.inReplyTo,
      headers,
      text: textContent,
      html: sanitizedHtml,
      flags: {
        seen: flagsSet.has('\\Seen'),
        answered: flagsSet.has('\\Answered'),
        flagged: flagsSet.has('\\Flagged'),
      },
      size: msg.size ?? 0,
      attachments: parts.attachments,
      readReceiptRequestedTo: headers['disposition-notification-to'],
    };
  } finally {
    imapPool.release(accountId);
  }
}

/** MongoDB connectée ? Le cache corps est ignoré si la base n'est pas dispo. */
function dbReady(): boolean {
  return mongoose.connection.readyState === 1;
}

/** Lit le cache corps pour un message. Null si absent ou DB indisponible. */
async function readBodyCache(
  accountId: string,
  folder: string,
  uid: number,
): Promise<{ text?: string; html?: string } | null> {
  if (!dbReady()) {
    return null;
  }
  const doc = await MessageBodyModel.findOne({ accountId, folder, uid })
    .select('text html')
    .lean();
  return doc ? { text: doc.text, html: doc.html } : null;
}

/**
 * Écrit le cache corps pour un message (upsert). Best-effort :
 * ignore les corps trop volumineux (> 2 Mo cumulés) et les erreurs.
 */
async function writeBodyCache(
  accountId: string,
  folder: string,
  uid: number,
  text?: string,
  html?: string,
): Promise<void> {
  if (!dbReady()) {
    return;
  }
  const totalSize = (text?.length ?? 0) + (html?.length ?? 0);
  if (totalSize > MAX_CACHED_BODY_BYTES) {
    return;
  }
  try {
    await MessageBodyModel.updateOne(
      { accountId, folder, uid },
      { $set: { text, html, fetchedAt: new Date() } },
      { upsert: true },
    );
  } catch (error) {
    logger.warn(
      { accountId, folder, uid, error: error instanceof Error ? error.message : 'erreur inconnue' },
      'Échec écriture cache corps (non bloquant)',
    );
  }
}
