import nodemailer from 'nodemailer';
import type { ImapFlow } from 'imapflow';
import MailComposer from 'nodemailer/lib/mail-composer/index.js';
import type { IAccountDocument } from '../../models/Account.js';
import { MessageModel } from '../../models/Message.js';
import { AppError } from '../../utils/AppError.js';
import { logger } from '../../config/logger.js';
import { decrypt } from '../security/encryptionService.js';
import { imapPool } from './imapPool.js';
import { findSentFolder } from './specialFolders.js';
import { mapFetchResultToMessage } from '../sync/messageMapper.js';
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
 * Sauvegarde le raw MIME dans le dossier Sent via IMAP append, puis fait miroir
 * dans MongoDB pour que le message apparaisse immédiatement dans la liste Sent
 * (sans attendre la sync initiale du worker à la prochaine reconnexion).
 *
 * Détecte le dossier Sent via specialUse (\\Sent) avec fallbacks sur les noms
 * courants (Sent, Sent Items, Envoyés, etc.). Si aucun dossier Sent n'est trouvé,
 * tente "Sent" comme dernier recours.
 *
 * Miroir MongoDB best-effort : si l'UID n'est pas retourné par `append` (certains
 * serveurs IMAP ne le fournissent pas) ou si le fetch échoue, le message sera
 * rattrapé par la sync initiale du worker au prochain démarrage.
 *
 * Non bloquant : une erreur de sauvegarde ne fait pas échouer l'envoi.
 */
async function saveToSent(account: IAccountDocument, rawMime: Buffer): Promise<void> {
  const accountId = String(account._id);

  try {
    // Détecte le dossier Sent via specialUse + fallbacks.
    const sentPath = (await findSentFolder(account)) ?? 'Sent';

    const client = await imapPool.acquire(account);
    let appendResult: { uid?: number } | undefined;
    try {
      appendResult = (await client.append(sentPath, rawMime, ['\\Seen'])) as { uid?: number } | undefined;
    } finally {
      imapPool.release(accountId);
    }

    // Miroir dans MongoDB : récupère l'enveloppe du message appendé pour l'upsert.
    // Best-effort — si l'UID est absent ou le fetch échoue, le worker rattrapera
    // à la prochaine sync initiale (le dossier Sent est désormais syncé au démarrage).
    if (appendResult?.uid) {
      await mirrorSentToMongo(client, account, accountId, sentPath, appendResult.uid);
    } else {
      logger.info(
        { accountId, folder: sentPath },
        'Append Sent sans UID — miroir MongoDB reporté à la prochaine sync worker',
      );
    }
  } catch (error) {
    // La sauvegarde dans Sent est best-effort : ne pas faire échouer l'envoi.
    logger.warn({ accountId, error: error instanceof Error ? error.message : 'erreur inconnue' }, 'Échec sauvegarde Sent (non bloquant)');
  }
}

/**
 * Récupère l'enveloppe du message appendé et l'upsert dans MongoDB.
 * Ouvre le dossier Sent en readOnly (lecture seule — préserve les flags).
 * Best-effort : catche ses propres erreurs et log seulement.
 */
async function mirrorSentToMongo(
  client: ImapFlow,
  account: IAccountDocument,
  accountId: string,
  sentPath: string,
  uid: number,
): Promise<void> {
  try {
    await client.mailboxOpen(sentPath, { readOnly: true });
    const msg = await client.fetchOne(uid, {
      uid: true,
      envelope: true,
      flags: true,
      bodyStructure: true,
      size: true,
    }, { uid: true });

    if (!msg) {
      logger.warn({ accountId, folder: sentPath, uid }, 'Miroir Sent : message non trouvé après append');
      return;
    }

    const messageInput = mapFetchResultToMessage(accountId, sentPath, msg);
    await MessageModel.updateOne(
      { accountId, folder: messageInput.folder, uid: messageInput.uid },
      { $set: messageInput },
      { upsert: true },
    );
  } catch (error) {
    logger.warn(
      { accountId, folder: sentPath, uid, error: error instanceof Error ? error.message : 'erreur inconnue' },
      'Miroir Sent MongoDB échoué (non bloquant — rattrapé par sync worker)',
    );
  }
}
