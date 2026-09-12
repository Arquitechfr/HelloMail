import { z } from 'zod';

export const unifiedFolderTypeSchema = z.enum([
  'inbox',
  'starred',
  'pinned',
  'drafts',
  'sent',
  'snoozed',
  'archive',
  'junk',
  'trash',
]);

export const unifiedMessagesQuerySchema = z.object({
  type: unifiedFolderTypeSchema.default('inbox'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  tag: z.string().trim().min(1).optional(),
});

export const unifiedSearchQuerySchema = z.object({
  q: z.string().trim().max(255).optional(),
  folder: z.string().max(255).optional(),
  accountId: z.string().trim().optional(),
  from: z.string().trim().max(255).optional(),
  to: z.string().trim().max(255).optional(),
  subject: z.string().trim().max(998).optional(),
  seen: z.coerce.boolean().optional(),
  flagged: z.coerce.boolean().optional(),
  isPinned: z.coerce.boolean().optional(),
  tag: z.string().trim().optional(),
  hasAttachments: z.coerce.boolean().optional(),
  since: z.coerce.date().optional(),
  before: z.coerce.date().optional(),
  minSize: z.coerce.number().int().min(0).optional(),
  maxSize: z.coerce.number().int().min(0).optional(),
  includeTrash: z.coerce.boolean().default(false),
  includeJunk: z.coerce.boolean().default(false),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
