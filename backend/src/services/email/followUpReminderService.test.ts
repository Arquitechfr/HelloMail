import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { setupTestDb, teardownTestDb, clearDb } from '../../test/setup.js';
import { MessageModel } from '../../models/Message.js';
import { FollowUpReminderModel } from '../../models/FollowUpReminder.js';
import {
  createOrUpdateReminder,
  createReminderForSentMessage,
  getReminderForMessage,
  listReminders,
  snoozeReminder,
  dismissReminder,
  cancelReminder,
} from './followUpReminderService.js';

describe('followUpReminderService', () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const accountId = new mongoose.Types.ObjectId().toString();

  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearDb();
  });

  describe('createOrUpdateReminder', () => {
    it('échoue si le message cible est introuvable', async () => {
      const futureDate = new Date(Date.now() + 86400000);
      await expect(
        createOrUpdateReminder(userId, accountId, 'Sent', 999, { remindAt: futureDate }),
      ).rejects.toThrow('Message introuvable');
    });

    it('échoue si la date d\'échéance est dans le passé', async () => {
      await MessageModel.create({
        accountId,
        folder: 'Sent',
        uid: 10,
        subject: 'Devis urgent',
        from: { address: 'me@example.com' },
        to: [{ address: 'prospect@example.com' }],
        date: new Date(),
        flags: { seen: true, answered: false, flagged: false },
      });

      const pastDate = new Date(Date.now() - 10000);
      await expect(
        createOrUpdateReminder(userId, accountId, 'Sent', 10, { remindAt: pastDate }),
      ).rejects.toThrow('futur');
    });

    it('crée un rappel valide et synchronise MessageModel', async () => {
      const msg = await MessageModel.create({
        accountId,
        folder: 'Sent',
        uid: 10,
        messageId: '<msg-10@domain.tld>',
        subject: 'Re: Proposition commerciale',
        from: { address: 'me@example.com' },
        to: [{ address: 'client@prospect.com' }],
        date: new Date(),
        flags: { seen: true, answered: false, flagged: false },
      });

      const futureDate = new Date(Date.now() + 172800000); // dans 2 jours
      const reminder = await createOrUpdateReminder(userId, accountId, 'Sent', 10, {
        remindAt: futureDate,
        note: 'Vérifier réponse avant vendredi',
      });

      expect(reminder).toBeDefined();
      expect(reminder.status).toBe('pending');
      expect(reminder.threadSubject).toBe('Proposition commerciale');
      expect(reminder.targetRecipient).toBe('client@prospect.com');
      expect(reminder.note).toBe('Vérifier réponse avant vendredi');

      // Vérifie la synchronisation atomique sur MessageModel
      const updatedMsg = await MessageModel.findById(msg._id);
      expect(updatedMsg?.followUpStatus).toBe('pending');
      expect(updatedMsg?.followUpRemindAt?.getTime()).toBe(futureDate.getTime());
    });

    it('annule le précédent rappel non résolu pour le même message lors d\'une recréation', async () => {
      await MessageModel.create({
        accountId,
        folder: 'Sent',
        uid: 12,
        subject: 'Contrat partenariat',
        from: { address: 'me@example.com' },
        to: [{ address: 'partenaire@prospect.com' }],
        date: new Date(),
        flags: { seen: true, answered: false, flagged: false },
      });

      const date1 = new Date(Date.now() + 86400000);
      const r1 = await createOrUpdateReminder(userId, accountId, 'Sent', 12, { remindAt: date1 });

      const date2 = new Date(Date.now() + 172800000);
      const r2 = await createOrUpdateReminder(userId, accountId, 'Sent', 12, { remindAt: date2 });

      const r1Reloaded = await FollowUpReminderModel.findById(r1._id);
      expect(r1Reloaded?.status).toBe('cancelled');
      expect(r2.status).toBe('pending');
    });
  });

  describe('createReminderForSentMessage', () => {
    it('enregistre le rappel pour un message envoyé', async () => {
      const futureDate = new Date(Date.now() + 86400000);
      const reminder = await createReminderForSentMessage(
        userId,
        accountId,
        '<sent-1@domain.tld>',
        'Fwd: Offre spéciale',
        'contact@client.fr',
        'Sent',
        25,
        { remindAt: futureDate, note: 'Relancer si pas de signature' },
      );

      expect(reminder.messageId).toBe('<sent-1@domain.tld>');
      expect(reminder.threadSubject).toBe('Offre spéciale');
      expect(reminder.targetRecipient).toBe('contact@client.fr');
      expect(reminder.status).toBe('pending');
    });
  });

  describe('snoozeReminder, dismissReminder, cancelReminder', () => {
    it('permet de repousser l\'échéance (snooze)', async () => {
      await MessageModel.create({
        accountId,
        folder: 'Sent',
        uid: 30,
        subject: 'Facture #402',
        from: { address: 'me@example.com' },
        to: [{ address: 'compta@client.com' }],
        date: new Date(),
        flags: { seen: true, answered: false, flagged: false },
      });

      const r = await createOrUpdateReminder(userId, accountId, 'Sent', 30, {
        remindAt: new Date(Date.now() + 86400000),
      });

      const newDate = new Date(Date.now() + 259200000); // dans 3 jours
      const snoozed = await snoozeReminder(userId, accountId, r._id.toString(), newDate);

      expect(snoozed.remindAt.getTime()).toBe(newDate.getTime());
      expect(snoozed.status).toBe('pending');

      const msg = await MessageModel.findOne({ accountId, folder: 'Sent', uid: 30 });
      expect(msg?.followUpRemindAt?.getTime()).toBe(newDate.getTime());
    });

    it('permet d\'acquitter le rappel (dismiss)', async () => {
      await MessageModel.create({
        accountId,
        folder: 'Sent',
        uid: 31,
        subject: 'Facture #403',
        from: { address: 'me@example.com' },
        to: [{ address: 'compta@client.com' }],
        date: new Date(),
        flags: { seen: true, answered: false, flagged: false },
      });

      const r = await createOrUpdateReminder(userId, accountId, 'Sent', 31, {
        remindAt: new Date(Date.now() + 86400000),
      });

      const dismissed = await dismissReminder(userId, accountId, r._id.toString());
      expect(dismissed.status).toBe('dismissed');
      expect(dismissed.dismissedAt).toBeDefined();

      const msg = await MessageModel.findOne({ accountId, folder: 'Sent', uid: 31 });
      expect(msg?.followUpStatus).toBe('dismissed');
    });

    it('permet d\'annuler le rappel (cancel)', async () => {
      await MessageModel.create({
        accountId,
        folder: 'Sent',
        uid: 32,
        subject: 'Test annulation',
        from: { address: 'me@example.com' },
        to: [{ address: 'test@client.com' }],
        date: new Date(),
        flags: { seen: true, answered: false, flagged: false },
      });

      const r = await createOrUpdateReminder(userId, accountId, 'Sent', 32, {
        remindAt: new Date(Date.now() + 86400000),
      });

      const cancelled = await cancelReminder(userId, accountId, r._id.toString());
      expect(cancelled.status).toBe('cancelled');

      const msg = await MessageModel.findOne({ accountId, folder: 'Sent', uid: 32 });
      expect(msg?.followUpStatus).toBeNull();
      expect(msg?.followUpRemindAt).toBeNull();
    });
  });

  describe('listReminders et getReminderForMessage', () => {
    it('liste les rappels paginés et triés', async () => {
      await MessageModel.create({
        accountId,
        folder: 'Sent',
        uid: 41,
        subject: 'Mail A',
        from: { address: 'me@example.com' },
        to: [{ address: 'a@client.com' }],
        date: new Date(),
        flags: { seen: true, answered: false, flagged: false },
      });

      await createOrUpdateReminder(userId, accountId, 'Sent', 41, {
        remindAt: new Date(Date.now() + 86400000),
      });

      const res = await listReminders(userId, accountId, 'pending', 1, 10);
      expect(res.total).toBe(1);
      expect(res.items.length).toBe(1);
      expect(res.items[0].uid).toBe(41);

      const item = await getReminderForMessage(accountId, 'Sent', 41);
      expect(item).toBeDefined();
      expect(item?.uid).toBe(41);
    });
  });
});
