import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import {
  listSmartFolders,
  createSmartFolder,
  updateSmartFolder,
  deleteSmartFolder,
  reorderSmartFolders,
  resolveSmartFolderMessages,
  getSmartFolderCounts,
} from '../services/email/smartFolderService.js';
import {
  createSmartFolderSchema,
  updateSmartFolderSchema,
  reorderSmartFoldersSchema,
} from '../schemas/smartFolderSchemas.js';

export async function list(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user.id;
  const data = await listSmartFolders(userId);
  res.json({ data });
}

export async function create(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user.id;
  const input = createSmartFolderSchema.parse(req.body);
  const data = await createSmartFolder(userId, input);
  res.status(201).json({ data });
}

export async function update(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user.id;
  const { id } = req.params as { id: string };
  const input = updateSmartFolderSchema.parse(req.body);
  const data = await updateSmartFolder(userId, id, input);
  res.json({ data });
}

export async function remove(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user.id;
  const { id } = req.params as { id: string };
  await deleteSmartFolder(userId, id);
  res.json({ message: 'Dossier intelligent supprimé avec succès' });
}

export async function reorder(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user.id;
  const input = reorderSmartFoldersSchema.parse(req.body);
  await reorderSmartFolders(userId, input.ids);
  res.json({ message: 'Ordre des dossiers intelligents mis à jour' });
}

export async function getCounts(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user.id;
  const counts = await getSmartFolderCounts(userId);
  res.json({ data: counts });
}

export async function getMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user.id;
  const { id } = req.params as { id: string };
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

  const result = await resolveSmartFolderMessages(userId, id, { page, limit });
  res.json(result);
}
