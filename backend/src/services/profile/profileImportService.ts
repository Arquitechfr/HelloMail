import { UserModel } from '../../models/User.js';
import { TagModel } from '../../models/Tag.js';
import { RuleModel } from '../../models/Rule.js';
import { TemplateModel } from '../../models/Template.js';
import { SmartFolderModel } from '../../models/SmartFolder.js';
import { ContactModel } from '../../models/Contact.js';
import { SenderListModel } from '../../models/SenderList.js';
import { AccountModel } from '../../models/Account.js';
import type { IMailoraProfilePayload } from './profileCryptoService.js';
import type { ProfileSectionKey } from '../../schemas/profileSchemas.js';

export interface IProfilePreviewResult {
  isEncrypted: boolean;
  metadata: IMailoraProfilePayload['metadata'];
  summary: {
    tags: { total: number; existing: number; new: number };
    rules: { total: number; existing: number; new: number };
    templates: { total: number; existing: number; new: number };
    smartFolders: { total: number; existing: number; new: number };
    contacts: { total: number; existing: number; new: number };
    senderLists: { total: number; existing: number; new: number };
    signatures: { total: number; matchingAccounts: number };
    hasPreferences: boolean;
  };
}

export interface IRestoreReport {
  imported: Record<string, number>;
  updated: Record<string, number>;
  skipped: Record<string, number>;
}

/**
 * Analyse une sauvegarde de profil par rapport aux données existantes de l'utilisateur.
 */
export async function previewProfile(
  userId: string,
  payload: IMailoraProfilePayload,
  isEncrypted = false,
): Promise<IProfilePreviewResult> {
  const [existingTags, existingRules, existingTemplates, existingSmartFolders, existingContacts, existingSenderLists, accounts] =
    await Promise.all([
      TagModel.find({ userId }).select('name'),
      RuleModel.find({ userId }).select('name'),
      TemplateModel.find({ userId }).select('title'),
      SmartFolderModel.find({ userId }).select('name'),
      ContactModel.find({ userId }).select('email'),
      SenderListModel.find({ userId }).select('type target'),
      AccountModel.find({ userId }).select('emailAddress aliases.email'),
    ]);

  const tagNames = new Set(existingTags.map((t) => t.name.toLowerCase()));
  const ruleNames = new Set(existingRules.map((r) => r.name.toLowerCase()));
  const templateTitles = new Set(existingTemplates.map((t) => t.title.toLowerCase()));
  const sfNames = new Set(existingSmartFolders.map((sf) => sf.name.toLowerCase()));
  const contactEmails = new Set(existingContacts.map((c) => c.email.toLowerCase()));
  const senderListKeys = new Set(existingSenderLists.map((sl) => `${sl.type}:${sl.target.toLowerCase()}`));

  const accountEmails = new Set<string>();
  for (const acc of accounts) {
    accountEmails.add(acc.emailAddress.toLowerCase());
    if (acc.aliases) {
      for (const al of acc.aliases) {
        accountEmails.add(al.email.toLowerCase());
      }
    }
  }

  const tags = payload.tags || [];
  const rules = payload.rules || [];
  const templates = payload.templates || [];
  const smartFolders = payload.smartFolders || [];
  const contacts = payload.contacts || [];
  const senderLists = payload.senderLists || [];
  const signatures = payload.signatures || [];

  return {
    isEncrypted,
    metadata: payload.metadata,
    summary: {
      tags: {
        total: tags.length,
        existing: tags.filter((t) => tagNames.has(t.name.toLowerCase())).length,
        new: tags.filter((t) => !tagNames.has(t.name.toLowerCase())).length,
      },
      rules: {
        total: rules.length,
        existing: rules.filter((r) => ruleNames.has(r.name.toLowerCase())).length,
        new: rules.filter((r) => !ruleNames.has(r.name.toLowerCase())).length,
      },
      templates: {
        total: templates.length,
        existing: templates.filter((t) => templateTitles.has(t.title.toLowerCase())).length,
        new: templates.filter((t) => !templateTitles.has(t.title.toLowerCase())).length,
      },
      smartFolders: {
        total: smartFolders.length,
        existing: smartFolders.filter((sf) => sfNames.has(sf.name.toLowerCase())).length,
        new: smartFolders.filter((sf) => !sfNames.has(sf.name.toLowerCase())).length,
      },
      contacts: {
        total: contacts.length,
        existing: contacts.filter((c) => contactEmails.has(c.email.toLowerCase())).length,
        new: contacts.filter((c) => !contactEmails.has(c.email.toLowerCase())).length,
      },
      senderLists: {
        total: senderLists.length,
        existing: senderLists.filter((sl) => senderListKeys.has(`${sl.type}:${sl.target.toLowerCase()}`)).length,
        new: senderLists.filter((sl) => !senderListKeys.has(`${sl.type}:${sl.target.toLowerCase()}`)).length,
      },
      signatures: {
        total: signatures.length,
        matchingAccounts: signatures.filter((s) =>
          s.isAlias && s.aliasEmail
            ? accountEmails.has(s.aliasEmail.toLowerCase())
            : accountEmails.has(s.accountEmail.toLowerCase()),
        ).length,
      },
      hasPreferences: Boolean(payload.preferences && Object.keys(payload.preferences).length > 0),
    },
  };
}

