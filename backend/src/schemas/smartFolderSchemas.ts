import { z } from 'zod';

const hexColorRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const createSmartFolderSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Le nom du dossier intelligent est requis')
    .max(60, 'Le nom ne doit pas dépasser 60 caractères'),
  icon: z.string().trim().max(40).optional().default('Sparkles'),
  color: z
    .string()
    .trim()
    .regex(hexColorRegex, 'Format de couleur hexadécimal invalide (#RGB ou #RRGGBB)')
    .optional()
    .default('#3b82f6'),
  query: z
    .string()
    .trim()
    .min(1, 'La requête de recherche est requise')
    .max(300, 'La requête ne doit pas dépasser 300 caractères'),
  accountId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Identifiant de compte invalide')
    .optional(),
  order: z.number().int().min(0).optional(),
});

export const updateSmartFolderSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  icon: z.string().trim().max(40).optional(),
  color: z.string().trim().regex(hexColorRegex).optional(),
  query: z.string().trim().min(1).max(300).optional(),
  accountId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .nullable()
    .optional(),
  order: z.number().int().min(0).optional(),
});

export const reorderSmartFoldersSchema = z.object({
  ids: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).min(1),
});

export type CreateSmartFolderInput = z.input<typeof createSmartFolderSchema>;
export type UpdateSmartFolderInput = z.infer<typeof updateSmartFolderSchema>;
export type ReorderSmartFoldersInput = z.infer<typeof reorderSmartFoldersSchema>;

