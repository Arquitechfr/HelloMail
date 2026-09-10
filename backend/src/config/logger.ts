import pino from 'pino';
import { env } from './env.js';

/**
 * Logger structuré pino avec redaction automatique des champs sensibles.
 *
 * - JSON brut en production, prettifié en développement.
 * - Redaction : headers d'auth, cookies, mots de passe, tokens, body des requêtes.
 * - Ne loggue jamais `req.body` (peut contenir des secrets en clair avant chiffrement).
 */
const transport =
  env.NODE_ENV === 'production'
    ? undefined
    : pino.transport({
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss' },
      });

export const logger = pino(
  {
    level: env.LOG_LEVEL,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        '*.password',
        '*.passwordHash',
        '*.encryptedPassword',
        '*.token',
        '*.refreshToken',
        '*.encryptedRefreshToken',
        'req.body',
        '*.accessToken',
      ],
      censor: '[REDACTED]',
    },
    base: { service: 'hellomail' },
  },
  transport,
);

export type Logger = typeof logger;
