import { Types } from 'mongoose';
import { TemplateModel, type ITemplateDocument } from '../../models/Template.js';
import { AppError } from '../../utils/AppError.js';
import type { CreateTemplateInput, UpdateTemplateInput } from '../../schemas/templateSchemas.js';

/**
 * Extrait un fallback texte brut à partir d'un HTML simple (supprime balises).
 */
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

/**
 * Liste les modèles d'emails d'un utilisateur.
 * Si un accountId est fourni, retourne les modèles globaux (sans compte) et ceux liés à ce compte.
 */
export async function listUserTemplates(
  userId: string,
  accountId?: string,
): Promise<ITemplateDocument[]> {
  const userOid = new Types.ObjectId(userId);
  const filter: Record<string, unknown> = { userId: userOid };

  if (accountId) {
    const accountOid = new Types.ObjectId(accountId);
    filter.$or = [{ accountId: null }, { accountId: accountOid }];
  }

  return TemplateModel.find(filter).sort({ order: 1, title: 1 });
}

/**
 * Récupère un modèle par son ID en vérifiant son appartenance.
 */
export async function getUserTemplate(
  userId: string,
  templateId: string,
): Promise<ITemplateDocument> {
  const template = await TemplateModel.findOne({
    _id: new Types.ObjectId(templateId),
    userId: new Types.ObjectId(userId),
  });

  if (!template) {
    throw AppError.notFound('Modèle introuvable');
  }

  return template;
}

/**
 * Crée un nouveau modèle d'email ou réponse type.
 */
export async function createUserTemplate(
  userId: string,
  input: CreateTemplateInput,
): Promise<ITemplateDocument> {
  const userOid = new Types.ObjectId(userId);

  if (input.shortcut && input.shortcut.trim()) {
    const shortcutTrimmed = input.shortcut.trim();
    const existing = await TemplateModel.findOne({
      userId: userOid,
      shortcut: shortcutTrimmed,
    });
    if (existing) {
      throw AppError.conflict('Un modèle avec ce raccourci existe déjà');
    }
  }

  let order = input.order;
  if (order === undefined) {
    const last = await TemplateModel.findOne({ userId: userOid }).sort({ order: -1 });
    order = last ? last.order + 1 : 0;
  }

  const bodyText = input.bodyText?.trim() || htmlToPlainText(input.bodyHtml);

  return TemplateModel.create({
    userId: userOid,
    accountId: input.accountId ? new Types.ObjectId(input.accountId) : null,
    title: input.title.trim(),
    subject: input.subject?.trim() ?? '',
    bodyHtml: input.bodyHtml,
    bodyText,
    shortcut: input.shortcut?.trim() || undefined,
    order,
  });
}

/**
 * Met à jour un modèle existant.
 */
export async function updateUserTemplate(
  userId: string,
  templateId: string,
  input: UpdateTemplateInput,
): Promise<ITemplateDocument> {
  const userOid = new Types.ObjectId(userId);
  const template = await TemplateModel.findOne({
    _id: new Types.ObjectId(templateId),
    userId: userOid,
  });

  if (!template) {
    throw AppError.notFound('Modèle introuvable');
  }

  if (input.shortcut !== undefined && input.shortcut !== null && input.shortcut.trim() !== '') {
    const shortcutTrimmed = input.shortcut.trim();
    if (shortcutTrimmed !== template.shortcut) {
      const existing = await TemplateModel.findOne({
        userId: userOid,
        shortcut: shortcutTrimmed,
        _id: { $ne: template._id },
      });
      if (existing) {
        throw AppError.conflict('Un modèle avec ce raccourci existe déjà');
      }
    }
  }

  if (input.title !== undefined) template.title = input.title.trim();
  if (input.subject !== undefined) template.subject = input.subject.trim();
  if (input.bodyHtml !== undefined) {
    template.bodyHtml = input.bodyHtml;
    template.bodyText = input.bodyText?.trim() || htmlToPlainText(input.bodyHtml);
  } else if (input.bodyText !== undefined) {
    template.bodyText = input.bodyText.trim();
  }
  if (input.shortcut !== undefined) {
    template.shortcut = input.shortcut ? input.shortcut.trim() : undefined;
  }
  if (input.accountId !== undefined) {
    template.accountId = input.accountId ? new Types.ObjectId(input.accountId) : null;
  }
  if (input.order !== undefined) template.order = input.order;

  await template.save();
  return template;
}

/**
 * Supprime un modèle d'email.
 */
export async function deleteUserTemplate(
  userId: string,
  templateId: string,
): Promise<void> {
  const result = await TemplateModel.findOneAndDelete({
    _id: new Types.ObjectId(templateId),
    userId: new Types.ObjectId(userId),
  });

  if (!result) {
    throw AppError.notFound('Modèle introuvable');
  }
}
