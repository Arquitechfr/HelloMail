import mongoose from 'mongoose';
import { env } from './config/env.js';
import { accountRegistry } from './services/sync/accountRegistry.js';

async function bootstrap(): Promise<void> {
  await mongoose.connect(env.MONGO_URI);
  console.log('[worker] Connecté à MongoDB');

  // Démarre le registry : premier cycle immédiat, puis intervalle de 30s.
  accountRegistry.start();
  console.log('[worker] Worker de synchronisation démarré');

  // Arrêt propre sur SIGTERM/SIGINT.
  const shutdown = async (): Promise<void> => {
    console.log('[worker] Signal d\'arrêt reçu, fermeture en cours...');
    await accountRegistry.shutdown();
    try {
      await mongoose.disconnect();
      console.log('[worker] Déconnecté de MongoDB');
    } catch (error) {
      console.error(
        `[worker] Erreur déconnexion MongoDB — ${error instanceof Error ? error.message : 'erreur inconnue'}`,
      );
    }
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((error) => {
  console.error(
    `[worker] Échec du démarrage — ${error instanceof Error ? error.message : 'erreur inconnue'}`,
  );
  process.exit(1);
});
