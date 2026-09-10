import { Request, Response } from 'express';
import * as tagService from '../services/email/tagService.js';

export async function list(req: Request, res: Response): Promise<void> {
  const tags = await tagService.listUserTags(req.user!.id);
  res.status(200).json({ data: tags });
}

export async function create(req: Request, res: Response): Promise<void> {
  const tag = await tagService.createUserTag(req.user!.id, req.body);
  res.status(201).json({ data: tag });
}

export async function update(req: Request, res: Response): Promise<void> {
  const tag = await tagService.updateUserTag(req.user!.id, String(req.params.id), req.body);
  res.status(200).json({ data: tag });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await tagService.deleteUserTag(req.user!.id, String(req.params.id));
  res.status(200).json({ message: 'Libellé supprimé avec succès' });
}

export async function setMessageTags(req: Request, res: Response): Promise<void> {
  const { accountId, folder, uid } = req.params;
  const message = await tagService.setMessageTags(
    req.user!.id,
    String(accountId),
    String(folder),
    Number(uid),
    req.body.tags,
  );
  res.status(200).json({ data: message });
}

export async function batchSetMessageTags(req: Request, res: Response): Promise<void> {
  const { accountId } = req.params;
  const result = await tagService.batchSetMessageTags(
    req.user!.id,
    String(accountId),
    req.body,
  );
  res.status(200).json(result);
}
