import { describe, it, expect, vi, beforeEach } from 'vitest';
import { previewProfile, restoreProfile } from './profileImportService.js';
import { UserModel } from '../../models/User.js';
import { TagModel } from '../../models/Tag.js';
import { RuleModel } from '../../models/Rule.js';
import { TemplateModel } from '../../models/Template.js';
import { SmartFolderModel } from '../../models/SmartFolder.js';
import { ContactModel } from '../../models/Contact.js';
import { SenderListModel } from '../../models/SenderList.js';
import { AccountModel } from '../../models/Account.js';
import type { IMailoraProfilePayload } from './profileCryptoService.js';

vi.mock('../../models/User.js');
vi.mock('../../models/Tag.js');
vi.mock('../../models/Rule.js');
vi.mock('../../models/Template.js');
vi.mock('../../models/SmartFolder.js');
vi.mock('../../models/Contact.js');
vi.mock('../../models/SenderList.js');
vi.mock('../../models/Account.js');

describe('profileImportService (Lot 30.3)', () => {
  const userId = '507f1f77bcf86cd799439011';

  const testPayload: IMailoraProfilePayload = {
    metadata: {
      version: '1.0',
      generator: 'Mailora Profile Backup',
      exportedAt: '2026-09-12T12:00:00.000Z',
      userEmail: 'user@example.com',
    },
    preferences: {
      displayDensity: 'compact',
    },
    tags: [
      { name: 'Urgent', color: '#ff0000', order: 0 },
      { name: 'NouveauTag', color: '#00ff00', order: 1 },
    ],
    rules: [
      {
        name: 'RègleExistante',
        conditionMatch: 'all',
        conditions: [{ field: 'from', operator: 'contains', value: 'bot' }],
        actions: [{ type: 'markAsRead' }],
      },
    ],
    templates: [
      {
        title: 'Modèle 1',
        bodyHtml: '<p>Test</p>',
        bodyText: 'Test',
      },
    ],
    contacts: [
      {
        name: 'Bob',
        email: 'bob@example.com',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('previewProfile', () => {
    it('calcule correctement les statistiques des éléments existants et nouveaux', async () => {
      vi.mocked(TagModel.find).mockReturnValue({
        select: vi.fn().mockResolvedValue([{ name: 'Urgent' }]),
      } as unknown as ReturnType<typeof TagModel.find>);

      vi.mocked(RuleModel.find).mockReturnValue({
        select: vi.fn().mockResolvedValue([{ name: 'RègleExistante' }]),
      } as unknown as ReturnType<typeof RuleModel.find>);

      vi.mocked(TemplateModel.find).mockReturnValue({
        select: vi.fn().mockResolvedValue([]),
      } as unknown as ReturnType<typeof TemplateModel.find>);

      vi.mocked(SmartFolderModel.find).mockReturnValue({
        select: vi.fn().mockResolvedValue([]),
      } as unknown as ReturnType<typeof SmartFolderModel.find>);

      vi.mocked(ContactModel.find).mockReturnValue({
        select: vi.fn().mockResolvedValue([]),
      } as unknown as ReturnType<typeof ContactModel.find>);

      vi.mocked(SenderListModel.find).mockReturnValue({
        select: vi.fn().mockResolvedValue([]),
      } as unknown as ReturnType<typeof SenderListModel.find>);

      vi.mocked(AccountModel.find).mockReturnValue({
        select: vi.fn().mockResolvedValue([]),
      } as unknown as ReturnType<typeof AccountModel.find>);

      const preview = await previewProfile(userId, testPayload, false);

      expect(preview.isEncrypted).toBe(false);
      expect(preview.summary.tags.total).toBe(2);
      expect(preview.summary.tags.existing).toBe(1); // 'Urgent'
      expect(preview.summary.tags.new).toBe(1); // 'NouveauTag'

      expect(preview.summary.rules.total).toBe(1);
      expect(preview.summary.rules.existing).toBe(1);
      expect(preview.summary.rules.new).toBe(0);

      expect(preview.summary.templates.total).toBe(1);
      expect(preview.summary.templates.new).toBe(1);

      expect(preview.summary.hasPreferences).toBe(true);
    });
  });

  describe('restoreProfile', () => {
    it('applique la stratégie skip sans écraser les éléments existants', async () => {
      const mockExistingTag = { name: 'Urgent', color: '#111111', save: vi.fn() };
      vi.mocked(TagModel.findOne)
        .mockReturnValueOnce(Promise.resolve(mockExistingTag) as unknown as ReturnType<typeof TagModel.findOne>)
        .mockReturnValueOnce(Promise.resolve(null) as unknown as ReturnType<typeof TagModel.findOne>);

      vi.mocked(TagModel.create).mockImplementation(vi.fn().mockResolvedValue({}));

      const report = await restoreProfile(userId, testPayload, ['tags'], 'skip');

      expect(report.imported.tags).toBe(1); // 'NouveauTag' inséré
      expect(report.skipped.tags).toBe(1); // 'Urgent' ignoré
      expect(report.updated.tags).toBe(0);
      expect(mockExistingTag.save).not.toHaveBeenCalled();
      expect(TagModel.create).toHaveBeenCalledWith({
        userId,
        name: 'NouveauTag',
        color: '#00ff00',
        order: 1,
      });
    });

    it('applique la stratégie overwrite et met à jour les éléments existants', async () => {
      const mockExistingTag = { name: 'Urgent', color: '#111111', save: vi.fn().mockResolvedValue(true) };
      vi.mocked(TagModel.findOne)
        .mockReturnValueOnce(Promise.resolve(mockExistingTag) as unknown as ReturnType<typeof TagModel.findOne>)
        .mockReturnValueOnce(Promise.resolve(null) as unknown as ReturnType<typeof TagModel.findOne>);

      vi.mocked(TagModel.create).mockImplementation(vi.fn().mockResolvedValue({}));

      const report = await restoreProfile(userId, testPayload, ['tags'], 'overwrite');

      expect(report.imported.tags).toBe(1);
      expect(report.updated.tags).toBe(1);
      expect(mockExistingTag.color).toBe('#ff0000');
      expect(mockExistingTag.save).toHaveBeenCalled();
    });

    it('restaure les préférences utilisateur avec succès', async () => {
      const mockUser = {
        preferences: { undoSendDelay: 5 },
        save: vi.fn().mockResolvedValue(true),
      };
      vi.mocked(UserModel.findById).mockResolvedValueOnce(mockUser as unknown as ReturnType<typeof UserModel.findById>);

      const report = await restoreProfile(userId, testPayload, ['preferences'], 'skip');

      expect(report.imported.preferences).toBe(1);
      expect(mockUser.preferences).toEqual({
        undoSendDelay: 5,
        displayDensity: 'compact',
      });
      expect(mockUser.save).toHaveBeenCalled();
    });
  });
});
