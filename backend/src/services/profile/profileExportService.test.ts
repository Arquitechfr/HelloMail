import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportUserProfile } from './profileExportService.js';
import { UserModel } from '../../models/User.js';
import { TagModel } from '../../models/Tag.js';
import { RuleModel } from '../../models/Rule.js';
import { TemplateModel } from '../../models/Template.js';
import { SmartFolderModel } from '../../models/SmartFolder.js';
import { ContactModel } from '../../models/Contact.js';
import { SenderListModel } from '../../models/SenderList.js';
import { AccountModel } from '../../models/Account.js';
import { PgpKeyModel } from '../../models/PgpKey.js';
import { AppError } from '../../utils/AppError.js';

vi.mock('../../models/User.js');
vi.mock('../../models/Tag.js');
vi.mock('../../models/Rule.js');
vi.mock('../../models/Template.js');
vi.mock('../../models/SmartFolder.js');
vi.mock('../../models/Contact.js');
vi.mock('../../models/SenderList.js');
vi.mock('../../models/Account.js');
vi.mock('../../models/PgpKey.js');

describe('profileExportService (Lot 30.2)', () => {
  const userId = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lève AppError.notFound si l utilisateur n existe pas', async () => {
    vi.mocked(UserModel.findById).mockResolvedValueOnce(null);

    await expect(exportUserProfile(userId)).rejects.toThrowError(AppError);
  });

  it('exporte l ensemble du profil sans exposer aucun secret', async () => {
    vi.mocked(UserModel.findById).mockResolvedValueOnce({
      _id: userId,
      email: 'test@example.com',
      passwordHash: 'secret_hash_should_not_leak',
      twoFactorSecret: 'secret_2fa_should_not_leak',
      preferences: {
        displayDensity: 'compact',
        undoSendDelay: 15,
        attachmentReminderEnabled: true,
      },
    } as unknown as Parameters<typeof UserModel.findById>[0]);

    vi.mocked(TagModel.find).mockReturnValue({
      sort: vi.fn().mockResolvedValue([{ name: 'Factures', color: '#10b981', order: 0, isPreset: false }]),
    } as unknown as ReturnType<typeof TagModel.find>);

    vi.mocked(RuleModel.find).mockReturnValue({
      sort: vi.fn().mockResolvedValue([
        {
          name: 'Trier Factures',
          order: 0,
          isActive: true,
          conditionMatch: 'all',
          conditions: [{ field: 'subject', operator: 'contains', value: 'facture' }],
          actions: [{ type: 'applyTag', tagName: 'Factures' }],
          stopProcessing: false,
          isPreset: false,
        },
      ]),
    } as unknown as ReturnType<typeof RuleModel.find>);

    vi.mocked(TemplateModel.find).mockReturnValue({
      sort: vi.fn().mockResolvedValue([
        {
          title: 'Réponse Rapide',
          subject: 'Bien reçu',
          bodyHtml: '<p>Merci !</p>',
          bodyText: 'Merci !',
          shortcut: 'rr',
          order: 0,
          isPreset: false,
        },
      ]),
    } as unknown as ReturnType<typeof TemplateModel.find>);

    vi.mocked(SmartFolderModel.find).mockReturnValue({
      sort: vi.fn().mockResolvedValue([
        { name: 'Important', icon: 'Star', color: '#f59e0b', query: 'is:starred', order: 0 },
      ]),
    } as unknown as ReturnType<typeof SmartFolderModel.find>);

    vi.mocked(ContactModel.find).mockReturnValue({
      sort: vi.fn().mockResolvedValue([
        { name: 'Alice', email: 'alice@example.com', phone: '0123456789', notes: 'Collègue' },
      ]),
    } as unknown as ReturnType<typeof ContactModel.find>);

    vi.mocked(SenderListModel.find).mockReturnValue({
      sort: vi.fn().mockResolvedValue([{ type: 'deny', target: 'spammer@domain.com', note: 'Spam' }]),
    } as unknown as ReturnType<typeof SenderListModel.find>);

    vi.mocked(AccountModel.find).mockReturnValue(
      Promise.resolve([
        {
          emailAddress: 'test@example.com',
          encryptedPassword: { iv: '...', authTag: '...', ciphertext: 'leak_pwd' },
          oauthConfig: { encryptedRefreshToken: { iv: '...', authTag: '...', ciphertext: 'leak_oauth' } },
          signature: {
            enabled: true,
            text: 'Bien cordialement, Test',
            html: '<p>Bien cordialement, Test</p>',
            variables: { jobTitle: 'Ingénieur' },
          },
          aliases: [
            {
              email: 'alias@example.com',
              signature: { enabled: true, text: 'Signature Alias' },
            },
          ],
        },
      ]) as unknown as ReturnType<typeof AccountModel.find>,
    );

    vi.mocked(PgpKeyModel.find).mockReturnValue({
      sort: vi.fn().mockResolvedValue([
        {
          email: 'alice@example.com',
          name: 'Alice',
          armoredPublicKey: '-----BEGIN PGP PUBLIC KEY BLOCK-----...',
          fingerprint: '1234567890ABCDEF',
          keyId: '12345678',
          algorithm: 'RSA',
        },
      ]),
    } as unknown as ReturnType<typeof PgpKeyModel.find>);

    const payload = await exportUserProfile(userId);

    // Vérifications métadonnées
    expect(payload.metadata.version).toBe('1.0');
    expect(payload.metadata.userEmail).toBe('test@example.com');

    // Vérification des données
    expect(payload.tags).toHaveLength(1);
    expect(payload.tags?.[0].name).toBe('Factures');
    expect(payload.rules).toHaveLength(1);
    expect(payload.templates).toHaveLength(1);
    expect(payload.smartFolders).toHaveLength(1);
    expect(payload.contacts).toHaveLength(1);
    expect(payload.senderLists).toHaveLength(1);
    expect(payload.signatures).toHaveLength(2); // Compte + alias
    expect(payload.pgpPublicKeys).toHaveLength(1);

    // Vérification stricte anti-secrets
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain('secret_hash_should_not_leak');
    expect(serialized).not.toContain('secret_2fa_should_not_leak');
    expect(serialized).not.toContain('leak_pwd');
    expect(serialized).not.toContain('leak_oauth');
    expect(serialized).not.toContain('encryptedPassword');
    expect(serialized).not.toContain('passwordHash');
    expect(serialized).not.toContain('twoFactorSecret');
  });
});
