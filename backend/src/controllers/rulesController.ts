import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import {
  listUserRules,
  createUserRule,
  updateUserRule,
  deleteUserRule,
  reorderUserRules,
} from '../services/email/ruleService.js';
import type { CreateRuleInput, UpdateRuleInput, ReorderRulesInput } from '../schemas/ruleSchemas.js';

export async function list(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user.id;
  const accountId = req.query.accountId as string | undefined;
  const rules = await listUserRules(userId, accountId);
  res.json({ data: rules });
}

export async function create(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user.id;
  const input = req.body as CreateRuleInput;
  const rule = await createUserRule(userId, input);
  res.status(201).json({ data: rule });
}

export async function update(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user.id;
  const { id } = req.params as { id: string };
  const input = req.body as UpdateRuleInput;
  const rule = await updateUserRule(userId, id, input);
  res.json({ data: rule });
}

export async function remove(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user.id;
  const { id } = req.params as { id: string };
  await deleteUserRule(userId, id);
  res.json({ message: 'Règle supprimée avec succès' });
}

export async function reorder(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user.id;
  const { ruleIds } = req.body as ReorderRulesInput;
  await reorderUserRules(userId, ruleIds);
  res.json({ message: 'Ordre des règles mis à jour' });
}
