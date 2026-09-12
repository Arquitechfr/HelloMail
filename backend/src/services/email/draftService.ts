import MailComposer from 'nodemailer/lib/mail-composer/index.js';
import type { IAccountDocument } from '../../models/Account.js';
import { AppError } from '../../utils/AppError.js';
import { logger } from '../../config/logger.js';
import { imapPool } from './imapPool.js';
import { findDraftsFolder } from './specialFolders.js';
import { extractInlineImages } from './inlineImageService.js';

export interface DraftAttachmentInput {
  filename: string;
  content: string; // base64
  contentType?: string;
  size?: number;
  cid?: string;
}

export interface DraftInput {
  to?: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  subject: string;
  text: string;
  html?: string;
  inReplyTo?: string;
  references?: string[];
  attachments?: DraftAttachmentInput[];
}

export interface DraftResult {
  ok: true;
  uid?: number;
}

/**
 * Construit le raw MIME d'un brouillon via MailComposer.
 */
function buildDraftMime(input: DraftInput, fromAddress: string): Promise<Buffer> {
  const mailOptions: Record<string, unknown> = {
    from: fromAddress,
    subject: input.subject,
    text: input.text || '',
    disableUrlAccess: true,
    disableFileAccess: true,
  };

  if (input.to?.length) mailOptions.to = input.to.join(', ');
  if (input.cc?.length) mailOptions.cc = input.cc.join(', ');
  if (input.bcc?.length) mailOptions.bcc = input.bcc.join(', ');
  if (input.replyTo) mailOptions.replyTo = input.replyTo;
  if (input.html) mailOptions.html = input.html;
  if (input.inReplyTo) mailOptions.inReplyTo = input.inReplyTo;
  if (input.references?.length) mailOptions.references = input.references.join(' ');

  if (input.attachments?.length) {
    mailOptions.attachments = input.attachments.map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.content, 'base64'),
      contentType: a.contentType,
      ...(a.cid && { cid: a.cid }),
    }));
  }

  const mail = new MailComposer(mailOptions) as MailComposer;
  const compiled = mail.compile();

  return new Promise<Buffer>((resolve, reject) => {
    compiled.build((err: Error | null, result: Buffer) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

/**
 * Sauvegarde un brouillon dans le dossier Drafts via IMAP append.
 *
 * - Si `existingUid` est fourni (modification) : supprime l'ancien brouillon
 *   puis append le nouveau.
 * - Si pas d'`existingUid` (création) : append uniquement.
 * - Le flag `\Draft` est appliqué au message appendé.
 *
 * Détecte le dossier Drafts via specialUse (\\Drafts) avec fallbacks
 * (Drafts, Brouillons, etc.). Si non trouvé, tente "Drafts" comme dernier recours.
 */
export async function saveDraft(
  account: IAccountDocument,
  input: DraftInput,
  existingUid?: number,
): Promise<DraftResult> {
  const accountId = String(account._id);

  if (!account.imapConfig?.host) {
    throw AppError.badRequest('Configuration IMAP/SMTP manquante pour ce compte');
  }

  if (account.provider === 'imap' && !account.imapConfig?.encryptedPassword) {
    throw AppError.badRequest('Configuration IMAP/SMTP manquante pour ce compte');
  }

  // Traitement transparent des images inline Data URI vers CID
  let effectiveHtml = input.html;
  let effectiveAttachments = input.attachments ? [...input.attachments] : [];
  if (input.html) {
    const { html: processedHtml, inlineAttachments } = extractInlineImages(input.html);
    effectiveHtml = processedHtml;
    if (inlineAttachments.length > 0) {
      effectiveAttachments = [...effectiveAttachments, ...inlineAttachments];
    }
  }

  const effectiveInput: DraftInput = {
    ...input,
    html: effectiveHtml,
    attachments: effectiveAttachments.length > 0 ? effectiveAttachments : undefined,
  };

  // Construit le raw MIME du brouillon.
  const rawMime = await buildDraftMime(effectiveInput, account.emailAddress);

  // Détecte le dossier Drafts.
  const draftsPath = (await findDraftsFolder(account)) ?? 'Drafts';

  const client = await imapPool.acquire(account);

  try {
    // Si modification, supprime l'ancien brouillon d'abord.
    if (existingUid !== undefined) {
      try {
        await client.mailboxOpen(draftsPath, { readOnly: false });
        await client.messageDelete(existingUid, { uid: true });
      } catch (error) {
        // L'ancien brouillon peut déjà être supprimé — non bloquant.
        logger.warn(
          { accountId, uid: existingUid, error: error instanceof Error ? error.message : 'erreur inconnue' },
          'Échec suppression ancien brouillon (non bloquant)',
        );
      }
    }

    // Append le nouveau brouillon avec le flag \Draft.
    const appendResult = await client.append(draftsPath, rawMime, ['\\Draft']);

    // ImapFlow peut retourner l'UID via uidNext ou directement dans appendResult.
    const newUid = typeof appendResult === 'object' && appendResult !== null && 'uid' in appendResult
      ? (appendResult as { uid: number }).uid
      : undefined;

    return { ok: true, uid: newUid };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw AppError.unprocessable(
      `Sauvegarde du brouillon échouée : ${error instanceof Error ? error.message : 'erreur inconnue'}`,
    );
  } finally {
    imapPool.release(accountId);
  }
}

/**
 * Supprime un brouillon du dossier Drafts via IMAP.
 */
export async function deleteDraft(
  account: IAccountDocument,
  uid: number,
): Promise<void> {
  const accountId = String(account._id);

  const draftsPath = (await findDraftsFolder(account)) ?? 'Drafts';

  const client = await imapPool.acquire(account);

  try {
    await client.mailboxOpen(draftsPath, { readOnly: false });
    await client.messageDelete(uid, { uid: true });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw AppError.unprocessable(
      `Suppression du brouillon échouée : ${error instanceof Error ? error.message : 'erreur inconnue'}`,
    );
  } finally {
    imapPool.release(accountId);
  }
}
