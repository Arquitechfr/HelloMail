import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from '../test/setup.js';
import { healthCheck, metricsEndpoint } from './healthController.js';
import { metricsMiddleware } from '../middleware/metricsMiddleware.js';
import { errorHandler } from '../middleware/errorHandler.js';

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use(metricsMiddleware);
  app.get('/api/health', healthCheck);
  app.get('/api/metrics', metricsEndpoint);
  app.use(errorHandler);
  return app;
}

describe('Health & Metrics', () => {
  let app: express.Express;

  beforeAll(async () => {
    await setupTestDb();
    app = createApp();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearDb();
  });

  it('GET /api/health → 200 avec status, uptime, services', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.uptime).toBeTypeOf('number');
    expect(res.body.version).toBeDefined();
    expect(res.body.node).toBeDefined();
    expect(res.body.services).toBeDefined();
    expect(res.body.services.mongodb).toBe('connected');
    // Redis est désactivé en mode test.
    expect(res.body.services.redis).toBe('disconnected');
  });

  it('GET /api/metrics → 200 au format Prometheus', async () => {
    // D'abord fait une requête pour générer des métriques.
    await request(app).get('/api/health');

    const res = await request(app).get('/api/metrics');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    // Vérifie que les métriques contiennent les compteurs Mailora.
    expect(res.text).toContain('mailora_http_requests_total');
    expect(res.text).toContain('mailora_http_request_duration_seconds');
    expect(res.text).toContain('mailora_mongodb_connected');
  });

  it('GET /api/metrics inclut les métriques Node.js par défaut', async () => {
    const res = await request(app).get('/api/metrics');

    expect(res.status).toBe(200);
    expect(res.text).toContain('nodejs_');
  });

  it('le middleware de métriques enregistre les requêtes', async () => {
    // Fait plusieurs requêtes.
    await request(app).get('/api/health');
    await request(app).get('/api/health');

    const res = await request(app).get('/api/metrics');

    // Vérifie que le compteur a été incrémenté (au moins 3 requêtes health + 1 metrics).
    expect(res.text).toContain('mailora_http_requests_total');
    // Cherche le compteur pour GET /api/health.
    const healthLines = res.text
      .split('\n')
      .filter((l) => l.includes('mailora_http_requests_total') && l.includes('/api/health'));
    expect(healthLines.length).toBeGreaterThan(0);
  });
});
