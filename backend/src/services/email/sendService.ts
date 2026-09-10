import nodemailer from 'nodemailer';
import MailComposer from 'nodemailer/lib/mail-composer/index.js';
import type { IAccountDocument } from '../../models/Account.js';
import { AppError } from '../../utils/AppError.js';
import { decrypt } from '../security/encryptionService.js';
import { imapPool } from './imapPool.js';
import { findSentFolder } from './specialFolders.js';
import { SMTP_TIMEOUT_MS } from '../../config/constants.js';

export interface SendEmailInput {
  to: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: { filename: string; content: string; contentType?: string }[];
  inReplyTo?: string;
  references?: string[];
}

export interface SendResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
}

/**
 * Construit le raw MIME d'un message via MailComposer (bundled avec nodemailer).
 */
function buildRawMime(input: SendEmailInput, fromAddress: string): Promise<Buffer> {
  const mailOptions: Record<string, unknown> = {
    from: fromAddress,
    to: input.to.join(', '),
    subject: input.subject,
    text: input.text,
    disableUrlAccess: true,
    disableFileAccess: true,
  };

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
      ...(a.contentType && { contentType: a.contentType }),
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
 * Envoie un email via le SMTP du compte, puis sauvegarde une copie dans le dossier Sent.
 *
 * 1. Déchiffre le mot de passe (réutilisé pour SMTP dans le cas IMAP).
 * 2. Crée un transport nodemailer avec timeout SMTP_TIMEOUT_MS.
 * 3. Construit le raw MIME via MailComposer (pour la sauvegarde Sent).
 * 4. Envoie via transport.sendMail.
 * 5. Sauvegarde le raw MIME dans "Sent" via ImapFlow append.
 */
export async function sendEmail(
  account: IAccountDocument,
  input: SendEmailInput,
): Promise<SendResult> {
  if (!account.imapConfig?.encryptedPassword) {
    throw AppError.badRequest('Configuration IMAP/SMTP manquante pour ce compte');
  }

  const password = decrypt(account.imapConfig.encryptedPassword);
  const accountId = String(account._id);

  // Construit le raw MIME pour la sauvegarde Sent (avant l'envoi).
  const rawMime = await buildRawMime(input, account.emailAddress);

  // Crée le transport SMTP.
  const transport = nodemailer.createTransport({
    host: account.imapConfig.smtpHost,
    port: account.imapConfig.smtpPort,
    secure: account.imapConfig.smtpSecure,
    auth: {
      user: account.imapConfig.username,
      pass: password,
    },
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  });

  try {
    // Envoie via SMTP.
    const info = await transport.sendMail({
      from: account.emailAddress,
      to: input.to.join(', '),
      cc: input.cc?.join(', '),
      bcc: input.bcc?.join(', '),
      replyTo: input.replyTo,
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments: input.attachments?.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content, 'base64'),
        ...(a.contentType && { contentType: a.contentType }),
      })),
      inReplyTo: input.inReplyTo,
      references: input.references?.join(' '),
    });

    // Sauvegarde dans Sent via IMAP append.
    await saveToSent(account, rawMime);

    return {
      messageId: info.messageId,
      accepted: info.accepted as string[],
      rejected: info.rejected as string[],
    };
  } catch (error) {
    throw AppError.unprocessable(
      `Envoi SMTP échoué : ${error instanceof Error ? error.message : 'erreur inconnue'}`,
    );
  } finally {
    transport.close();
  }
}

/**
 * Sauvegarde le raw MIME dans le dossier Sent via IMAP append.
 *
 * Détecte le dossier Sent via specialUse (\\Sent) avec fallbacks sur les noms
 * courants (Sent, Sent Items, Envoyés, etc.). Si aucun dossier Sent n'est trouvé,
 * tente "Sent" comme dernier recours.
 *
 * Non bloquant : une erreur de sauvegarde ne fait pas échouer l'envoi.
 */
async function saveToSent(account: IAccountDocument, rawMime: Buffer): Promise<void> {
  const accountId = String(account._id);

  try {
    // Détecte le dossier Sent via specialUse + fallbacks.
    const sentPath = (await findSentFolder(account)) ?? 'Sent';

    const client = await imapPool.acquire(account);
    try {
      await client.append(sentPath, rawMime, ['\\Seen']);
    } finally {
      imapPool.release(accountId);
    }
  } catch {
    // La sauvegarde dans Sent est best-effort : ne pas faire échouer l'envoi.
    console.error(`[send] Compte ${accountId} : échec sauvegarde Sent (non bloquant)`);
  }
}
