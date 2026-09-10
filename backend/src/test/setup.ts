import mongoose from 'mongoose';

/**
 * Connecte mongoose au MongoMemoryServer démarré par globalSetup.ts.
 *
 * globalSetup s'exécute dans un contexte séparé — la connexion mongoose n'est
 * PAS partagée avec les workers. On lit l'URI depuis process.env.MONGO_URI
 * (positionnée par globalSetup) et on connecte mongoose ici, dans le worker.
 *
 * Idempotent : si mongoose est déjà connecté, ne fait rien.
 */
export async function setupTestDb(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    return; // Déjà connecté.
  }

  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error(
      'MONGO_URI non défini — globalSetup.ts n\'a pas démarré le MongoMemoryServer. ' +
      'Vérifiez que globalSetup est configuré dans vitest.config.ts.',
    );
  }

  // Déconnecte toute connexion stale d'un test précédent.
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  await mongoose.connect(uri);
}

/**
 * Ne ferme pas la connexion — elle est réutilisée par le fichier de test suivant.
 * La fermeture finale est gérée par globalSetup.ts teardown().
 */
export async function teardownTestDb(): Promise<void> {
  // No-op : la connexion persiste entre les fichiers de test.
  // globalSetup.teardown() ferme mongoose + MongoMemoryServer à la fin.
}

/**
 * Vide toutes les collections (sauf les index système) pour isoler chaque test.
 * À appeler dans `beforeEach`.
 */
export async function clearDb(): Promise<void> {
  if (mongoose.connection.readyState === 0) return;

  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    const collection = collections[key];
    // On ne supprime pas la collection (pour conserver les index),
    // on vide juste les documents.
    await collection.deleteMany({});
  }
}
