import { Router } from 'express';
import * as messagesController from '../controllers/messagesController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { sendRateLimit } from '../middleware/rateLimit.js';
import {
  listMessagesParamsSchema,
  listMessagesQuerySchema,
  getOneParamsSchema,
  attachmentParamsSchema,
  sendEmailSchema,
  flagsUpdateSchema,
  moveMessageSchema,
  deleteMessageQuerySchema,
  batchActionSchema,
  messageActionParamsSchema,
  searchParamsSchema,
  searchQuerySchema,
  fetchMoreSchema,
} from '../schemas/messageSchemas.js';

const router = Router();

// Routes ordonnées du plus spécifique au moins spécifique pour éviter les conflits.

// Envoi d'un email via le SMTP du compte.
router.post(
  '/:accountId/send',
  requireAuth,
  sendRateLimit,
  validate({ body: sendEmailSchema }),
  messagesController.send,
);

// Action en masse sur des messages (avant /:folder/:uid pour éviter conflit).
router.post(
  '/:accountId/messages/batch',
  requireAuth,
  validate({ body: batchActionSchema }),
  messagesController.batch,
);

// Pagination arrière : fetch les messages plus anciens depuis IMAP.
router.post(
  '/:accountId/messages/fetch-more',
  requireAuth,
  validate({ params: listMessagesParamsSchema, body: fetchMoreSchema }),
  messagesController.fetchMore,
);

// Mise à jour des flags d'un message.
router.patch(
  '/:accountId/messages/:folder/:uid/flags',
  requireAuth,
  validate({ params: messageActionParamsSchema, body: flagsUpdateSchema }),
  messagesController.updateFlags,
);

// Déplacement d'un message.
router.post(
  '/:accountId/messages/:folder/:uid/move',
  requireAuth,
  validate({ params: messageActionParamsSchema, body: moveMessageSchema }),
  messagesController.move,
);

// Marquage comme spam (déplacement vers Junk).
router.post(
  '/:accountId/messages/:folder/:uid/junk',
  requireAuth,
  validate({ params: messageActionParamsSchema }),
  messagesController.markAsJunk,
);

// Téléchargement d'une pièce jointe (stream).
router.get(
  '/:accountId/messages/:folder/:uid/attachments/:part',
  requireAuth,
  validate({ params: attachmentParamsSchema }),
  messagesController.getAttachment,
);

// Téléchargement du message brut RFC 822 (.eml)
router.get(
  '/:accountId/messages/:folder/:uid/raw',
  requireAuth,
  validate({ params: getOneParamsSchema }),
  messagesController.getRaw,
);

// Suppression d'un message.
router.delete(
  '/:accountId/messages/:folder/:uid',
  requireAuth,
  validate({ params: messageActionParamsSchema, query: deleteMessageQuerySchema }),
  messagesController.remove,
);

// Récupération du fil de conversation d'un message.
router.get(
  '/:accountId/messages/:folder/:uid/thread',
  requireAuth,
  validate({ params: getOneParamsSchema }),
  messagesController.getThread,
);

// Envoi d'un accusé de réception de lecture (MDN RFC 3798).
router.post(
  '/:accountId/messages/:folder/:uid/receipt',
  requireAuth,
  validate({ params: getOneParamsSchema }),
  messagesController.sendReceipt,
);

// Lecture d'un message complet (corps + headers + structure PJ).
router.get(
  '/:accountId/messages/:folder/:uid',
  requireAuth,
  validate({ params: getOneParamsSchema }),
  messagesController.getOne,
);

// Liste paginée des messages (le moins spécifique — en dernier).
router.get(
  '/:accountId/messages',
  requireAuth,
  validate({ params: listMessagesParamsSchema, query: listMessagesQuerySchema }),
  messagesController.list,
);

// Recherche de messages (avant /:accountId/messages pour éviter conflit).
router.get(
  '/:accountId/messages/search',
  requireAuth,
  validate({ params: searchParamsSchema, query: searchQuerySchema }),
  messagesController.search,
);

export const messagesRoutes = router;
