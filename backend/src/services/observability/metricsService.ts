import { Registry, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';

/** Registry Prometheus personnalisé (isolation des métriques HelloMail). */
export const registry = new Registry();

// Collecte les métriques par défaut Node.js (event loop, GC, memory, etc.).
collectDefaultMetrics({ register: registry });

/** Compteur de requêtes HTTP par méthode, route et statut. */
export const httpRequestCounter = new Counter({
  name: 'hellomail_http_requests_total',
  help: 'Nombre total de requêtes HTTP',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [registry],
});

/** Histogramme de la durée des requêtes HTTP (en secondes). */
export const httpRequestDuration = new Histogram({
  name: 'hellomail_http_request_duration_seconds',
  help: 'Durée des requêtes HTTP en secondes',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

/** Jauge du nombre de comptes email actifs. */
export const activeAccountsGauge = new Gauge({
  name: 'hellomail_active_accounts',
  help: 'Nombre de comptes email actifs',
  registers: [registry],
});

/** Jauge du nombre de connexions IMAP actives dans le pool API. */
export const imapPoolSizeGauge = new Gauge({
  name: 'hellomail_imap_pool_size',
  help: 'Nombre de connexions IMAP actives dans le pool API',
  registers: [registry],
});

/** Jauge de l'état de la connexion MongoDB (1 = connecté, 0 = déconnecté). */
export const mongodbConnectedGauge = new Gauge({
  name: 'hellomail_mongodb_connected',
  help: 'État de la connexion MongoDB (1 = connecté, 0 = déconnecté)',
  registers: [registry],
});

/** Jauge de l'état de la connexion Redis (1 = connecté, 0 = déconnecté). */
export const redisConnectedGauge = new Gauge({
  name: 'hellomail_redis_connected',
  help: 'État de la connexion Redis (1 = connecté, 0 = déconnecté)',
  registers: [registry],
});

/**
 * Génère le texte des métriques au format Prometheus.
 */
export async function getMetrics(): Promise<string> {
  return registry.metrics();
}

/**
 * Incrémente le compteur de requêtes et enregistre la durée.
 */
export function recordHttpRequest(
  method: string,
  route: string,
  status: number,
  durationSeconds: number,
): void {
  httpRequestCounter.inc({ method, route, status: String(status) });
  httpRequestDuration.observe({ method, route, status: String(status) }, durationSeconds);
}
