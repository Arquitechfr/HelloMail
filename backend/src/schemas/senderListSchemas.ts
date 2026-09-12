import { z } from 'zod';

// Une cible peut être un email (ex: "bob@domain.com") ou un domaine (ex: "@domain.com" ou "domain.com")
const targetRegex = /^([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|@?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/;

export const createSenderListSchema = z.object({
  type: z.enum(['allow', 'deny'], {
    message: 'Le type doit être "allow" (liste blanche) ou "deny" (liste noire)',
  }),
  target: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'La cible doit comporter au moins 3 caractères')
    .max(255, 'La cible ne doit pas dépasser 255 caractères')
    .regex(
      targetRegex,
      'Doit être une adresse email ou un nom de domaine valide (ex: contact@banque.fr ou @banque.fr)',
    ),
  note: z.string().trim().max(200, 'La note ne doit pas dépasser 200 caractères').optional(),
});

export const updateSenderListSchema = z.object({
  note: z.string().trim().max(200, 'La note ne doit pas dépasser 200 caractères').optional(),
  type: z.enum(['allow', 'deny']).optional(),
});

export const querySenderListSchema = z.object({
  type: z.enum(['allow', 'deny']).optional(),
  search: z.string().trim().optional(),
});

export type CreateSenderListInput = z.infer<typeof createSenderListSchema>;
export type UpdateSenderListInput = z.infer<typeof updateSenderListSchema>;
export type QuerySenderListInput = z.infer<typeof querySenderListSchema>;
