import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { setupTestDb, teardownTestDb, clearDb } from '../../test/setup.js';
import { MessageModel } from '../../models/Message.js';
import { normalizeSubject, getConversationThread } from './threadService.js';

describe('threadService', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearDb();
  });

  describe('normalizeSubject', () => {
    it('nettoie les préfixes Re:, Fwd:, etc.', () => {
      expect(normalizeSubject('Re: Projet Web')).toBe('Projet Web');
      expect(normalizeSubject('Fwd: Re: Projet Web')).toBe('Projet Web');
      expect(normalizeSubject('Aw: Fw: Re: Coucou')).toBe('Coucou');
      expect(normalizeSubject('Tr: Re: Réunion')).toBe('Réunion');
      expect(normalizeSubject('Sujet simple')).toBe('Sujet simple');
      expect(normalizeSubject('')).toBe('');
    });
  });

  describe('getConversationThread', () => {
    const accountId = new mongoose.Types.ObjectId().toString();
    const otherAccountId = new mongoose.Types.ObjectId().toString();

    it('lance 404 si le message n\'existe pas', async () => {
      await expect(
        getConversationThread(accountId, 'INBOX', 999),
      ).rejects.toThrow('Message introuvable');
    });

    it('regroupe les emails par inReplyTo et messageId dans l\'ordre chronologique', async () => {
      const msg1 = await MessageModel.create({
        accountId,
        folder: 'INBOX',
        uid: 1,
        messageId: '<msg-1@test.com>',
        subject: 'Question devis',
        from: { address: 'client@test.com', name: 'Client' },
        to: [{ address: 'me@test.com', name: 'Moi' }],
        date: new Date('2026-03-01T10:00:00Z'),
        flags: { seen: true, answered: true, flagged: false },
      });

      const msg2 = await MessageModel.create({
        accountId,
        folder: 'Sent',
        uid: 2,
        messageId: '<msg-2@test.com>',
        inReplyTo: '<msg-1@test.com>',
        subject: 'Re: Question devis',
        from: { address: 'me@test.com', name: 'Moi' },
        to: [{ address: 'client@test.com', name: 'Client' }],
        date: new Date('2026-03-01T11:00:00Z'),
        flags: { seen: true, answered: false, flagged: false },
      });

      const msg3 = await MessageModel.create({
        accountId,
        folder: 'INBOX',
        uid: 3,
        messageId: '<msg-3@test.com>',
        inReplyTo: '<msg-2@test.com>',
        subject: 'Re: Question devis',
        from: { address: 'client@test.com', name: 'Client' },
        to: [{ address: 'me@test.com', name: 'Moi' }],
        date: new Date('2026-03-01T12:00:00Z'),
        flags: { seen: false, answered: false, flagged: false },
      });

      // Email d'un autre compte avec le même sujet — ne doit PAS apparaître
      await MessageModel.create({
        accountId: otherAccountId,
        folder: 'INBOX',
        uid: 4,
        messageId: '<msg-4@test.com>',
        subject: 'Question devis',
        from: { address: 'intruder@test.com' },
        to: [{ address: 'me@test.com' }],
        date: new Date('2026-03-01T10:30:00Z'),
        flags: { seen: false, answered: false, flagged: false },
      });

      const thread = await getConversationThread(accountId, 'INBOX', 1);

      expect(thread.conversationSubject).toBe('Question devis');
      expect(thread.count).toBe(3);
      expect(thread.messages.map((m) => m.uid)).toEqual([1, 2, 3]);
      expect(thread.messages[0].from.address).toBe('client@test.com');
      expect(thread.messages[1].folder).toBe('Sent');
    });

    it('regroupe par sujet normalisé même sans en-tête inReplyTo', async () => {
      await MessageModel.create({
        accountId,
        folder: 'INBOX',
        uid: 10,
        subject: 'Point hebdomadaire',
        from: { address: 'chef@test.com' },
        to: [{ address: 'me@test.com' }],
        date: new Date('2026-03-02T09:00:00Z'),
      });

      await MessageModel.create({
        accountId,
        folder: 'INBOX',
        uid: 11,
        subject: 'Re: Point hebdomadaire',
        from: { address: 'collegue@test.com' },
        to: [{ address: 'me@test.com' }],
        date: new Date('2026-03-02T09:30:00Z'),
      });

      const thread = await getConversationThread(accountId, 'INBOX', 10);
      expect(thread.count).toBe(2);
      expect(thread.conversationSubject).toBe('Point hebdomadaire');
    });
  });
});
