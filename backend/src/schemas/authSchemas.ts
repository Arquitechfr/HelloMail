import { z } from 'zod';
import { emailSchema, passwordSchema } from './commonSchemas.js';

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Mot de passe requis'),
});

// --- 2FA (Phase 6) ---

/** Schéma pour la vérification 2FA lors du login. */
export const verifyTwoFactorSchema = z.object({
  twoFactorTempToken: z.string().min(1, 'Jeton 2FA requis'),
  code: z.string().min(1, 'Code 2FA requis').max(50, 'Code trop long'),
});

/** Schéma pour l'activation TOTP (vérification du code). */
export const enableTOTPSchema = z.object({
  token: z.string().min(6, 'Code TOTP requis').max(8, 'Code TOTP invalide'),
});

/** Schéma pour la désactivation 2FA (mot de passe requis pour sécurité). */
export const disable2FASchema = z.object({
  password: z.string().min(1, 'Mot de passe requis'),
});

/** Schéma pour la vérification WebAuthn (réponse du navigateur). */
export const webauthnResponseSchema = z.object({
  response: z.record(z.string(), z.unknown()),
});

/** Schéma pour la mise à jour des préférences utilisateur (Phase 9). */
export const updatePreferencesSchema = z.object({
  undoSendDelay: z
    .number({ error: 'Le délai doit être un nombre' })
    .int('Le délai doit être un entier')
    .min(0, 'Le délai minimum est 0 seconde')
    .max(30, 'Le délai maximum est 30 secondes')
    .optional(),
  autoAddContacts: z.boolean().optional(),
});
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;

