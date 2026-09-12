import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { setupTestDb, teardownTestDb, clearDb } from '../../test/setup.js';
import {
  buildSmartFolderMongoQuery,
  createSmartFolder,
  listSmartFolders,
  updateSmartFolder,
  deleteSmartFolder,
  reorderSmartFolders,
  resolveSmartFolderMessages,
  getSmartFolderCounts,
} from './smartFolderService.js';
import { SmartFolderModel } from '../../models/SmartFolder.js';
import { AccountModel } from '../../models/Account.js';
import { MessageModel } from '../../models/Message.js';

describe('smartFolderService', () => {
  const userId = new Types.ObjectId().toString();
  const accountId1 = new Types.ObjectId().toString();
  const accountId2 = new Types.ObjectId().toString();

  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearDb();

    // Crée les comptes de test
    await AccountModel.create([
      {
        _id: new Types.ObjectId(accountId1),
        userId: new Types.ObjectId(userId),
        emailAddress: 'user1@example.com',
        provider: 'imap',
        imapConfig: {
          host: 'imap.example.com',
          port: 993,
          secure: true,
          smtpHost: 'smtp.example.com',
          smtpPort: 465,
          smtpSecure: true,
          username: 'u1',
          encryptedPassword: { iv: 'iv', authTag: 'tag', ciphertext: 'pass' },
        },
      },
      {
        _id: new Types.ObjectId(accountId2),
        userId: new Types.ObjectId(userId),
        emailAddress: 'user2@example.com',
        provider: 'imap',
        imapConfig: {
          host: 'imap.example.com',
          port: 993,
          secure: true,
          smtpHost: 'smtp.example.com',
          smtpPort: 465,
          smtpSecure: true,
          username: 'u2',
          encryptedPassword: { iv: 'iv', authTag: 'tag', ciphertext: 'pass' },
        },
      },
    ]);
  });

  describe('buildSmartFolderMongoQuery', () => {
    it('construit une requête multi-comptes avec exclusion de la corbeille et spam', () => {
      const query = buildSmartFolderMongoQuery(
        { query: 'is:unread has:attachment' },
        [accountId1, accountId2],
      );

      expect(query.accountId).toEqual({ $in: [accountId1, accountId2] });
      expect(query.folder).toBeDefined();
      expect(query['flags.seen']).toBe(false);
      expect(query.hasAttachments).toBe(true);
    });

    it('cible un compte unique si spécifié et autorisé', () => {
      const query = buildSmartFolderMongoQuery(
        { query: 'subject:facture', accountId: new Types.ObjectId(accountId1) },
        [accountId1, accountId2],
      );

      expect(query.accountId).toBe(accountId1);
      expect(query.subject).toEqual({ $regex: 'facture', $options: 'i' });
    });

    it('retourne une requête vide si le compte spécifié n\'appartient pas à l\'utilisateur', () => {
      const unknownId = new Types.ObjectId().toString();
      const query = buildSmartFolderMongoQuery(
        { query: 'test', accountId: new Types.ObjectId(unknownId) },
        [accountId1, accountId2],
      );

      expect(query._id).toEqual({ $exists: false });
    });

    it('gère les filtres is:pinned et tag:pro', () => {
      const query = buildSmartFolderMongoQuery(
        { query: 'is:pinned tag:urgent' },
        [accountId1],
      );

      expect(query.isPinned).toBe(true);
      expect(query.tags).toBe('urgent');
    });
  });

  describe('CRUD SmartFolder', () => {
    it('crée un dossier intelligent et calcule automatiquement l\'ordre', async () => {
      const sf1 = await createSmartFolder(userId, {
        name: 'Factures urgentes',
        query: 'facture is:unread',
        icon: 'Receipt',
        color: '#ef4444',
      });

      expect(sf1.name).toBe('Factures urgentes');
      expect(sf1.order).toBe(0);

      const sf2 = await createSmartFolder(userId, {
        name: 'Pièces jointes',
        query: 'has:attachment',
      });

      expect(sf2.order).toBe(1);

      const list = await listSmartFolders(userId);
      expect(list).toHaveLength(2);
      expect(list[0].name).toBe('Factures urgentes');
      expect(list[1].name).toBe('Pièces jointes');
    });

    it('met à jour et supprime un dossier intelligent', async () => {
      const sf = await createSmartFolder(userId, {
        name: 'À trier',
        query: 'is:unread',
      });

      const updated = await updateSmartFolder(userId, String(sf._id), {
        name: 'Non lus modifiés',
        color: '#10b981',
      });

      expect(updated.name).toBe('Non lus modifiés');
      expect(updated.color).toBe('#10b981');

      await deleteSmartFolder(userId, String(sf._id));
      const list = await listSmartFolders(userId);
      expect(list).toHaveLength(0);
    });

    it('réordonne les dossiers intelligents', async () => {
      const sf1 = await createSmartFolder(userId, { name: 'A', query: 'a' });
      const sf2 = await createSmartFolder(userId, { name: 'B', query: 'b' });

      await reorderSmartFolders(userId, [String(sf2._id), String(sf1._id)]);

      const list = await listSmartFolders(userId);
      expect(list[0].name).toBe('B');
      expect(list[1].name).toBe('A');
    });
  });

  describe('resolveSmartFolderMessages & getSmartFolderCounts', () => {
    beforeEach(async () => {
      // Insertion de faux messages
      await MessageModel.create([
        {
          accountId: accountId1,
          folder: 'INBOX',
          uid: 101,
          messageId: '<msg1@test.com>',
          subject: 'Facture Electricite',
          from: { name: 'EDF', address: 'facture@edf.fr' },
          to: [{ address: 'user1@example.com' }],
          date: new Date('2026-01-01'),
          flags: { seen: false, flagged: true },
          isPinned: true,
          tags: ['factures'],
          hasAttachments: true,
        },
        {
          accountId: accountId1,
          folder: 'INBOX',
          uid: 102,
          messageId: '<msg2@test.com>',
          subject: 'Newsletter Promo',
          from: { name: 'Shop', address: 'promo@shop.com' },
          to: [{ address: 'user1@example.com' }],
          date: new Date('2026-01-02'),
          flags: { seen: true, flagged: false },
          isPinned: false,
          tags: [],
          hasAttachments: false,
        },
        {
          accountId: accountId1,
          folder: 'Trash',
          uid: 103,
          messageId: '<msg3@test.com>',
          subject: 'Facture archivée',
          from: { name: 'Fournisseur', address: 'facture@fournisseur.com' },
          to: [{ address: 'user1@example.com' }],
          date: new Date('2026-01-03'),
          flags: { seen: false, flagged: false },
          isPinned: false,
        },
      ]);
    });

    it('résout les messages correspondant aux critères en ignorant la corbeille', async () => {
      const sf = await createSmartFolder(userId, {
        name: 'Factures',
        query: 'from:facture',
      });

      const result = await resolveSmartFolderMessages(userId, String(sf._id));
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].subject).toBe('Facture Electricite');
    });

    it('calcule correctement les compteurs totaux et non-lus', async () => {
      const sf1 = await createSmartFolder(userId, {
        name: 'Non lus',
        query: 'is:unread',
      });
      const sf2 = await createSmartFolder(userId, {
        name: 'Épinglés',
        query: 'is:pinned',
      });

      const counts = await getSmartFolderCounts(userId);
      const sf1Counts = counts[String(sf1._id)];
      const sf2Counts = counts[String(sf2._id)];

      expect(sf1Counts).toBeDefined();
      expect(sf1Counts.total).toBe(1); // Le message 101 est non lu dans INBOX, 103 est dans Trash donc exclu
      expect(sf1Counts.unread).toBe(1);

      expect(sf2Counts).toBeDefined();
      expect(sf2Counts.total).toBe(1);
      expect(sf2Counts.unread).toBe(1);
    });
  });
});
