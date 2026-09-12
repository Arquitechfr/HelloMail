import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { requestLogger } from './middleware/requestLogger.js';
import { metricsMiddleware } from './middleware/metricsMiddleware.js';
import { healthCheck, metricsEndpoint } from './controllers/healthController.js';
import { authRoutes } from './routes/authRoutes.js';
import { accountsRoutes } from './routes/accountsRoutes.js';
import { messagesRoutes } from './routes/messagesRoutes.js';
import { foldersRoutes } from './routes/foldersRoutes.js';
import { draftsRoutes } from './routes/draftsRoutes.js';
import { exportRoutes } from './routes/exportRoutes.js';
import { eventsRoutes } from './routes/eventsRoutes.js';
import { oauthRoutes } from './routes/oauthRoutes.js';
import { twoFactorRoutes } from './routes/twoFactorRoutes.js';
import { contactsRoutes } from './routes/contactsRoutes.js';
import rulesRoutes from './routes/rulesRoutes.js';
import tagsRoutes from './routes/tagsRoutes.js';
import templatesRoutes from './routes/templatesRoutes.js';
import logoRoutes from './routes/logoRoutes.js';
import { unifiedRoutes } from './routes/unifiedRoutes.js';
import { scheduledMessagesRoutes } from './routes/scheduledMessagesRoutes.js';
import pgpRoutes from './routes/pgpRoutes.js';
import { reminderRoutes } from './routes/reminderRoutes.js';
import { senderListRoutes } from './routes/senderListRoutes.js';
import smartFoldersRoutes from './routes/smartFoldersRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import { globalRateLimit } from './middleware/rateLimit.js';
import { mountBodyParsers } from './middleware/bodyParsers.js';
import { compressionMiddleware } from './middleware/compressionMiddleware.js';
import { imapPool } from './services/email/imapPool.js';

async function bootstrap(): Promise<void> {
  await mongoose.connect(env.MONGO_URI);
  logger.info('Connecté à MongoDB');

  const app = express();

  // Trust proxy en production pour que req.ip reflète l'IP réelle derrière nginx.
  // Suppose un seul hop de proxy. Ajuster si la chaîne de proxy grandit.
  if (env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  // Sécurité : headers HTTP (Helmet). CSP désactivée (API REST, pas de HTML rendu côté serveur).
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  // Logging structuré des requêtes HTTP (pino-http).
  app.use(requestLogger);

  // Body parsers JSON : 30 Mo sur /send (pièces jointes base64) monté avant
  // le global 100 Ko — voir middleware/bodyParsers.ts.
  mountBodyParsers(app);
  app.use(cookieParser());
  app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
  app.use(compressionMiddleware);

  // Rate limit global sur l'API (300 req/min/IP par défaut, configurable via
  // RATE_LIMIT_GLOBAL_*). Exempte /api/health, /api/metrics et /api/events.
  app.use('/api', globalRateLimit);
  app.use(metricsMiddleware);

  app.get('/api/health', healthCheck);
  app.get('/api/metrics', metricsEndpoint);

  app.use('/api/auth', authRoutes);
  app.use('/api/auth', twoFactorRoutes);
  app.use('/api/accounts', accountsRoutes);
  app.use('/api/accounts', messagesRoutes);
  app.use('/api/accounts', foldersRoutes);
  app.use('/api/accounts', draftsRoutes);
  app.use('/api/accounts', exportRoutes);
  app.use('/api/accounts', scheduledMessagesRoutes);
  app.use('/api/accounts', reminderRoutes);
  app.use('/api/accounts/oauth', oauthRoutes);
  app.use('/api/contacts', contactsRoutes);
  app.use('/api/rules', rulesRoutes);
  app.use('/api/tags', tagsRoutes);
  app.use('/api/templates', templatesRoutes);
  app.use('/api/logos', logoRoutes);
  app.use('/api/unified', unifiedRoutes);
  app.use('/api/pgp', pgpRoutes);
  app.use('/api/sender-lists', senderListRoutes);
  app.use('/api/smart-folders', smartFoldersRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api', eventsRoutes);

  app.use(notFound);
  app.use(errorHandler);

  const server = app.listen(env.PORT, () => {
    logger.info(`Mailora démarré sur le port ${env.PORT}`);
  });

  // Graceful shutdown : SIGTERM/SIGINT arrêtent proprement le serveur.
  let shuttingDown = false;
  const gracefulShutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Signal ${signal} reçu, fermeture en cours...`);

    // Safety net : forcer la sortie après 10s si le graceful shutdown bloque.
    const forceExit = setTimeout(() => {
      logger.error('Timeout du graceful shutdown, sortie forcée');
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    server.close(async () => {
      try {
        await imapPool.closeAll();
        logger.info('Pool IMAP fermé');
      } catch (error) {
        logger.error({ error }, 'Erreur fermeture pool IMAP');
      }

      try {
        await mongoose.disconnect();
        logger.info('Déconnecté de MongoDB');
      } catch (error) {
        logger.error({ error }, 'Erreur déconnexion MongoDB');
      }

      process.exit(0);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

bootstrap().catch((error) => {
  logger.error({ error }, 'Échec du démarrage du serveur');
  process.exit(1);
});
