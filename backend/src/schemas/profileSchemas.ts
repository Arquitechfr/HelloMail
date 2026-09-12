import { z } from 'zod';
import { ruleConditionSchema, ruleActionSchema } from './ruleSchemas.js';

export const encryptedProfileSchema = z.object({
  version: z.literal('1.0'),
  format: z.literal('mailora-encrypted-profile'),
  algorithm: z.literal('aes-256-gcm'),
  kdf: z.literal('pbkdf2-sha256'),
  iterations: z.number().int().positive().default(100_000),
  salt: z.string().regex(/^[0-9a-fA-F]{32}$/, 'Format de sel hexadécimal invalide'),
  iv: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Format de vecteur d initialisation IV invalide'),
  authTag: z.string().regex(/^[0-9a-fA-F]{32}$/, 'Format de balise d authentification invalide'),
  ciphertext: z.string().min(1, 'Texte chiffré manquant'),
});

export const profilePayloadSchema = z.object({
  metadata: z.object({
    version: z.literal('1.0'),
    generator: z.string(),
    exportedAt: z.string(),
    userEmail: z.string().email(),
  }),
  preferences: z.record(z.string(), z.unknown()).optional(),
  tags: z
    .array(
      z.object({
        name: z.string().min(1).max(50),
        color: z.string(),
        order: z.number().optional(),
        isPreset: z.boolean().optional(),
      }),
    )
    .optional(),
  rules: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        order: z.number().optional(),
        isActive: z.boolean().optional(),
        conditionMatch: z.enum(['all', 'any']),
        conditions: z.array(ruleConditionSchema),
        actions: z.array(ruleActionSchema),
        stopProcessing: z.boolean().optional(),
        isPreset: z.boolean().optional(),
      }),
    )
    .optional(),
  templates: z
    .array(
      z.object({
        title: z.string().min(1).max(100),
        subject: z.string().optional(),
        bodyHtml: z.string(),
        bodyText: z.string(),
        shortcut: z.string().optional(),
        order: z.number().optional(),
        isPreset: z.boolean().optional(),
      }),
    )
    .optional(),
  smartFolders: z
    .array(
      z.object({
        name: z.string().min(1).max(60),
        icon: z.string().optional(),
        color: z.string().optional(),
        query: z.string().min(1).max(300),
        order: z.number().optional(),
      }),
    )
    .optional(),
  contacts: z
    .array(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .optional(),
  senderLists: z
    .array(
      z.object({
        type: z.enum(['allow', 'deny']),
        target: z.string().min(1),
        note: z.string().optional(),
      }),
    )
    .optional(),
  signatures: z
    .array(
      z.object({
        accountEmail: z.string().email(),
        isAlias: z.boolean(),
        aliasEmail: z.string().email().optional(),
        signature: z.object({
          enabled: z.boolean(),
          text: z.string(),
          html: z.string().optional(),
          variables: z.record(z.string(), z.string()).optional(),
        }),
      }),
    )
    .optional(),
  pgpPublicKeys: z
    .array(
      z.object({
        email: z.string().email(),
        name: z.string().optional(),
        armoredPublicKey: z.string().min(1),
        fingerprint: z.string().min(1),
        keyId: z.string().min(1),
        algorithm: z.string().min(1),
      }),
    )
    .optional(),
});

export const profileSectionKeySchema = z.enum([
  'preferences',
  'tags',
  'rules',
  'templates',
  'smartFolders',
  'contacts',
  'senderLists',
  'signatures',
  'pgpPublicKeys',
]);

export type ProfileSectionKey = z.infer<typeof profileSectionKeySchema>;

export const previewProfileSchema = z.object({
  backupData: z.union([profilePayloadSchema, encryptedProfileSchema]),
  password: z.string().optional(),
});

export const restoreProfileSchema = z.object({
  backupData: z.union([profilePayloadSchema, encryptedProfileSchema]),
  password: z.string().optional(),
  sections: z.array(profileSectionKeySchema).min(1, 'Sélectionnez au moins une section à restaurer'),
  conflictStrategy: z.enum(['skip', 'overwrite']).default('skip'),
});

export type PreviewProfileInput = z.infer<typeof previewProfileSchema>;
export type RestoreProfileInput = z.infer<typeof restoreProfileSchema>;
