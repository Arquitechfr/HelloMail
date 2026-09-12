import type { IAccountDocument } from '../../models/Account.js';
import { MessageModel } from '../../models/Message.js';
import { AppError } from '../../utils/AppError.js';
import { fetchMessageDetail } from './messageFetchService.js';
import { sendEmail } from './sendService.js';
import { updateFlags } from './messageActionService.js';

export interface ReadReceiptResult {
  ok: boolean;
  sentTo: string;
}

/**
 * Envoie un accusé de réception de lecture (MDN RFC 3798) pour un message donné.
 */
export async function sendReadReceipt(
  account: IAccountDocument,
  folder: string,
  uid: number,
): Promise<ReadReceiptResult> {
  const detail = await fetchMessageDetail(account, folder, uid);

  const recipient = detail.readReceiptRequestedTo;
  if (!recipient) {
    throw AppError.badRequest('Aucun accusé de réception demandé pour ce message');
  }

  // Nettoyage de l'adresse de destination (au cas où elle contiendrait des chevrons ou espaces)
  const cleanRecipient = recipient.replace(/[<>]/g, '').trim();

  // Si l'accusé de réception a déjà été envoyé, on est idempotent et on ne renvoie pas d'email
  if (detail.readReceiptSentAt) {
    return {
      ok: true,
      sentTo: cleanRecipient,
    };
  }

  const formattedDate = new Date().toLocaleString('fr-FR', { timeZone: 'UTC' });
  const subject = detail.subject ? `Lu : ${detail.subject}` : 'Lu : (Sans sujet)';

  const textBody = [
    `Votre message a été affiché sur le client de messagerie de ${account.emailAddress}.`,
    '',
    `Détails du message :`,
    `  Sujet : ${detail.subject || '(sans objet)'}`,
    `  Date d'affichage : ${formattedDate} UTC`,
    `  Message-ID : ${detail.messageId || 'inconnu'}`,
    '',
    `Ceci est une confirmation automatique de lecture émise par Mailora conforme à la RFC 3798.`,
  ].join('\n');

  await sendEmail(account, {
    to: [cleanRecipient],
    subject,
    text: textBody,
    inReplyTo: detail.messageId,
    references: detail.messageId ? [detail.messageId] : undefined,
  });

  // Persiste la confirmation d'envoi en base pour interdire tout renvoi ultérieur
  try {
    await MessageModel.updateOne(
      { accountId: account._id, folder, uid },
      { $set: { readReceiptSentAt: new Date() } },
    );
  } catch {
    // Best-effort
  }

  // Marque le message localement comme ayant reçu une réponse (\Answered)
  try {
    await updateFlags(account, folder, uid, { answered: true });
  } catch {
    // Best-effort, ne doit pas faire échouer la confirmation
  }

  return {
    ok: true,
    sentTo: cleanRecipient,
  };
}

