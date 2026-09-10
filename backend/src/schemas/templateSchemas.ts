import { z } from 'zod';

const mongoIdRegex = /^[0-9a-fA-F]{24}$/;

export const templateParamsSchema = z.object({
  id: z.string().regex(mongoIdRegex, 'Identifiant de modèle invalide'),
});

export const templateQuerySchema = z.object({
  accountId: z.string().regex(mongoIdRegex, 'Identifiant de compte invalide').optional(),
});

export const createTemplateSchema = z.object({
  title: z
    .string({ error: 'Le titre du modèle est requis' })
    .trim()
    .min(1, 'Le titre ne peut pas être vide')
    .max(100, 'Le titre ne peut pas dépasser 100 caractères'),
  subject: z
    .string()
    .trim()
    .max(998, 'Le sujet ne peut pas dépasser 998 caractères')
    .optional()
    .default(''),
  bodyHtml: z
    .string({ error: 'Le corps HTML est requis' })
    .min(1, 'Le corps HTML ne peut pas être vide'),
  bodyText: z
    .string()
    .optional(),
  shortcut: z
    .string()
    .trim()
    .max(30, 'Le raccourci ne peut pas dépasser 30 caractères')
    .optional(),
  accountId: z
    .string()
    .regex(mongoIdRegex, 'Identifiant de compte invalide')
    .nullable()
    .optional(),
  order: z.number().int().optional().default(0),
});

export const updateTemplateSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Le titre ne peut pas être vide')
    .max(100, 'Le titre ne peut pas dépasser 100 caractères')
    .optional(),
  subject: z
    .string()
    .trim()
    .max(998, 'Le sujet ne peut pas dépasser 998 caractères')
    .optional(),
  bodyHtml: z
    .string()
    .min(1, 'Le corps HTML ne peut pas être vide')
    .optional(),
  bodyText: z
    .string()
    .optional(),
  shortcut: z
    .string()
    .trim()
    .max(30, 'Le raccourci ne peut pas dépasser 30 caractères')
    .nullable()
    .optional(),
  accountId: z
    .string()
    .regex(mongoIdRegex, 'Identifiant de compte invalide')
    .nullable()
    .optional(),
  order: z.number().int().optional(),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
