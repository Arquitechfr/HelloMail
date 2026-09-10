import { z } from 'zod';

const hexColorRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const createTagSchema = z.object({
  name: z
    .string({ error: 'Le nom du libellé est requis' })
    .trim()
    .min(1, 'Le nom ne peut pas être vide')
    .max(50, 'Le nom ne peut pas dépasser 50 caractères'),
  color: z
    .string()
    .regex(hexColorRegex, 'Code couleur hexadécimal invalide (ex: #3b82f6)')
    .default('#3b82f6'),
  order: z.number().int().optional(),
});

export const updateTagSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Le nom ne peut pas être vide')
    .max(50, 'Le nom ne peut pas dépasser 50 caractères')
    .optional(),
  color: z
    .string()
    .regex(hexColorRegex, 'Code couleur hexadécimal invalide (ex: #3b82f6)')
    .optional(),
  order: z.number().int().optional(),
});

export const setMessageTagsSchema = z.object({
  tags: z.array(z.string().trim()).max(20, 'Maximum 20 libellés par message'),
});

export const batchSetMessageTagsSchema = z.object({
  uids: z.array(z.number().int().positive()).min(1, 'Au moins un UID requis'),
  folder: z.string().min(1, 'Dossier requis'),
  tags: z.array(z.string().trim()),
  mode: z.enum(['add', 'remove', 'set']).default('set'),
});

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
export type SetMessageTagsInput = z.infer<typeof setMessageTagsSchema>;
export type BatchSetMessageTagsInput = z.infer<typeof batchSetMessageTagsSchema>;
