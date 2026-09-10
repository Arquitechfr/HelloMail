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
