import { z } from 'zod';
import { emailSchema, objectIdParamSchema } from './commonSchemas.js';

export const createImapAccountSchema = z.object({
  emailAddress: emailSchema,
  displayName: z.string().max(120, 'Le nom d\'affichage ne peut pas dépasser 120 caractères').optional(),
  imap: z.object({
    host: z.string().min(1, 'Hôte IMAP requis'),
    port: z.coerce.number().min(1).max(65535),
    secure: z.boolean().default(true),
    username: z.string().min(1, 'Nom d\'utilisateur IMAP requis'),
    password: z.string().min(1, 'Mot de passe IMAP requis'),
  }),
  smtp: z.object({
    host: z.string().min(1, 'Hôte SMTP requis'),
    port: z.coerce.number().min(1).max(65535),
    secure: z.boolean().default(true),
  }),
});

export const accountIdParamSchema = objectIdParamSchema;

export const toggleAccountActiveSchema = z.object({
  isActive: z.boolean(),
});

export const autoconfigQuerySchema = z.object({
  email: emailSchema,
});

export const updateSignatureSchema = z.object({
  enabled: z.boolean(),
  text: z.string().max(4000, 'La signature texte ne peut pas dépasser 4000 caractères'),
  html: z.string().max(10000, 'La signature HTML ne peut pas dépasser 10000 caractères').optional(),
});
