import { z } from 'zod';
import { emailSchema } from './commonSchemas.js';

export const saveUserKeySchema = z.object({
  email: emailSchema,
  name: z.string().trim().max(120).optional(),
  armoredPublicKey: z
    .string()
    .min(50, 'Clé publique PGP invalide')
    .refine((v) => v.includes('-----BEGIN PGP PUBLIC KEY BLOCK-----'), {
      message: 'Le format de clé publique PGP doit être un bloc ASCII-armor valide',
    }),
  armoredPrivateKey: z
    .string()
    .min(50, 'Clé privée PGP invalide')
    .refine((v) => v.includes('-----BEGIN PGP PRIVATE KEY BLOCK-----'), {
      message: 'Le format de clé privée PGP doit être un bloc ASCII-armor valide',
    })
    .optional(),
  fingerprint: z.string().trim().min(8, 'Empreinte invalide'),
  keyId: z.string().trim().min(8, 'Identifiant de clé invalide'),
  algorithm: z.string().trim().max(50).default('Curve25519'),
});

export const saveContactKeySchema = z.object({
  email: emailSchema,
  name: z.string().trim().max(120).optional(),
  armoredPublicKey: z
    .string()
    .min(50, 'Clé publique PGP invalide')
    .refine((v) => v.includes('-----BEGIN PGP PUBLIC KEY BLOCK-----'), {
      message: 'Le format de clé publique PGP doit être un bloc ASCII-armor valide',
    }),
  fingerprint: z.string().trim().min(8, 'Empreinte invalide'),
  keyId: z.string().trim().min(8, 'Identifiant de clé invalide'),
  algorithm: z.string().trim().max(50).default('Curve25519'),
});

export const pgpKeyParamsSchema = z.object({
  keyId: z.string().trim().min(1, 'Identifiant de clé requis'),
});

export const pgpEmailParamsSchema = z.object({
  email: emailSchema,
});

export type SaveUserKeyInput = z.infer<typeof saveUserKeySchema>;
export type SaveContactKeyInput = z.infer<typeof saveContactKeySchema>;
