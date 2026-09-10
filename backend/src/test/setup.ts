import mongoose from 'mongoose';

/**
 * Réutilise la connexion mongoose globale établie par globalSetup.ts.
 * Ne démarre pas de nouveau MongoMemoryServer — la connexion est partagée.
 *
 * En l'absence de globalSetup (ex: tests unitaires isolés), ne fait rien.
 */
export async function setupTestDb(): Promise<void> {
  // La connexion est établie par globalSetup.ts. Si elle n'est pas active
  // (ex: test unitaire sans globalSetup), on ne fait rien — les tests
  // d'intégration échoueront explicitement si la DB n'est pas disponible.
  if (mongoose.connection.readyState === 1) {
    return;
  }

  // Fallback : si pas de connexion globale, on attend un peu (le globalSetup
  // peut encore être en cours de démarrage).
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

/**
 * Ne ferme pas la connexion globale — elle est gérée par globalSetup.ts.
 * Vide juste les collections si demandé.
 */
export async function teardownTestDb(): Promise<void> {
  // La fermeture est gérée par globalSetup.ts. Ne rien faire ici.
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
