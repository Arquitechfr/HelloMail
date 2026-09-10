import pinoHttp from 'pino-http';
import { logger } from '../config/logger.js';

/**
 * Middleware de logging des requêtes HTTP via pino-http.
 *
 * Injecte `req.log` (logger enfant avec requestId) pour usage dans les
 * controllers/middleware. Logge method, url, ip, statusCode, responseTime —
 * jamais `req.body` (redaction configurée dans le logger).
 */
export const requestLogger = pinoHttp({
  logger,
  // En mode test, on désactive le logging des requêtes pour ne pas polluer la sortie.
  autoLogging: process.env.NODE_ENV !== 'test',
  customSuccessMessage: (req, res) =>
    `${req.method} ${req.url} ${res.statusCode}`,
  customErrorMessage: (req, res, error) =>
    `${req.method} ${req.url} ${res.statusCode} ${error.message}`,
});
