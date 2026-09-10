import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer | null = null;

/**
 * Setup global Vitest : démarre un seul MongoMemoryServer partagé entre tous
 * les fichiers de test d'intégration. Évite les conflits de démarrage parallèle
 * et l'accumulation de fichiers temporaires.
 *
 * Vitest globalSetup : exporte `setup` et `teardown` (ou un default qui retourne
 * une fonction de teardown).
 */

export async function setup(): Promise<void> {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(uri);
}

export async function teardown(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop({ force: true });
    mongoServer = null;
  }
}
