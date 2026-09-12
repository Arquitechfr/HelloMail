import { Router } from 'express';
import * as reminderController from '../controllers/reminderController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createReminderSchema,
  snoozeReminderSchema,
  listRemindersQuerySchema,
  reminderIdParamsSchema,
  messageReminderParamsSchema,
} from '../schemas/reminderSchemas.js';

export const reminderRoutes = Router();

// Liste des rappels de l'utilisateur pour un compte
reminderRoutes.get(
  '/:accountId/reminders',
  requireAuth,
  validate({ query: listRemindersQuerySchema }),
  reminderController.list,
);

// Récupère le rappel associé à un message spécifique
reminderRoutes.get(
  '/:accountId/messages/:folder/:uid/reminder',
  requireAuth,
  validate({ params: messageReminderParamsSchema }),
  reminderController.getForMessage,
);

// Crée ou réarme un rappel sur un message
reminderRoutes.post(
  '/:accountId/messages/:folder/:uid/reminder',
  requireAuth,
  validate({ params: messageReminderParamsSchema, body: createReminderSchema }),
  reminderController.create,
);

// Repousse l'échéance d'un rappel (Snooze)
reminderRoutes.post(
  '/:accountId/reminders/:reminderId/snooze',
  requireAuth,
  validate({ params: reminderIdParamsSchema, body: snoozeReminderSchema }),
  reminderController.snooze,
);

// Acquitte un rappel échu
reminderRoutes.post(
  '/:accountId/reminders/:reminderId/dismiss',
  requireAuth,
  validate({ params: reminderIdParamsSchema }),
  reminderController.dismiss,
);

// Annule un rappel
reminderRoutes.delete(
  '/:accountId/reminders/:reminderId',
  requireAuth,
  validate({ params: reminderIdParamsSchema }),
  reminderController.cancel,
);
