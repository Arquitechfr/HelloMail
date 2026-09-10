import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer | null = null;

/**
 * Setup global Vitest : démarre un seul MongoMemoryServer partagé entre tous
 * les fichiers de test d'intégration. L'URI est exposée via process.env.MONGO_URI
 * pour que les workers puissent connecter mongoose dans leur propre contexte.
 *
 * Vitest globalSetup : exporte `setup` et `teardown`.
 */

export async function setup(): Promise<void> {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongoServer.getUri();
}

export async function teardown(): Promise<void> {
  // Déconnecte mongoose si une connexion est encore active dans ce contexte.
  const mongoose = await import('mongoose');
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop({ force: true });
    mongoServer = null;
  }
  delete process.env.MONGO_URI;
}
