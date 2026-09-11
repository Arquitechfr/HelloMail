import mongoose, { Types } from 'mongoose';
import { RuleModel, type IRule, type IRuleCondition, type RuleDocument } from '../../models/Rule.js';
import { MessageModel } from '../../models/Message.js';
import { AccountModel } from '../../models/Account.js';
import { AppError } from '../../utils/AppError.js';
import { logger } from '../../config/logger.js';
import type { CreateRuleInput, UpdateRuleInput } from '../../schemas/ruleSchemas.js';
import type { ImapFlow } from 'imapflow';
import { findJunkFolder } from './specialFolders.js';
import { adjustFolderCounters } from './folderCounters.js';
import {
  safeMoveMessages,
  resolveDestinationUids,
  relocateLocalMessage,
} from './messageRelocation.js';

export interface MessageRuleEvaluatorInput {
  subject?: string;
  from?: { name?: string; address?: string };
  to?: Array<{ name?: string; address?: string }>;
  hasAttachments?: boolean;
}

/**
 * Liste les règles configurées pour un utilisateur, ordonnées par priorité.
 */
export async function listUserRules(userId: string, accountId?: string): Promise<RuleDocument[]> {
  const query: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
  if (accountId) {
    query.$or = [{ accountId: new Types.ObjectId(accountId) }, { accountId: { $exists: false } }, { accountId: null }];
  }
  return RuleModel.find(query).sort({ order: 1, createdAt: 1 });
}

/**
 * Crée une nouvelle règle pour l'utilisateur.
 */
export async function createUserRule(userId: string, input: CreateRuleInput): Promise<RuleDocument> {
  const count = await RuleModel.countDocuments({ userId: new Types.ObjectId(userId) });
  const rule = new RuleModel({
    ...input,
    userId: new Types.ObjectId(userId),
    accountId: input.accountId ? new Types.ObjectId(input.accountId) : undefined,
    order: count,
  });
  return rule.save();
}

/**
 * Met à jour une règle existante.
 */
export async function updateUserRule(userId: string, ruleId: string, input: UpdateRuleInput): Promise<RuleDocument> {
  const rule = await RuleModel.findOne({
    _id: new Types.ObjectId(ruleId),
    userId: new Types.ObjectId(userId),
  });

  if (!rule) {
    throw AppError.notFound('Règle introuvable');
  }

  if (input.name !== undefined) rule.name = input.name;
  if (input.accountId !== undefined) rule.accountId = input.accountId ? new Types.ObjectId(input.accountId) : undefined;
  if (input.isActive !== undefined) rule.isActive = input.isActive;
  if (input.conditionMatch !== undefined) rule.conditionMatch = input.conditionMatch;
  if (input.conditions !== undefined) rule.conditions = input.conditions;
  if (input.actions !== undefined) rule.actions = input.actions;
  if (input.stopProcessing !== undefined) rule.stopProcessing = input.stopProcessing;

  return rule.save();
}

/**
 * Supprime une règle existante.
 */
export async function deleteUserRule(userId: string, ruleId: string): Promise<void> {
  const result = await RuleModel.deleteOne({
    _id: new Types.ObjectId(ruleId),
    userId: new Types.ObjectId(userId),
  });

  if (result.deletedCount === 0) {
    throw AppError.notFound('Règle introuvable');
  }
}

/**
 * Réorganise les priorités des règles d'un utilisateur.
 */
export async function reorderUserRules(userId: string, ruleIds: string[]): Promise<void> {
  const ops = ruleIds.map((id, index) => ({
    updateOne: {
      filter: { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) },
      update: { $set: { order: index } },
    },
  }));

  if (ops.length > 0) {
    await RuleModel.bulkWrite(ops);
  }
}

/**
 * Évalue une condition unitaire contre les données d'un message (fonction pure).
 */
export function matchesCondition(condition: IRuleCondition, message: MessageRuleEvaluatorInput): boolean {
  const searchVal = (condition.value || '').toLowerCase().trim();

  if (condition.field === 'hasAttachments') {
    const hasAtt = Boolean(message.hasAttachments);
    const expected = condition.value === 'true' || condition.value === '1';
    return condition.operator === 'equals' ? hasAtt === expected : hasAtt !== expected;
  }

  const testString = (str: string, op: string, val: string): boolean => {
    switch (op) {
      case 'contains':
        return str.includes(val);
      case 'notContains':
        return !str.includes(val);
      case 'equals':
        return str.trim() === val;
      case 'startsWith':
        return str.startsWith(val);
      case 'endsWith':
        return str.endsWith(val);
      default:
        return false;
    }
  };

  if (condition.field === 'subject') {
    const textToTest = (message.subject || '').toLowerCase();
    return testString(textToTest, condition.operator, searchVal);
  }

  if (condition.field === 'from') {
    const addr = (message.from?.address || '').toLowerCase();
    const name = (message.from?.name || '').toLowerCase();
    if (condition.operator === 'notContains') {
      return !addr.includes(searchVal) && !name.includes(searchVal);
    }
    return testString(addr, condition.operator, searchVal) || testString(name, condition.operator, searchVal);
  }

  if (condition.field === 'to') {
    const recipients = message.to || [];
    if (condition.operator === 'notContains') {
      return recipients.every(
        (r) => !((r.address || '').toLowerCase().includes(searchVal) || (r.name || '').toLowerCase().includes(searchVal)),
      );
    }
    return recipients.some(
      (r) =>
        testString((r.address || '').toLowerCase(), condition.operator, searchVal) ||
        testString((r.name || '').toLowerCase(), condition.operator, searchVal),
    );
  }

  return false;
}

/**
 * Évalue une règle complète contre un message (fonction pure).
 */
