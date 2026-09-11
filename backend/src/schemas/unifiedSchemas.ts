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
