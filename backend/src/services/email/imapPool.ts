import { ImapFlow } from 'imapflow';
import type { IAccountDocument } from '../../models/Account.js';
import { decrypt } from '../security/encryptionService.js';
import { AppError } from '../../utils/AppError.js';
import { IMAP_POOL_IDLE_TTL_MS } from '../../config/constants.js';

interface PooledConnection {
  client: ImapFlow;
  lastUsed: number;
  inUse: boolean;
  idleTimer: NodeJS.Timeout;
}

/**
 * Pool de connexions ImapFlow côté API.
 *
 * Maintient une connexion persistante par compte (lazy-init), réutilisée
 * entre les requêtes de lecture/flags/dossiers. Ferme la connexion après
 * IMAP_POOL_IDLE_TTL_MS d'inactivité.
 *
 * Indépendant du sync worker (process séparé) qui gère ses propres connexions.
 *
 * Concurrence : un verrou (Promise) par compte évite l'ouverture simultanée
 * de deux connexions pour le même compte.
 */
class ImapConnectionPool {
  private pool = new Map<string, PooledConnection>();
  private locks = new Map<string, Promise<ImapFlow>>();

  /**
   * Acquiert une connexion ImapFlow pour un compte.
   * Crée la connexion si elle n'existe pas ou est morte.
   * Verrou par compte pour éviter l'initialisation concurrente.
   */
  async acquire(account: IAccountDocument): Promise<ImapFlow> {
    const accountId = String(account._id);

    // Si une init est déjà en cours, attend qu'elle finisse.
    const existingLock = this.locks.get(accountId);
    if (existingLock) {
      return existingLock;
    }

    const conn = this.pool.get(accountId);

    // Connexion existante et utilisable → la réutiliser.
    if (conn && conn.client.usable) {
      conn.inUse = true;
      conn.lastUsed = Date.now();
      this.resetIdleTimer(accountId);
      return conn.client;
    }

    // Sinon, initialiser une nouvelle connexion (avec verrou).
    const initPromise = this.initConnection(account);
    this.locks.set(accountId, initPromise);

    try {
      const client = await initPromise;
      return client;
    } finally {
      this.locks.delete(accountId);
    }
  }

  /**
   * Marque la connexion comme libérée (plus en cours d'utilisation).
   * Ne ferme pas la connexion — elle reste dans le pool pour réutilisation.
   */
  release(accountId: string): void {
    const conn = this.pool.get(accountId);
    if (conn) {
      conn.inUse = false;
      conn.lastUsed = Date.now();
      this.resetIdleTimer(accountId);
    }
  }

  /**
   * Ferme toutes les connexions du pool. À appeler sur graceful shutdown.
   */
  async closeAll(): Promise<void> {
    const closePromises: Promise<void>[] = [];
    for (const accountId of this.pool.keys()) {
      closePromises.push(this.closeConnection(accountId));
    }
    await Promise.allSettled(closePromises);
  }

  private async initConnection(account: IAccountDocument): Promise<ImapFlow> {
    const accountId = String(account._id);

    if (!account.imapConfig?.encryptedPassword) {
      throw AppError.badRequest('Configuration IMAP manquante pour ce compte');
    }

    const password = decrypt(account.imapConfig.encryptedPassword);

    const client = new ImapFlow({
      host: account.imapConfig.host,
      port: account.imapConfig.port,
      secure: account.imapConfig.secure,
      auth: {
        user: account.imapConfig.username,
        pass: password,
      },
      logger: false,
      // Pas de qresync ni autoIdle côté API : on ne fait pas d'IDLE ici.
      disableAutoIdle: true,
    });

    try {
      await client.connect();
    } catch (error) {
      throw AppError.unprocessable(
        `Connexion IMAP échouée : ${error instanceof Error ? error.message : 'erreur inconnue'}`,
      );
    }

    const conn: PooledConnection = {
      client,
      lastUsed: Date.now(),
      inUse: true,
      idleTimer: setTimeout(() => {
        this.closeConnection(accountId).catch(() => {});
      }, IMAP_POOL_IDLE_TTL_MS),
    };

    this.pool.set(accountId, conn);
    return client;
  }

  private resetIdleTimer(accountId: string): void {
    const conn = this.pool.get(accountId);
    if (!conn) return;

    clearTimeout(conn.idleTimer);
    conn.idleTimer = setTimeout(() => {
      this.closeConnection(accountId).catch(() => {});
    }, IMAP_POOL_IDLE_TTL_MS);
  }

  private async closeConnection(accountId: string): Promise<void> {
    const conn = this.pool.get(accountId);
    if (!conn) return;

    clearTimeout(conn.idleTimer);
    this.pool.delete(accountId);

    try {
      await conn.client.logout();
    } catch {
      // Connexion déjà fermée — ignore.
    }
  }
}

export const imapPool = new ImapConnectionPool();
