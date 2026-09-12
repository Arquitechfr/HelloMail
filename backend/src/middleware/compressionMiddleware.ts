import compression from 'compression';
import type { Request, Response } from 'express';

/**
 * Filtre personnalisé pour la compression HTTP :
 * - Ignore les flux Server-Sent Events (SSE) pour préserver le temps réel sans buffering.
 * - Respecte le header standard 'x-no-compression'.
 * - Délègue pour le reste à compression.filter (vérifie le Content-Type compressible).
 */
export function compressionFilter(req: Request, res: Response): boolean {
  if (req.headers['x-no-compression']) {
    return false;
  }

  // Ne jamais compresser les routes ou flux SSE
  if (
    req.path.endsWith('/events') ||
    req.headers.accept?.includes('text/event-stream') ||
    String(res.getHeader('Content-Type') ?? '').includes('text/event-stream')
  ) {
    return false;
  }

  return compression.filter(req, res);
}

/**
 * Middleware Express de compression HTTP gzip / deflate.
 * Seuil minimal configuré à 1024 octets (1 Ko) pour éviter le surcoût CPU
 * sur les payloads minuscules.
 */
export const compressionMiddleware = compression({
  threshold: 1024,
  filter: compressionFilter,
});