/**
 * Restaure de façon granulaire les modules sélectionnés selon la stratégie de conflit choisie.
 */
export async function restoreProfile(
  userId: string,
  payload: IMailoraProfilePayload,
  sections: ProfileSectionKey[],
  conflictStrategy: 'skip' | 'overwrite',
): Promise<IRestoreReport> {
  const report: IRestoreReport = {
    imported: {},
    updated: {},
    skipped: {},
  };

  // 1. Préférences
  if (sections.includes('preferences') && payload.preferences) {
    const user = await UserModel.findById(userId);
    if (user) {
      user.preferences = {
        ...(user.preferences || {}),
        ...payload.preferences,
      };
      await user.save();
      report.imported.preferences = 1;
    }
  }

  // 2. Libellés (Tags)
  if (sections.includes('tags') && payload.tags) {
    report.imported.tags = 0;
    report.updated.tags = 0;
    report.skipped.tags = 0;
    for (const tag of payload.tags) {
      const existing = await TagModel.findOne({ userId, name: tag.name });
      if (!existing) {
        await TagModel.create({ userId, ...tag });
        report.imported.tags++;
      } else if (conflictStrategy === 'overwrite') {
        existing.color = tag.color;
        if (tag.order !== undefined) existing.order = tag.order;
        await existing.save();
        report.updated.tags++;
      } else {
        report.skipped.tags++;
      }
    }
  }

  // 3. Règles
  if (sections.includes('rules') && payload.rules) {
    report.imported.rules = 0;
    report.updated.rules = 0;
    report.skipped.rules = 0;
    for (const rule of payload.rules) {
      const existing = await RuleModel.findOne({ userId, name: rule.name });
      if (!existing) {
        await RuleModel.create({ userId, ...rule });
        report.imported.rules++;
      } else if (conflictStrategy === 'overwrite') {
        existing.conditionMatch = rule.conditionMatch;
        existing.conditions = rule.conditions;
        existing.actions = rule.actions;
        if (rule.isActive !== undefined) existing.isActive = rule.isActive;
        if (rule.stopProcessing !== undefined) existing.stopProcessing = rule.stopProcessing;
        await existing.save();
        report.updated.rules++;
      } else {
        report.skipped.rules++;
      }
    }
  }

  // 4. Modèles
  if (sections.includes('templates') && payload.templates) {
    report.imported.templates = 0;
    report.updated.templates = 0;
    report.skipped.templates = 0;
    for (const tmpl of payload.templates) {
      const existing = await TemplateModel.findOne({ userId, title: tmpl.title });
      if (!existing) {
        await TemplateModel.create({ userId, ...tmpl });
        report.imported.templates++;
      } else if (conflictStrategy === 'overwrite') {
        existing.bodyHtml = tmpl.bodyHtml;
        existing.bodyText = tmpl.bodyText;
        if (tmpl.subject !== undefined) existing.subject = tmpl.subject;
        if (tmpl.shortcut !== undefined) existing.shortcut = tmpl.shortcut;
        await existing.save();
        report.updated.templates++;
      } else {
        report.skipped.templates++;
      }
    }
  }

  // 5. Dossiers Intelligents
  if (sections.includes('smartFolders') && payload.smartFolders) {
    report.imported.smartFolders = 0;
    report.updated.smartFolders = 0;
    report.skipped.smartFolders = 0;
    for (const sf of payload.smartFolders) {
      const existing = await SmartFolderModel.findOne({ userId, name: sf.name });
      if (!existing) {
        await SmartFolderModel.create({ userId, ...sf });
        report.imported.smartFolders++;
      } else if (conflictStrategy === 'overwrite') {
        existing.query = sf.query;
        if (sf.icon) existing.icon = sf.icon;
        if (sf.color) existing.color = sf.color;
        await existing.save();
        report.updated.smartFolders++;
      } else {
        report.skipped.smartFolders++;
      }
    }
  }

  // 6. Contacts
  if (sections.includes('contacts') && payload.contacts) {
    report.imported.contacts = 0;
    report.updated.contacts = 0;
    report.skipped.contacts = 0;
    for (const contact of payload.contacts) {
      const existing = await ContactModel.findOne({ userId, email: contact.email.toLowerCase() });
      if (!existing) {
        await ContactModel.create({ userId, ...contact });
        report.imported.contacts++;
      } else if (conflictStrategy === 'overwrite') {
        existing.name = contact.name;
        if (contact.phone !== undefined) existing.phone = contact.phone;
        if (contact.notes !== undefined) existing.notes = contact.notes;
        await existing.save();
        report.updated.contacts++;
      } else {
        report.skipped.contacts++;
      }
    }
  }

  // 7. Listes d'expéditeurs
  if (sections.includes('senderLists') && payload.senderLists) {
    report.imported.senderLists = 0;
    report.updated.senderLists = 0;
    report.skipped.senderLists = 0;
    for (const sl of payload.senderLists) {
      const existing = await SenderListModel.findOne({ userId, type: sl.type, target: sl.target.toLowerCase() });
      if (!existing) {
        await SenderListModel.create({ userId, ...sl });
        report.imported.senderLists++;
      } else if (conflictStrategy === 'overwrite') {
        existing.note = sl.note;
        await existing.save();
        report.updated.senderLists++;
      } else {
        report.skipped.senderLists++;
      }
    }
  }

  // 8. Signatures de messagerie
  if (sections.includes('signatures') && payload.signatures) {
    report.imported.signatures = 0;
    report.updated.signatures = 0;
    report.skipped.signatures = 0;
    for (const sigItem of payload.signatures) {
      const account = await AccountModel.findOne({ userId, emailAddress: sigItem.accountEmail });
      if (!account) {
        report.skipped.signatures++;
        continue;
      }

      if (!sigItem.isAlias) {
        if (!account.signature || conflictStrategy === 'overwrite') {
          account.signature = sigItem.signature;
          await account.save();
          report.updated.signatures++;
        } else {
          report.skipped.signatures++;
        }
      } else if (sigItem.aliasEmail && account.aliases) {
        const alias = account.aliases.find((a) => a.email.toLowerCase() === sigItem.aliasEmail?.toLowerCase());
        if (alias) {
          if (!alias.signature || conflictStrategy === 'overwrite') {
            alias.signature = sigItem.signature;
            await account.save();
            report.updated.signatures++;
          } else {
            report.skipped.signatures++;
          }
        } else {
          report.skipped.signatures++;
        }
      }
    }
  }

  return report;
}
