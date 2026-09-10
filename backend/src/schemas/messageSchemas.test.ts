import { describe, it, expect } from 'vitest';
import {
  sendEmailSchema,
  flagsUpdateSchema,
  moveMessageSchema,
  batchActionSchema,
} from './messageSchemas.js';

describe('messageSchemas', () => {
  describe('sendEmailSchema', () => {
    it('valide un envoi nominal', () => {
      const result = sendEmailSchema.parse({
        to: ['bob@test.com'],
        subject: 'Test',
        text: 'Hello',
      });

      expect(result.to).toEqual(['bob@test.com']);
    });

    it('rejette si aucun destinataire', () => {
      expect(() => sendEmailSchema.parse({ to: [], subject: 'Test', text: 'Hello' })).toThrow();
    });

    it('rejette un email invalide', () => {
      expect(() =>
        sendEmailSchema.parse({ to: ['invalid'], subject: 'Test', text: 'Hello' }),
      ).toThrow();
    });

    it('rejette un sujet trop long (>998)', () => {
      expect(() =>
        sendEmailSchema.parse({ to: ['bob@test.com'], subject: 'x'.repeat(999), text: 'Hello' }),
      ).toThrow();
    });

    it('accepte les pièces jointes', () => {
      const result = sendEmailSchema.parse({
        to: ['bob@test.com'],
        subject: 'Test',
        text: 'Hello',
        attachments: [{ filename: 'doc.pdf', content: 'base64data' }],
      });

      expect(result.attachments).toHaveLength(1);
    });

    it('rejette plus de 20 pièces jointes', () => {
      const attachments = Array.from({ length: 21 }, (_, i) => ({
        filename: `file${i}.txt`,
        content: 'x',
      }));

      expect(() =>
        sendEmailSchema.parse({ to: ['bob@test.com'], subject: 'Test', text: 'Hello', attachments }),
      ).toThrow();
    });

    it('accepte cc, bcc, replyTo, html, inReplyTo, references', () => {
      const result = sendEmailSchema.parse({
        to: ['bob@test.com'],
        cc: ['carol@test.com'],
        bcc: ['dave@test.com'],
        replyTo: 'reply@test.com',
        subject: 'Test',
        text: 'Hello',
        html: '<p>Hello</p>',
        inReplyTo: '<orig@test.com>',
        references: ['<orig@test.com>'],
      });

      expect(result.cc).toEqual(['carol@test.com']);
      expect(result.bcc).toEqual(['dave@test.com']);
      expect(result.replyTo).toBe('reply@test.com');
    });
  });

  describe('flagsUpdateSchema', () => {
    it('valide avec seen=true', () => {
      const result = flagsUpdateSchema.parse({ seen: true });
      expect(result.seen).toBe(true);
    });

    it('rejette si aucun flag spécifié', () => {
      expect(() => flagsUpdateSchema.parse({})).toThrow();
    });
  });

  describe('moveMessageSchema', () => {
    it('valide avec destination', () => {
      const result = moveMessageSchema.parse({ destination: 'Archive' });
      expect(result.destination).toBe('Archive');
    });

    it('rejette sans destination', () => {
      expect(() => moveMessageSchema.parse({})).toThrow();
    });
  });

  describe('batchActionSchema', () => {
    it('valide markRead avec uids', () => {
      const result = batchActionSchema.parse({ uids: [1, 2, 3], action: 'markRead' });
      expect(result.action).toBe('markRead');
    });

    it('rejette plus de 100 uids', () => {
      const uids = Array.from({ length: 101 }, (_, i) => i + 1);
      expect(() => batchActionSchema.parse({ uids, action: 'markRead' })).toThrow();
    });

    it('rejette un uid négatif', () => {
      expect(() => batchActionSchema.parse({ uids: [-1], action: 'markRead' })).toThrow();
    });

    it('rejette une action invalide', () => {
      expect(() => batchActionSchema.parse({ uids: [1], action: 'invalid' })).toThrow();
    });

    it('rejette move sans destination', () => {
      expect(() => batchActionSchema.parse({ uids: [1], action: 'move' })).toThrow();
    });

    it('accepte move avec destination', () => {
      const result = batchActionSchema.parse({ uids: [1], action: 'move', destination: 'Archive' });
      expect(result.destination).toBe('Archive');
    });

    it('accepte markAsJunk', () => {
      const result = batchActionSchema.parse({ uids: [1, 2], action: 'markAsJunk' });
      expect(result.action).toBe('markAsJunk');
    });
  });
});
