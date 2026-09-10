import type { ImapFlow, MessageStructureObject } from 'imapflow';
import type { IAccountDocument } from '../../models/Account.js';
import { AppError } from '../../utils/AppError.js';
import { imapPool } from './imapPool.js';
import { sanitizeEmailHtml } from './sanitize.js';

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
  headers: Record<string, string>;
  text?: string;
  html?: string;
  flags: { seen: boolean; answered: boolean; flagged: boolean };
  size: number;
  attachments: AttachmentInfo[];
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
    if (node.part && type === 'text/plain' && parts.text === undefined) {
      parts.text = node.part;
    } else if (node.part && type === 'text/html' && parts.html === undefined) {
      parts.html = node.part;
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

    // Télécharge text/plain et text/html si trouvés.
    let textContent: string | undefined;
    let htmlContent: string | undefined;

    if (parts.text !== undefined) {
      textContent = await downloadPart(client, uid, parts.text);
    }
    if (parts.html !== undefined) {
      htmlContent = await downloadPart(client, uid, parts.html);
    }

    // Sanitize le HTML.
    const sanitizedHtml = htmlContent !== undefined ? sanitizeEmailHtml(htmlContent) : undefined;

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
    };
  } finally {
    imapPool.release(accountId);
  }
}
