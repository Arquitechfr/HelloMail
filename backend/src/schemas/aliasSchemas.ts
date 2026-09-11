import { z } from 'zod';
import { emailSchema } from './commonSchemas.js';

export const createAliasSchema = z.object({
  name: z.string().trim().max(120, "Le nom d'affichage ne peut pas dépasser 120 caractères").optional(),
  email: emailSchema,
  isDefault: z.boolean().optional(),
});

export const updateAliasSchema = z.object({
  name: z.string().trim().max(120, "Le nom d'affichage ne peut pas dépasser 120 caractères").optional(),
  email: emailSchema.optional(),
  isDefault: z.boolean().optional(),
});

export const accountAliasParamsSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Identifiant de compte invalide'),
  aliasId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Identifiant d'alias invalide"),
});

export type CreateAliasInput = z.infer<typeof createAliasSchema>;
export type UpdateAliasInput = z.infer<typeof updateAliasSchema>;
