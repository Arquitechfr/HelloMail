import { z } from 'zod';

export const createReminderSchema = z.object({
  remindAt: z.string().refine(
    (val) => {
      const d = new Date(val);
      return !isNaN(d.getTime()) && d.getTime() > Date.now();
    },
    { message: "L'échéance du rappel doit être une date valide située dans le futur" },
  ),
  note: z
    .string()
    .trim()
    .max(500, 'La note ne peut pas dépasser 500 caractères')
    .optional(),
});

export const snoozeReminderSchema = z.object({
  remindAt: z.string().refine(
    (val) => {
      const d = new Date(val);
      return !isNaN(d.getTime()) && d.getTime() > Date.now();
    },
    { message: "La nouvelle échéance du rappel doit être une date valide située dans le futur" },
  ),
});

export const listRemindersQuerySchema = z.object({
  status: z
    .enum(['pending', 'triggered', 'replied', 'dismissed', 'cancelled'])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const reminderIdParamsSchema = z.object({
  accountId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID de compte invalide'),
  reminderId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID de rappel invalide'),
});

export const messageReminderParamsSchema = z.object({
  accountId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID de compte invalide'),
  folder: z.string().min(1, 'Dossier requis'),
  uid: z.coerce.number().int().positive('UID invalide'),
});
