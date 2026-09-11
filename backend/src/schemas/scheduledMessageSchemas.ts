import { z } from 'zod';
import { emailSchema } from './commonSchemas.js';

const accountIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Identifiant de compte invalide');
const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Identifiant invalide');

export const scheduledAttachmentSchema = z.object({
  filename: z.string().min(1, 'Nom de fichier requis').max(255),
  content: z.string(), // base64
  contentType: z.string().optional(),
  size: z.number().optional(),
});

export const scheduleEmailSchema = z.object({
  from: z
    .object({
      name: z.string().trim().max(120, "Le nom d'expéditeur ne peut pas dépasser 120 caractères").optional(),
      address: emailSchema,
    })
    .optional(),
  to: z.array(emailSchema).min(1, 'Au moins un destinataire requis').max(50),
  cc: z.array(emailSchema).max(50).optional(),
  bcc: z.array(emailSchema).max(50).optional(),
  replyTo: emailSchema.optional(),
  subject: z.string().trim().max(998, 'Le sujet ne peut pas dépasser 998 caractères (RFC 5322)'),
  text: z.string().min(1, 'Le corps texte est requis'),
  html: z.string().optional(),
  attachments: z.array(scheduledAttachmentSchema).max(20, 'Maximum 20 pièces jointes').optional(),
  inReplyTo: z.string().optional(),
  references: z.array(z.string()).optional(),
  requestReadReceipt: z.boolean().optional(),
  scheduledAt: z.coerce.date().refine((d) => d.getTime() > Date.now() + 15000, {
    message: "L'heure programmée doit être située dans le futur (au moins 15 secondes après l'heure actuelle)",
  }),
});

export const scheduledAccountParamsSchema = z.object({
  accountId: accountIdSchema,
});

export const scheduledIdParamsSchema = z.object({
  accountId: accountIdSchema,
  id: objectIdSchema,
});

export type ScheduleEmailInput = z.infer<typeof scheduleEmailSchema>;
