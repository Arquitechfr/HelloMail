import { z } from 'zod';

/**
 * Schéma de validation des params de la route messages.
 * `accountId` doit être un ObjectId valide (24 hex) — évite le CastError Mongoose
 * sur une entrée mal formée (qui donnerait un 500 non catché par errorHandler).
 */
export const listMessagesParamsSchema = z.object({
  accountId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Identifiant de compte invalide'),
});

/**
 * Schéma de validation des query params de la route messages.
 */
export const listMessagesQuerySchema = z.object({
  folder: z.string().default('INBOX'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
