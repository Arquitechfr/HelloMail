import type { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { SenderListService } from '../services/security/senderListService.js';
import {
  createSenderListSchema,
  querySenderListSchema,
} from '../schemas/senderListSchemas.js';

/**
 * Liste les expéditeurs autorisés ou bloqués de l'utilisateur.
 */
export const list = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const query = querySenderListSchema.parse(req.query);
  const entries = await SenderListService.listSenderEntries(req.user.id, query);
  res.status(200).json({ success: true, data: entries });
});

/**
 * Ajoute un expéditeur ou un domaine à l'allowlist ou denylist.
 */
export const create = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const input = createSenderListSchema.parse(req.body);
  const entry = await SenderListService.createSenderEntry(req.user.id, input);
  res.status(201).json({
    success: true,
    data: entry,
    message:
      input.type === 'allow'
        ? 'Expéditeur ajouté à votre liste blanche'
        : 'Expéditeur ajouté à votre liste noire',
  });
});

/**
 * Supprime une entrée de la liste.
 */
export const remove = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  await SenderListService.deleteSenderEntry(req.user.id, id);
  res.status(200).json({ success: true, message: 'Entrée supprimée avec succès' });
});

/**
 * Vérifie le statut d'un expéditeur donné.
 */
export const check = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const email = req.query.email as string | undefined;
  const status = await SenderListService.checkSenderStatus(req.user.id, email);
  res.status(200).json({ success: true, status });
});
