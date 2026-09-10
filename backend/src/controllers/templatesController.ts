import { Request, Response } from 'express';
import * as templateService from '../services/templates/templateService.js';

export async function list(req: Request, res: Response): Promise<void> {
  const accountId = req.query.accountId ? String(req.query.accountId) : undefined;
  const templates = await templateService.listUserTemplates(req.user!.id, accountId);
  res.status(200).json({ data: templates });
}

export async function getOne(req: Request, res: Response): Promise<void> {
  const template = await templateService.getUserTemplate(req.user!.id, String(req.params.id));
  res.status(200).json({ data: template });
}

export async function create(req: Request, res: Response): Promise<void> {
  const template = await templateService.createUserTemplate(req.user!.id, req.body);
  res.status(201).json({ data: template });
}

export async function update(req: Request, res: Response): Promise<void> {
  const template = await templateService.updateUserTemplate(
    req.user!.id,
    String(req.params.id),
    req.body,
  );
  res.status(200).json({ data: template });
}

export async function remove(req: Request, res: Response): Promise<void> {
  await templateService.deleteUserTemplate(req.user!.id, String(req.params.id));
  res.status(200).json({ message: 'Modèle supprimé avec succès' });
}
