import { Types } from 'mongoose';
import { UserModel } from '../../models/User.js';
import { TagModel } from '../../models/Tag.js';
import { RuleModel } from '../../models/Rule.js';
import { TemplateModel } from '../../models/Template.js';
import { logger } from '../../config/logger.js';
import { PRESET_TAGS, PRESET_RULES, PRESET_TEMPLATES } from './presetData.js';

/**
 * Seme le contenu prédéfini (tags, règles, modèles) pour un utilisateur.
 * Idempotent : n'exécute qu'une seule fois grâce au flag `defaultsSeededAt`,
 * et déduplique par nom/titre pour ne jamais écraser le contenu utilisateur.
 * Ne lève jamais d'erreur — un échec de seed ne doit pas bloquer l'authentification.
 */
export async function seedUserDefaults(userId: string | Types.ObjectId): Promise<void> {
  try {
    const userOid = new Types.ObjectId(userId);
    const user = await UserModel.findById(userOid).select('defaultsSeededAt');
    if (!user || user.defaultsSeededAt) {
      return;
    }

    await seedTags(userOid);
    await seedRules(userOid);
    await seedTemplates(userOid);

    await UserModel.updateOne({ _id: userOid }, { $set: { defaultsSeededAt: new Date() } });
    logger.info({ userId: userOid.toString() }, 'Contenu prédéfini semé pour l\'utilisateur');
  } catch (err) {
    logger.error(
      { userId: userId.toString(), error: err instanceof Error ? err.message : 'inconnu' },
      'Échec du seed du contenu prédéfini',
    );
  }
}

async function seedTags(userOid: Types.ObjectId): Promise<void> {
  const existing = await TagModel.find({ userId: userOid }).select('name order').lean();
  const existingNames = new Set(existing.map((t) => t.name.toLowerCase()));
  const maxOrder = existing.reduce((max, t) => Math.max(max, t.order), -1);

  const toCreate = PRESET_TAGS.filter((t) => !existingNames.has(t.name.toLowerCase())).map(
    (t, i) => ({
      userId: userOid,
      name: t.name,
      color: t.color,
      order: maxOrder + 1 + i,
      isPreset: true,
    }),
  );

  if (toCreate.length > 0) {
    await TagModel.insertMany(toCreate);
  }
}

async function seedRules(userOid: Types.ObjectId): Promise<void> {
  const existing = await RuleModel.find({ userId: userOid }).select('name order').lean();
  const existingNames = new Set(existing.map((r) => r.name.toLowerCase()));
  const maxOrder = existing.reduce((max, r) => Math.max(max, r.order), -1);

  const toCreate = PRESET_RULES.filter((r) => !existingNames.has(r.name.toLowerCase())).map(
    (r, i) => ({
      userId: userOid,
      name: r.name,
      order: maxOrder + 1 + i,
      isActive: true,
      conditionMatch: r.conditionMatch,
      conditions: r.conditions,
      actions: r.actions,
      stopProcessing: r.stopProcessing,
      isPreset: true,
    }),
  );

  if (toCreate.length > 0) {
    await RuleModel.insertMany(toCreate);
  }
}

async function seedTemplates(userOid: Types.ObjectId): Promise<void> {
  const existing = await TemplateModel.find({ userId: userOid }).select('title shortcut order').lean();
  const existingTitles = new Set(existing.map((t) => t.title.toLowerCase()));
  const existingShortcuts = new Set(
    existing.map((t) => t.shortcut?.toLowerCase()).filter((s): s is string => Boolean(s)),
  );
  const maxOrder = existing.reduce((max, t) => Math.max(max, t.order), -1);

  const toCreate = PRESET_TEMPLATES.filter(
    (t) =>
      !existingTitles.has(t.title.toLowerCase()) &&
      !existingShortcuts.has(t.shortcut.toLowerCase()),
  ).map((t, i) => ({
    userId: userOid,
    accountId: null,
    title: t.title,
    subject: t.subject,
    bodyHtml: t.bodyHtml,
    bodyText: htmlToPlainText(t.bodyHtml),
    shortcut: t.shortcut,
    order: maxOrder + 1 + i,
    isPreset: true,
  }));

  if (toCreate.length > 0) {
    await TemplateModel.insertMany(toCreate);
  }
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .trim();
}
