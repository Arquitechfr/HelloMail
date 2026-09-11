import { z } from 'zod';
import { emailSchema } from './commonSchemas.js';

const accountIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Identifiant de compte invalide');
const uidSchema = z.coerce.number().int().positive('UID doit être un entier positif');

/**
 * Params pour les routes drafts (accountId uniquement).
 */
export const draftAccountParamSchema = z.object({
  accountId: accountIdSchema,
});

export const draftAttachmentSchema = z.object({
  filename: z.string().min(1, 'Nom de fichier requis').max(255),
  content: z.string(),
  contentType: z.string().optional(),
  size: z.number().optional(),
});

/**
 * Schéma pour la création d'un brouillon.
 * Similaire à sendEmailSchema mais sans envoi SMTP.
 */
export const createDraftSchema = z.object({
  to: z.array(emailSchema).max(50).optional(),
  cc: z.array(emailSchema).max(50).optional(),
  bcc: z.array(emailSchema).max(50).optional(),
  replyTo: emailSchema.optional(),
  subject: z.string().trim().max(998, 'Le sujet ne peut pas dépasser 998 caractères (RFC 5322)').default(''),
  text: z.string().default(''),
  html: z.string().optional(),
  attachments: z.array(draftAttachmentSchema).max(20, 'Maximum 20 pièces jointes').optional(),
  inReplyTo: z.string().optional(),
  references: z.array(z.string()).optional(),
});

/**
 * Params pour la modification d'un brouillon : accountId + uid.
 */
export const updateDraftSchema = z.object({
  accountId: accountIdSchema,
  uid: uidSchema,
});

/**
 * Params pour la suppression d'un brouillon : accountId + uid.
 */
export const draftDeleteParamsSchema = z.object({
  accountId: accountIdSchema,
  uid: uidSchema,
});
