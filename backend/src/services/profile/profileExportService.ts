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
import type { IMailoraProfilePayload } from './profileCryptoService.js';

const FORBIDDEN_SECRET_KEYS = [
  'encryptedPassword',
  'passwordHash',
  'twoFactorSecret',
  'twoFactorBackupCodes',
  'armoredPrivateKey',
  'encryptedRefreshToken',
];

/**
 * Exporte l'intégralité du profil de l'utilisateur sous forme de payload structuré.
 * Filtre strictement toutes les clés secrètes pour garantir une sécurité absolue.
 */
export async function exportUserProfile(userId: string): Promise<IMailoraProfilePayload> {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw AppError.notFound('Utilisateur introuvable');
  }

  const [tags, rules, templates, smartFolders, contacts, senderLists, accounts, pgpKeys] =
    await Promise.all([
      TagModel.find({ userId }).sort({ order: 1, createdAt: 1 }),
      RuleModel.find({ userId }).sort({ order: 1, createdAt: 1 }),
      TemplateModel.find({ userId }).sort({ order: 1, createdAt: 1 }),
      SmartFolderModel.find({ userId }).sort({ order: 1, createdAt: 1 }),
      ContactModel.find({ userId }).sort({ name: 1 }),
      SenderListModel.find({ userId }).sort({ target: 1 }),
      AccountModel.find({ userId }),
      PgpKeyModel.find({ userId, isOwnKey: false }).sort({ email: 1 }),
    ]);

  // Extraction sécurisée des signatures sans exposer les identifiants ou configs de serveurs
  const signatures: NonNullable<IMailoraProfilePayload['signatures']> = [];
  for (const account of accounts) {
    if (account.signature && (account.signature.text || account.signature.html)) {
      signatures.push({
        accountEmail: account.emailAddress,
        isAlias: false,
        signature: {
          enabled: account.signature.enabled,
          text: account.signature.text,
          html: account.signature.html,
          variables: account.signature.variables,
        },
      });
    }

    if (account.aliases && account.aliases.length > 0) {
      for (const alias of account.aliases) {
        if (alias.signature && (alias.signature.text || alias.signature.html)) {
          signatures.push({
            accountEmail: account.emailAddress,
            isAlias: true,
            aliasEmail: alias.email,
            signature: {
              enabled: alias.signature.enabled,
              text: alias.signature.text,
              html: alias.signature.html,
              variables: alias.signature.variables,
            },
          });
        }
      }
    }
  }

  const payload: IMailoraProfilePayload = {
    metadata: {
      version: '1.0',
      generator: 'Mailora Profile Backup',
      exportedAt: new Date().toISOString(),
      userEmail: user.email,
    },
    preferences: user.preferences ? (user.preferences as unknown as Record<string, unknown>) : {},
    tags: tags.map((t) => ({
      name: t.name,
      color: t.color,
      order: t.order,
      isPreset: t.isPreset,
    })),
    rules: rules.map((r) => ({
      name: r.name,
      order: r.order,
      isActive: r.isActive,
      conditionMatch: r.conditionMatch,
      conditions: r.conditions.map((c) => ({
        field: c.field,
        operator: c.operator,
        value: c.value,
      })),
      actions: r.actions.map((a) => ({
        type: a.type,
        folderName: a.folderName,
        tagName: a.tagName,
      })),
      stopProcessing: r.stopProcessing,
      isPreset: r.isPreset,
    })),
    templates: templates.map((tmpl) => ({
      title: tmpl.title,
      subject: tmpl.subject,
      bodyHtml: tmpl.bodyHtml,
      bodyText: tmpl.bodyText,
      shortcut: tmpl.shortcut,
      order: tmpl.order,
      isPreset: tmpl.isPreset,
    })),
    smartFolders: smartFolders.map((sf) => ({
      name: sf.name,
      icon: sf.icon,
      color: sf.color,
      query: sf.query,
      order: sf.order,
    })),
    contacts: contacts.map((c) => ({
      name: c.name,
      email: c.email,
      phone: c.phone,
      notes: c.notes,
    })),
    senderLists: senderLists.map((sl) => ({
      type: sl.type,
      target: sl.target,
      note: sl.note,
    })),
    signatures,
    pgpPublicKeys: pgpKeys.map((k) => ({
      email: k.email,
      name: k.name,
      armoredPublicKey: k.armoredPublicKey,
      fingerprint: k.fingerprint,
      keyId: k.keyId,
      algorithm: k.algorithm,
    })),
  };

  // Garde-fou d'audit : interdiction absolue de toute clé sensible dans le flux exporté
  const serialized = JSON.stringify(payload);
  for (const forbidden of FORBIDDEN_SECRET_KEYS) {
    if (serialized.includes(`"${forbidden}"`)) {
      throw new Error(`Alerte de sécurité critique : la clé sensible '${forbidden}' a été détectée dans l export`);
    }
  }

  return payload;
}
