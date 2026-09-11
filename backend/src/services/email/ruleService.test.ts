import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { setupTestDb, teardownTestDb, clearDb } from '../../test/setup.js';
import type { ImapFlow } from 'imapflow';
import {
  matchesCondition,
  evaluateRule,
  createUserRule,
  listUserRules,
  updateUserRule,
  deleteUserRule,
  reorderUserRules,
  applyRulesToIncomingMessage,
} from './ruleService.js';
import { RuleModel } from '../../models/Rule.js';
import { MessageModel } from '../../models/Message.js';

describe('ruleService', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });
  describe('matchesCondition', () => {
    it('évalue correctement les conditions sur le sujet', () => {
      const msg = { subject: 'Facture urgente #1234' };

      expect(matchesCondition({ field: 'subject', operator: 'contains', value: 'facture' }, msg)).toBe(true);
      expect(matchesCondition({ field: 'subject', operator: 'contains', value: 'devis' }, msg)).toBe(false);
      expect(matchesCondition({ field: 'subject', operator: 'notContains', value: 'devis' }, msg)).toBe(true);
      expect(matchesCondition({ field: 'subject', operator: 'startsWith', value: 'facture' }, msg)).toBe(true);
      expect(matchesCondition({ field: 'subject', operator: 'endsWith', value: '#1234' }, msg)).toBe(true);
      expect(matchesCondition({ field: 'subject', operator: 'equals', value: 'facture urgente #1234' }, msg)).toBe(true);
    });

    it('évalue correctement les conditions sur l\'expéditeur (from)', () => {
      const msg = { from: { name: 'Support Google', address: 'no-reply@google.com' } };

      expect(matchesCondition({ field: 'from', operator: 'contains', value: 'google.com' }, msg)).toBe(true);
      expect(matchesCondition({ field: 'from', operator: 'contains', value: 'support' }, msg)).toBe(true);
      expect(matchesCondition({ field: 'from', operator: 'endsWith', value: '@google.com' }, msg)).toBe(true);
    });

    it('évalue correctement les conditions sur les destinataires (to)', () => {
      const msg = {
        to: [
          { name: 'Dev Team', address: 'dev@company.com' },
          { name: 'Alice', address: 'alice@company.com' },
        ],
      };

      expect(matchesCondition({ field: 'to', operator: 'contains', value: 'alice@company.com' }, msg)).toBe(true);
      expect(matchesCondition({ field: 'to', operator: 'contains', value: 'bob@company.com' }, msg)).toBe(false);
    });

    it('évalue correctement les pièces jointes', () => {
      expect(matchesCondition({ field: 'hasAttachments', operator: 'equals', value: 'true' }, { hasAttachments: true })).toBe(true);
      expect(matchesCondition({ field: 'hasAttachments', operator: 'equals', value: 'true' }, { hasAttachments: false })).toBe(false);
    });
  });

  describe('evaluateRule', () => {
    it('retourne false si la règle est inactive', () => {
      const rule: any = {
        isActive: false,
        conditionMatch: 'all',
        conditions: [{ field: 'subject', operator: 'contains', value: 'urgent' }],
      };
      expect(evaluateRule(rule, { subject: 'urgent test' })).toBe(false);
    });

    it('respecte conditionMatch "all"', () => {
      const rule: any = {
        isActive: true,
        conditionMatch: 'all',
        conditions: [
          { field: 'subject', operator: 'contains', value: 'urgent' },
          { field: 'from', operator: 'contains', value: 'boss@corp.com' },
        ],
      };

      expect(evaluateRule(rule, { subject: 'urgent alert', from: { address: 'boss@corp.com' } })).toBe(true);
      expect(evaluateRule(rule, { subject: 'urgent alert', from: { address: 'colleague@corp.com' } })).toBe(false);
    });

    it('respecte conditionMatch "any"', () => {
      const rule: any = {
        isActive: true,
        conditionMatch: 'any',
        conditions: [
          { field: 'subject', operator: 'contains', value: 'urgent' },
          { field: 'from', operator: 'contains', value: 'boss@corp.com' },
        ],
      };

      expect(evaluateRule(rule, { subject: 'urgent alert', from: { address: 'colleague@corp.com' } })).toBe(true);
      expect(evaluateRule(rule, { subject: 'info', from: { address: 'boss@corp.com' } })).toBe(true);
      expect(evaluateRule(rule, { subject: 'info', from: { address: 'colleague@corp.com' } })).toBe(false);
    });
  });

  describe('CRUD et réorganisation', () => {
    const userId = new Types.ObjectId().toString();

    beforeEach(async () => {
      await clearDb();
    });

    it('crée, liste, met à jour et supprime une règle', async () => {
      const created = await createUserRule(userId, {
        name: 'Trier factures',
        isActive: true,
        conditionMatch: 'all',
        conditions: [{ field: 'subject', operator: 'contains', value: 'facture' }],
        actions: [{ type: 'moveToFolder', folderName: 'Compta' }],
        stopProcessing: true,
      });

      expect(created._id).toBeDefined();
      expect(created.name).toBe('Trier factures');
      expect(created.order).toBe(0);

      const list = await listUserRules(userId);
      expect(list.length).toBe(1);
      expect(list[0].name).toBe('Trier factures');

      const updated = await updateUserRule(userId, created._id.toString(), {
        name: 'Factures & Devis',
        isActive: false,
      });
      expect(updated.name).toBe('Factures & Devis');
      expect(updated.isActive).toBe(false);

      await deleteUserRule(userId, created._id.toString());
      const afterDelete = await listUserRules(userId);
      expect(afterDelete.length).toBe(0);
    });

    it('réorganise l\'ordre des règles', async () => {
      const r1 = await createUserRule(userId, {
        name: 'Règle 1',
        isActive: true,
        conditionMatch: 'all',
        conditions: [{ field: 'subject', operator: 'contains', value: 'r1' }],
        actions: [{ type: 'markAsRead' }],
        stopProcessing: false,
      });
      const r2 = await createUserRule(userId, {
        name: 'Règle 2',
        isActive: true,
        conditionMatch: 'all',
        conditions: [{ field: 'subject', operator: 'contains', value: 'r2' }],
        actions: [{ type: 'markAsFlagged' }],
        stopProcessing: false,
      });

      await reorderUserRules(userId, [r2._id.toString(), r1._id.toString()]);
      const list = await listUserRules(userId);
      expect(list[0].name).toBe('Règle 2');
      expect(list[0].order).toBe(0);
      expect(list[1].name).toBe('Règle 1');
      expect(list[1].order).toBe(1);
    });
  });

  describe('applyRulesToIncomingMessage', () => {
    const userId = new Types.ObjectId();
    const accountId = new Types.ObjectId();

    it('applique les actions IMAP et met à jour le message en DB', async () => {
      await clearDb();

      const rule = await RuleModel.create({
        userId,
        name: 'Auto-lecture et favori newsletter',
        order: 0,
        isActive: true,
        conditionMatch: 'all',
        conditions: [{ field: 'subject', operator: 'contains', value: 'newsletter' }],
        actions: [
          { type: 'markAsRead' },
          { type: 'markAsFlagged' },
          { type: 'moveToFolder', folderName: 'News' },
        ],
        stopProcessing: true,
      });

      const messageDoc = await MessageModel.create({
        accountId,
        folder: 'INBOX',
        uid: 999,
        subject: 'Votre newsletter hebdomadaire',
        from: { name: 'News', address: 'news@site.com' },
        to: [{ name: 'Moi', address: 'moi@site.com' }],
        date: new Date(),
        flags: { seen: false, flagged: false, answered: false },
        size: 1024,
        hasAttachments: false,
      });

      const mockImapClient = {
        messageMove: vi.fn().mockResolvedValue(true),
        messageFlagsAdd: vi.fn().mockResolvedValue(true),
        messageDelete: vi.fn().mockResolvedValue(true),
      } as unknown as ImapFlow;

      await applyRulesToIncomingMessage(
        { _id: accountId, userId },
        messageDoc,
        mockImapClient,
      );

      expect(mockImapClient.messageFlagsAdd).toHaveBeenCalledWith(999, ['\\Seen'], { uid: true });
      expect(mockImapClient.messageFlagsAdd).toHaveBeenCalledWith(999, ['\\Flagged'], { uid: true });
      expect(mockImapClient.messageMove).toHaveBeenCalledWith(999, 'News', { uid: true });

      const updated = await MessageModel.findById(messageDoc._id);
      expect(updated?.folder).toBe('News');
      expect(updated?.flags.seen).toBe(true);
      expect(updated?.flags.flagged).toBe(true);
    });

    it('applique l\'action pinMessage en mettant isPinned à true', async () => {
      await clearDb();

      await RuleModel.create({
        userId,
        name: 'Auto-pin VIP',
        order: 0,
        isActive: true,
        conditionMatch: 'all',
        conditions: [{ field: 'from', operator: 'contains', value: 'vip@corp.com' }],
        actions: [{ type: 'pinMessage' }],
        stopProcessing: true,
      });

      const messageDoc = await MessageModel.create({
        accountId,
        folder: 'INBOX',
        uid: 1000,
        subject: 'Demande urgente',
        from: { name: 'VIP', address: 'vip@corp.com' },
        to: [{ name: 'Moi', address: 'moi@site.com' }],
        date: new Date(),
        flags: { seen: false, flagged: false, answered: false },
        size: 512,
        hasAttachments: false,
        isPinned: false,
      });

      const mockImapClient = {
        messageMove: vi.fn().mockResolvedValue(true),
        messageFlagsAdd: vi.fn().mockResolvedValue(true),
        messageDelete: vi.fn().mockResolvedValue(true),
      } as unknown as ImapFlow;

      await applyRulesToIncomingMessage(
        { _id: accountId, userId },
        messageDoc,
        mockImapClient,
      );

      const updated = await MessageModel.findById(messageDoc._id);
      expect(updated?.isPinned).toBe(true);
      expect(updated?.pinnedAt).toBeDefined();
    });
  });
});
