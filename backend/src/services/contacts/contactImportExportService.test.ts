import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDb, teardownTestDb, clearDb } from '../../test/setup.js';
import { ContactModel } from '../../models/Contact.js';
import {
  exportToVCard,
  parseVCard,
  exportToCsv,
  parseCsv,
  importContacts,
} from './contactImportExportService.js';

describe('contactImportExportService', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearDb();
  });

  describe('vCard (RFC 6350)', () => {
    it('exporte et ré-importe correctement en vCard', () => {
      const contacts = [
        { name: 'Jean Dupont', email: 'jean.dupont@test.com', phone: '+33612345678', notes: 'Ami de promo' },
        { name: 'Alice Martin', email: 'alice@test.com' },
      ];

      const vcf = exportToVCard(contacts);
      expect(vcf).toContain('BEGIN:VCARD');
      expect(vcf).toContain('FN:Jean Dupont');
      expect(vcf).toContain('EMAIL;TYPE=INTERNET:jean.dupont@test.com');
      expect(vcf).toContain('TEL;TYPE=VOICE:+33612345678');
      expect(vcf).toContain('NOTE:Ami de promo');

      const parsed = parseVCard(vcf);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].name).toBe('Jean Dupont');
      expect(parsed[0].email).toBe('jean.dupont@test.com');
      expect(parsed[0].phone).toBe('+33612345678');
      expect(parsed[0].notes).toBe('Ami de promo');
      expect(parsed[1].name).toBe('Alice Martin');
      expect(parsed[1].email).toBe('alice@test.com');
    });

    it('ignore les vCards sans email valide', () => {
      const vcf = `BEGIN:VCARD
VERSION:3.0
FN:Sans Email
NOTE:Test
END:VCARD`;

      const parsed = parseVCard(vcf);
      expect(parsed).toHaveLength(0);
    });
  });

  describe('CSV (RFC 4180)', () => {
    it('exporte et ré-importe correctement en CSV avec caractères spéciaux', () => {
      const contacts = [
        { name: 'Martin, Paul', email: 'paul@test.com', phone: '0102030405', notes: 'Note avec, virgule et "guillemets"' },
        { name: 'Sophie', email: 'sophie@test.com' },
      ];

      const csv = exportToCsv(contacts);
      expect(csv).toContain('Nom,Email,Téléphone,Notes');
      expect(csv).toContain('"Martin, Paul"');
      expect(csv).toContain('""guillemets""');

      const parsed = parseCsv(csv);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].name).toBe('Martin, Paul');
      expect(parsed[0].email).toBe('paul@test.com');
      expect(parsed[0].notes).toBe('Note avec, virgule et "guillemets"');
      expect(parsed[1].name).toBe('Sophie');
      expect(parsed[1].email).toBe('sophie@test.com');
    });

    it('gère les en-têtes anglais (Name, Email, Phone, Comments)', () => {
      const csv = `Name,Email,Phone,Comments
Charlie,charlie@test.com,555-1234,VIP Client`;

      const parsed = parseCsv(csv);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].name).toBe('Charlie');
      expect(parsed[0].email).toBe('charlie@test.com');
      expect(parsed[0].phone).toBe('555-1234');
      expect(parsed[0].notes).toBe('VIP Client');
    });
  });

  describe('importContacts', () => {
    it('insère les nouveaux contacts et ignore les doublons', async () => {
      const userId = '507f1f77bcf86cd799439011';

      // 1. Créer un contact existant
      await ContactModel.create({
        userId,
        name: 'Existant',
        email: 'existant@test.com',
      });

      // 2. Importer une liste contenant l'existant + 2 nouveaux + 1 doublon interne
      const toImport = [
        { name: 'Nouveau 1', email: 'nouveau1@test.com' },
        { name: 'Existant Clone', email: 'existant@test.com' },
        { name: 'Nouveau 2', email: 'nouveau2@test.com' },
        { name: 'Nouveau 1 Bis', email: 'nouveau1@test.com' },
      ];

      const result = await importContacts(userId, toImport);

      expect(result.imported).toBe(2);
      expect(result.skipped).toBe(2);

      const all = await ContactModel.find({ userId });
      expect(all).toHaveLength(3);
    });
  });
});
