import { Types } from 'mongoose';
import type { IAccountDocument } from '../../models/Account.js';
import { MessageModel } from '../../models/Message.js';
import { RuleModel } from '../../models/Rule.js';
import { AppError } from '../../utils/AppError.js';
import { logger } from '../../config/logger.js';
import { markMessageAsJunk } from './messageActionService.js';
import { fetchMessageDetail } from './messageFetchService.js';
import { publishEvent } from '../realtime/eventPublisher.js';

export interface BlockSenderResult {
  success: boolean;
  senderEmail: string;
  ruleCreated: boolean;
  message: string;
}

/**
 * Bloque un expéditeur d'email :
 * 1. Détermine l'adresse de l'expéditeur du message
 * 2. Crée une règle de tri automatique "markAsJunk" si elle n'existe pas encore
 * 3. Déplace le message courant vers les spams
 * 4. Notifie le client via SSE
 */
export async function blockSender(
  account: IAccountDocument,
  folder: string,
  uid: number,
): Promise<BlockSenderResult> {
  const accountId = String(account._id);
  const userObjectId = new Types.ObjectId(account.userId);

  // 1. Récupération de l'adresse de l'expéditeur
  let senderEmail: string | undefined;

  const dbMsg = await MessageModel.findOne({ accountId, folder, uid }).lean();
  if (dbMsg?.from?.address) {
    senderEmail = dbMsg.from.address.trim().toLowerCase();
  } else {
    const detail = await fetchMessageDetail(account, folder, uid);
    if (detail?.from?.address) {
      senderEmail = detail.from.address.trim().toLowerCase();
    }
  }

  if (!senderEmail) {
    throw AppError.badRequest("Impossible d'identifier l'adresse de l'expéditeur de ce message");
  }

  // 2. Création ou détection de la règle de blocage
  const existingRule = await RuleModel.findOne({
    userId: userObjectId,
    'conditions.field': 'from',
    'conditions.operator': 'equals',
    'conditions.value': senderEmail,
    'actions.type': 'markAsJunk',
  });

  let ruleCreated = false;
  if (!existingRule) {
    const highestRule = await RuleModel.findOne({ userId: userObjectId }).sort({ order: -1 }).lean();
    const nextOrder = (highestRule?.order ?? 0) + 1;

    await RuleModel.create({
      userId: userObjectId,
      name: `Bloqué : ${senderEmail}`,
      order: nextOrder,
      isActive: true,
      conditionMatch: 'all',
      conditions: [{ field: 'from', operator: 'equals', value: senderEmail }],
      actions: [{ type: 'markAsJunk' }],
      stopProcessing: true,
      isPreset: false,
    });
    ruleCreated = true;
    logger.info({ userId: String(userObjectId), senderEmail }, 'Nouvelle règle de blocage expéditeur créée');
  }

  // 3. Déplacement du message courant vers Junk
  await markMessageAsJunk(account, folder, uid);

  // 4. Notification SSE pour actualisation immédiate de l'interface
  publishEvent({
    type: 'message:deleted',
    userId: String(account.userId),
    accountId,
    payload: { folder, uid },
  });

  return {
    success: true,
    senderEmail,
    ruleCreated,
    message: `L'expéditeur ${senderEmail} a été bloqué et le message déplacé dans les courriers indésirables`,
  };
}
