import mongoose from 'mongoose';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { accountRegistry } from './services/sync/accountRegistry.js';

async function bootstrap(): Promise<void> {
  await mongoose.connect(env.MONGO_URI);
  logger.info('Connecté à MongoDB');

  // Démarre le registry : premier cycle immédiat, puis intervalle de 30s.
  accountRegistry.start();
  logger.info('Worker de synchronisation démarré');

  // Arrêt propre sur SIGTERM/SIGINT.
  const shutdown = async (): Promise<void> => {
    logger.info('Signal d\'arrêt reçu, fermeture en cours...');
    await accountRegistry.shutdown();
    try {
      await mongoose.disconnect();
      logger.info('Déconnecté de MongoDB');
    } catch (error) {
      logger.error({ error }, 'Erreur déconnexion MongoDB');
    }
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((error) => {
  logger.error({ error }, 'Échec du démarrage du worker');
  process.exit(1);
});
