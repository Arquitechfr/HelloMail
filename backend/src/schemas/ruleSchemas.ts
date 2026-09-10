import { z } from 'zod';

export const ruleConditionSchema = z.object({
  field: z.enum(['from', 'to', 'subject', 'hasAttachments'], {
    error: 'Champ de condition invalide',
  }),
  operator: z.enum(['contains', 'notContains', 'equals', 'startsWith', 'endsWith'], {
    error: 'Opérateur de condition invalide',
  }),
  value: z.string().default(''),
});

export const ruleActionSchema = z
  .object({
    type: z.enum(['moveToFolder', 'markAsRead', 'markAsFlagged', 'markAsJunk', 'delete'], {
      error: 'Type d\'action invalide',
    }),
    folderName: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.type === 'moveToFolder' && (!data.folderName || data.folderName.trim() === '')) {
        return false;
      }
      return true;
    },
    {
      message: 'Le nom du dossier de destination est requis pour l\'action moveToFolder',
      path: ['folderName'],
    },
  );

export const createRuleSchema = z.object({
  name: z.string().min(1, 'Le nom de la règle est requis').max(100, 'Le nom ne doit pas dépasser 100 caractères'),
  accountId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'ID de compte invalide')
    .optional(),
  isActive: z.boolean().default(true),
  conditionMatch: z.enum(['all', 'any']).default('all'),
  conditions: z.array(ruleConditionSchema).min(1, 'Au moins une condition est requise'),
  actions: z.array(ruleActionSchema).min(1, 'Au moins une action est requise'),
  stopProcessing: z.boolean().default(false),
});

export const updateRuleSchema = createRuleSchema.partial();

export const reorderRulesSchema = z.object({
  ruleIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID de règle invalide')).min(1, 'Au moins un ID de règle est requis'),
});

export type CreateRuleInput = z.infer<typeof createRuleSchema>;
export type UpdateRuleInput = z.infer<typeof updateRuleSchema>;
export type ReorderRulesInput = z.infer<typeof reorderRulesSchema>;
