import { Request, Response, NextFunction } from 'express';
import { recordHttpRequest } from '../services/observability/metricsService.js';

/**
 * Middleware d'instrumentation — enregistre les métriques Prometheus pour chaque requête.
 * Doit être monté avant les routes mais après le rate limit global.
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  // Enregistre les métriques à la fin de la réponse.
  res.on('finish', () => {
    const durationNs = Number(process.hrtime.bigint() - start);
    const durationSeconds = durationNs / 1_000_000_000;

    // Normalise le chemin de la route (remplace les IDs par :id).
    const route = normalizeRoute(req.route?.path ?? req.path);

    recordHttpRequest(req.method, route, res.statusCode, durationSeconds);
  });

  next();
}

/**
 * Normalise un chemin de route pour éviter la cardinalité excessive dans les labels.
 * Remplace les ObjectId et autres IDs par :id.
 */
function normalizeRoute(path: string): string {
  return path
    .replace(/[0-9a-f]{24}/gi, ':id') // ObjectId MongoDB
    .replace(/\/\d+/g, '/:id'); // IDs numériques
}
