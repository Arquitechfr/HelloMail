import { z } from 'zod';
import { emailSchema } from './commonSchemas.js';

const accountIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Identifiant de compte invalide');
const folderSchema = z.string().min(1, 'Dossier requis').max(255, 'Dossier trop long');
const uidSchema = z.coerce.number().int().positive('UID doit être un entier positif');
const partSchema = z.string().regex(/^[0-9]+(\.[0-9]+)*$/, 'Identifiant de partie invalide');

/**
 * Schéma de validation des params de la route messages (liste).
 * `accountId` doit être un ObjectId valide (24 hex) — évite le CastError Mongoose
 * sur une entrée mal formée (qui donnerait un 500 non catché par errorHandler).
 */
export const listMessagesParamsSchema = z.object({
  accountId: accountIdSchema,
});

/**
 * Schéma de validation des query params de la route messages (liste).
 */
export const listMessagesQuerySchema = z.object({
  folder: folderSchema.optional(),
  tag: z.string().trim().min(1).max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Params pour la lecture d'un message : accountId + folder + uid.
 */
export const getOneParamsSchema = z.object({
  accountId: accountIdSchema,
  folder: folderSchema,
  uid: uidSchema,
});

/**
 * Params pour le téléchargement d'une pièce jointe : accountId + folder + uid + part.
 */
export const attachmentParamsSchema = z.object({
  accountId: accountIdSchema,
  folder: folderSchema,
  uid: uidSchema,
  part: partSchema,
});

/**
 * Schéma pour l'envoi d'un email.
 * Limite la taille totale à 25 Mo (base64 inclus, avec overhead ~37%).
 */
export const sendEmailSchema = z.object({
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
  attachments: z
    .array(
      z.object({
        filename: z.string().min(1, 'Nom de fichier requis').max(255),
        content: z.string(),
        contentType: z.string().optional(),
      }),
    )
    .max(20, 'Maximum 20 pièces jointes')
    .optional(),
  inReplyTo: z.string().optional(),
  references: z.array(z.string()).optional(),
  requestReadReceipt: z.boolean().optional(),
});

/**
 * Schéma pour la mise à jour des flags d'un message.
 */
export const flagsUpdateSchema = z
  .object({
    seen: z.boolean().optional(),
    flagged: z.boolean().optional(),
    answered: z.boolean().optional(),
  })
  .refine(
    (data) => data.seen !== undefined || data.flagged !== undefined || data.answered !== undefined,
    { message: 'Au moins un flag doit être spécifié' },
  );

/**
 * Schéma pour le déplacement d'un message.
 */
export const moveMessageSchema = z.object({
  destination: z.string().min(1, 'Dossier de destination requis').max(255),
});

/**
 * Schéma pour la suppression d'un message (query param).
 */
export const deleteMessageQuerySchema = z.object({
  permanent: z.coerce.boolean().default(false),
});

/**
 * Schéma pour une action en masse sur des messages.
 */
export const batchActionSchema = z
  .object({
    uids: z.array(z.coerce.number().int().positive()).min(1, 'Au moins un UID requis').max(100, 'Maximum 100 UIDs'),
    action: z.enum(['delete', 'move', 'markRead', 'markUnread', 'flag', 'unflag', 'markAsJunk', 'pin', 'unpin']),
    destination: z.string().min(1).max(255).optional(),
    folder: z.string().min(1).max(255).optional(),
  })
  .refine((data) => data.action !== 'move' || data.destination !== undefined, {
    message: 'destination est requis pour l\'action move',
    path: ['destination'],
  });

export const pinMessageSchema = z.object({
  isPinned: z.boolean(),
});

/**
 * Params pour les routes avec folder + uid (flags, delete, move).
 */
export const messageActionParamsSchema = z.object({
  accountId: accountIdSchema,
  folder: folderSchema,
  uid: uidSchema,
});

/**
 * Params pour la route de recherche (accountId uniquement).
 */
export const searchParamsSchema = z.object({
  accountId: accountIdSchema,
});

/**
 * Schéma de validation des query params pour la recherche de messages.
 *
 * `q` : recherche plein texte (utilise l'index textuel MongoDB).
 * Les opérateurs (`from:alice`, `to:bob`, `subject:test`, `is:unread`,
 * `is:flagged`, `has:attachment`, `before:2026-01-01`, `since:2026-01-01`)
 * sont parsés côté service par `parseSearchQuery`.
 *
 * Les filtres explicites (`from`, `to`, `subject`, `seen`, `flagged`,
 * `hasAttachments`, `since`, `before`) peuvent aussi être passés directement
 * en query params pour une recherche structurée sans opérateurs.
 */
export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  folder: z.string().max(255).optional(),
  from: z.string().trim().max(255).optional(),
  to: z.string().trim().max(255).optional(),
  subject: z.string().trim().max(998).optional(),
  seen: z.coerce.boolean().optional(),
  flagged: z.coerce.boolean().optional(),
  hasAttachments: z.coerce.boolean().optional(),
  since: z.coerce.date().optional(),
  before: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Schéma pour la pagination arrière (fetch-more).
 * `folder` : dossier à étendre. `count` : nombre de messages à fetch (default 50, max 100).
 */
export const fetchMoreSchema = z.object({
  folder: z.string().min(1, 'Dossier requis').max(255, 'Dossier trop long').default('INBOX'),
  count: z.coerce.number().int().min(1).max(100).default(50),
});

/**
 * Schéma pour la mise en sommeil d'un email ("Snooze").
 * `snoozedUntil` : date ISO 8601 future ou null pour réveiller immédiatement ("unsnooze").
 */
export const snoozeMessageSchema = z.object({
  snoozedUntil: z.string().datetime({ message: 'Format de date ISO 8601 invalide' }).nullable(),
});

export type SnoozeMessageInput = z.infer<typeof snoozeMessageSchema>;

