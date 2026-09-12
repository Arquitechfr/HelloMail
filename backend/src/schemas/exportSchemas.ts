import { z } from 'zod';
import mongoose from 'mongoose';

export const exportAccountParamsSchema = z.object({
  accountId: z
    .string()
    .refine((val) => mongoose.Types.ObjectId.isValid(val), {
      message: 'Identifiant de compte invalide',
    }),
});

export const exportMboxQuerySchema = z.object({
  folder: z
    .string()
    .min(1, 'Le nom du dossier est requis')
    .max(255, 'Le nom du dossier est trop long')
    .refine((val) => !val.includes('..'), {
      message: 'Chemin de dossier non autorisé',
    }),
  exportId: z.string().optional(),
});

export const exportZipQuerySchema = z.object({
  folders: z
    .string()
    .optional()
    .refine((val) => !val || !val.includes('..'), {
      message: 'Chemins de dossiers non autorisés',
    }),
  exportId: z.string().optional(),
});

export type ExportAccountParams = z.infer<typeof exportAccountParamsSchema>;
export type ExportMboxQuery = z.infer<typeof exportMboxQuerySchema>;
export type ExportZipQuery = z.infer<typeof exportZipQuerySchema>;
