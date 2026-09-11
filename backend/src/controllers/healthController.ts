import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getMetrics, redisConnectedGauge, mongodbConnectedGauge } from '../services/observability/metricsService.js';
import { getWorkerStatus } from '../services/observability/workerHeartbeat.js';

const START_TIME = Date.now();

/**
 * GET /api/health — health check enrichi.
 * Retourne l'état de MongoDB, Redis, l'uptime et la version.
 */
export const healthCheck = asyncHandler(async (_req: Request, res: Response, _next: NextFunction) => {
  const uptimeSeconds = Math.floor((Date.now() - START_TIME) / 1000);

  // État MongoDB.
  const mongoReady = mongoose.connection.readyState === 1;
  mongodbConnectedGauge.set(mongoReady ? 1 : 0);

  // État Redis (best-effort — la connexion est lazy).
  let redisReady = false;
  try {
    // Tente un ping Redis si le subscriber est disponible.
    const { isSubscriberConnected } = await import('../services/realtime/eventSubscriber.js');
    redisReady = isSubscriberConnected();
  } catch {
    redisReady = false;
  }
  redisConnectedGauge.set(redisReady ? 1 : 0);

  // État du sync worker (heartbeat Redis écrit par worker.ts toutes les 30s).
  const workerStatus = await getWorkerStatus();

  const status = mongoReady && workerStatus !== 'stale' ? 'ok' : 'degraded';
  const httpStatus = status === 'ok' ? 200 : 503;

  res.status(httpStatus).json({
    status,
    uptime: uptimeSeconds,
    version: process.env.npm_package_version ?? 'unknown',
    node: process.version,
    services: {
      mongodb: mongoReady ? 'connected' : 'disconnected',
      redis: redisReady ? 'connected' : 'disconnected',
      worker: workerStatus,
    },
  });
});

/**
 * GET /api/metrics — métriques Prometheus.
 * Content-Type: text/plain; version=0.0.4; charset=utf-8
 */
export const metricsEndpoint = asyncHandler(async (_req: Request, res: Response, _next: NextFunction) => {
  const metrics = await getMetrics();
  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(metrics);
});
