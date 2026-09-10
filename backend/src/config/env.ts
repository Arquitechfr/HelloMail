import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  MONGO_URI: z.string().min(1, 'MONGO_URI est requis'),
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_KEY doit être une clé hexadécimale de 32 octets (64 caractères)'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET doit contenir au moins 32 caractères'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET doit contenir au moins 32 caractères'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN_DAYS: z.coerce.number().default(30),
  FRONTEND_URL: z.string().url('FRONTEND_URL doit être une URL valide').default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  REDIS_HOST: z.string().min(1, 'REDIS_HOST est requis'),
  REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6379),
  REDIS_PASSWORD: z.string().optional(),
  // --- OAuth Google (Phase 6) — optionnel, requis uniquement si OAuth activé ---
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z
    .string()
    .url('GOOGLE_REDIRECT_URI doit être une URL valide')
    .default('http://localhost:4000/api/accounts/oauth/google/callback'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Configuration invalide — variables d\'environnement manquantes ou incorrectes :\n');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