export function evaluateRule(rule: IRule, message: MessageRuleEvaluatorInput): boolean {
  if (!rule.isActive || !rule.conditions || rule.conditions.length === 0) {
    return false;
  }

  if (rule.conditionMatch === 'any') {
    return rule.conditions.some((cond) => matchesCondition(cond, message));
  }
  return rule.conditions.every((cond) => matchesCondition(cond, message));
}

/**
 * Applique les règles actives d'un utilisateur sur un nouveau message reçu.
 */
export async function applyRulesToIncomingMessage(
  account: { _id: Types.ObjectId; userId: Types.ObjectId },
  message: {
    _id: Types.ObjectId;
    folder: string;
    uid: number;
    subject?: string;
    from?: { name?: string; address?: string };
    to?: Array<{ name?: string; address?: string }>;
    hasAttachments?: boolean;
    flags?: { seen?: boolean; flagged?: boolean; answered?: boolean };
  },
  imapClient: ImapFlow,
): Promise<void> {
  const rules = await RuleModel.find({
    userId: account.userId,
    isActive: true,
    $or: [{ accountId: account._id }, { accountId: { $exists: false } }, { accountId: null }],
  }).sort({ order: 1, createdAt: 1 });

  if (rules.length === 0) return;

  const evaluatorInput: MessageRuleEvaluatorInput = {
    subject: message.subject,
    from: message.from,
    to: message.to,
    hasAttachments: message.hasAttachments,
  };

  for (const rule of rules) {
    if (!evaluateRule(rule, evaluatorInput)) continue;

    logger.info({ ruleId: rule._id, ruleName: rule.name, uid: message.uid }, 'Règle appliquée au message');

    const accountId = String(account._id);
    const messageSeen = message.flags?.seen === true;

    for (const action of rule.actions) {
      try {
        if (action.type === 'moveToFolder' && action.folderName) {
          const sourceFolder = message.folder;
          const moveResult = await safeMoveMessages(
            imapClient,
            message.uid,
            action.folderName,
            'Action de règle échouée',
          );
          // Pas de fallback fetch : mailboxOpen changerait le dossier
          // sélectionné de la connexion IDLE (INBOX).
          const uidMap = await resolveDestinationUids(
            imapClient,
            action.folderName,
            [message],
            moveResult,
            { fetchFallback: false },
          );
          const destUid = uidMap.get(message.uid);
          if (destUid) {
            await relocateLocalMessage(accountId, sourceFolder, message, action.folderName, destUid);
          } else {
            await MessageModel.updateOne({ _id: message._id }, { $set: { folder: action.folderName } });
          }
          adjustFolderCounters(accountId, sourceFolder, {
            messagesDelta: -1,
            unseenDelta: messageSeen ? 0 : -1,
          }).catch(() => {});
          adjustFolderCounters(accountId, action.folderName, {
            messagesDelta: 1,
            unseenDelta: messageSeen ? 0 : 1,
          }).catch(() => {});
          message.folder = action.folderName;
        } else if (action.type === 'markAsRead') {
          await imapClient.messageFlagsAdd(message.uid, ['\\Seen'], { uid: true });
          await MessageModel.updateOne({ _id: message._id }, { $set: { 'flags.seen': true } });
          if (!messageSeen) {
            adjustFolderCounters(accountId, message.folder, { unseenDelta: -1 }).catch(() => {});
          }
        } else if (action.type === 'markAsFlagged') {
          await imapClient.messageFlagsAdd(message.uid, ['\\Flagged'], { uid: true });
          await MessageModel.updateOne({ _id: message._id }, { $set: { 'flags.flagged': true } });
        } else if (action.type === 'markAsJunk') {
          let target = 'Junk';
          const fullAccount = await AccountModel.findById(account._id);
          if (fullAccount) {
            const junkFolder = await findJunkFolder(fullAccount);
            if (junkFolder) target = junkFolder;
          }
          const sourceFolder = message.folder;
          const moveResult = await safeMoveMessages(
            imapClient,
            message.uid,
            target,
            'Action de règle échouée',
          );
          const uidMap = await resolveDestinationUids(
            imapClient,
            target,
            [message],
            moveResult,
            { fetchFallback: false },
          );
          const destUid = uidMap.get(message.uid);
          if (destUid) {
            await relocateLocalMessage(accountId, sourceFolder, message, target, destUid);
          } else {
            await MessageModel.updateOne({ _id: message._id }, { $set: { folder: target } });
          }
          adjustFolderCounters(accountId, sourceFolder, {
            messagesDelta: -1,
            unseenDelta: messageSeen ? 0 : -1,
          }).catch(() => {});
          adjustFolderCounters(accountId, target, {
            messagesDelta: 1,
            unseenDelta: messageSeen ? 0 : 1,
          }).catch(() => {});
          message.folder = target;
        } else if (action.type === 'delete') {
          const deleted = await imapClient.messageDelete(message.uid, { uid: true });
          if (deleted === false) {
            throw new Error('Le serveur a refusé la suppression');
          }
          await MessageModel.deleteOne({ _id: message._id });
          adjustFolderCounters(accountId, message.folder, {
            messagesDelta: -1,
            unseenDelta: messageSeen ? 0 : -1,
          }).catch(() => {});
        } else if (action.type === 'applyTag' && action.tagName) {
          await MessageModel.updateOne({ _id: message._id }, { $addToSet: { tags: action.tagName } });
        } else if (action.type === 'pinMessage') {
          await MessageModel.updateOne(
            { _id: message._id },
            { $set: { isPinned: true, pinnedAt: new Date() } },
          );
        }
      } catch (actErr) {
        logger.error({ action: action.type, error: actErr instanceof Error ? actErr.message : 'inconnu' }, 'Erreur action de règle');
      }
    }

    if (rule.stopProcessing) {
      break;
    }
  }
}
