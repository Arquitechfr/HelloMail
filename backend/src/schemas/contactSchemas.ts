import { z } from 'zod';
import { emailSchema } from './commonSchemas.js';

export const createContactSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(100, 'Nom trop long'),
  email: emailSchema,
  phone: z.string().max(30, 'Téléphone trop long').optional(),
  notes: z.string().max(500, 'Notes trop longues').optional(),
});

export const updateContactSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(100, 'Nom trop long').optional(),
  email: emailSchema.optional(),
  phone: z.string().max(30, 'Téléphone trop long').optional(),
  notes: z.string().max(500, 'Notes trop longues').optional(),
});

export const searchContactsSchema = z.object({
  q: z.string().min(1, 'Requête de recherche requise').max(100),
});
