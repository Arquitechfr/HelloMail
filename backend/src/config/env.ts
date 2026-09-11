import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4001),
  MONGO_URI: z.string().min(1, 'MONGO_URI est requis'),
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_KEY doit être une clé hexadécimale de 32 octets (64 caractères)'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET doit contenir au moins 32 caractères'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET doit contenir au moins 32 caractères'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN_DAYS: z.coerce.number().default(30),
  // Une ou plusieurs URLs frontend séparées par des virgules (CORS multi-origines).
  // La première est l'URL principale : rpID WebAuthn et redirections OAuth.
  FRONTEND_URL: z
    .string()
    .default('http://localhost:3001')
    .transform((val) =>
      val.split(',').map((u) => u.trim().replace(/\/+$/, '')).filter(Boolean),
    )
    .pipe(
      z
        .array(z.string().url('FRONTEND_URL doit contenir des URLs valides séparées par des virgules'))
        .min(1, 'FRONTEND_URL doit contenir au moins une URL'),
    ),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  // --- Rate limit global — optionnel, override possible sans rebuild ---
  RATE_LIMIT_GLOBAL_MAX: z.coerce.number().int().positive().optional(),
  RATE_LIMIT_GLOBAL_WINDOW_MS: z.coerce.number().int().positive().optional(),
  REDIS_HOST: z.string().min(1, 'REDIS_HOST est requis'),
  REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6379),
  REDIS_PASSWORD: z.string().optional(),
  // --- OAuth Google (Phase 6) — optionnel, requis uniquement si OAuth activé ---
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z
    .string()
    .url('GOOGLE_REDIRECT_URI doit être une URL valide')
    .default('http://localhost:4001/api/accounts/oauth/google/callback'),
  // --- OAuth Microsoft (Phase 7) — optionnel, requis uniquement si OAuth activé ---
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_REDIRECT_URI: z
    .string()
    .url('MICROSOFT_REDIRECT_URI doit être une URL valide')
    .default('http://localhost:4001/api/accounts/oauth/microsoft/callback'),
  // --- Logo.dev (Phase 9) — optionnel, requis pour la récupération des logos ---
  LOGO_DEV_TOKEN: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Configuration invalide — variables d\'environnement manquantes ou incorrectes :\n');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
