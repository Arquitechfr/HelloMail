import { ImapFlow } from 'imapflow';
import { logger } from '../../config/logger.js';
import {
  MAX_CONSECUTIVE_SYNC_FAILURES,
  SYNC_BACKOFF_BASE_MS,
  SYNC_BACKOFF_MAX_MS,
  STABLE_CONNECTION_RESET_MS,
} from '../../config/constants.js';
import { AccountModel, type IAccountDocument } from '../../models/Account.js';
import { decrypt } from '../security/encryptionService.js';
import { runInitialSyncAll } from './initialSync.js';
import { reconcileAllFolders } from './reconcileAllFolders.js';
import { runIdleLoop } from './idleLoop.js';
import { publishEvent } from '../realtime/eventPublisher.js';

/**
 * Gère le cycle de vie de synchronisation d'un compte IMAP :
 * connexion, sync initiale, boucle IDLE, reconnexion avec backoff exponentiel.
 *
 * Une instance par compte actif. La désactivation automatique après
 * MAX_CONSECUTIVE_SYNC_FAILURES échecs consécutifs évite de marteler
 * un serveur en échec permanent.
 */
export class SyncManager {
  private readonly account: IAccountDocument;
  private client: ImapFlow | null = null;
  private abortController: AbortController | null = null;
  private consecutiveFailures = 0;
  private stableTimer: NodeJS.Timeout | null = null;
  private running = false;
  private startPromise: Promise<void> | null = null;

  constructor(account: IAccountDocument) {
    this.account = account;
  }

  /**
   * Démarre la boucle de synchronisation. Tourne en arrière-plan jusqu'à
   * stop() ou désactivation automatique. Retourne une promesse qui se
   * résout quand la boucle se termine.
   */
  async start(): Promise<void> {
    this.running = true;
    this.startPromise = this.runLoop();
    await this.startPromise;
  }

  /**
   * Arrête proprement : abort le signal, ferme la connexion IMAP,
   * attend la fin de la boucle, remet le compteur d'échecs à zéro.
   */
  async stop(): Promise<void> {
    this.running = false;

    if (this.abortController) {
      this.abortController.abort();
    }

    // Ferme la connexion IMAP proprement (interrompt un fetch en cours).
    if (this.client) {
      try {
        await this.client.logout();
      } catch {
        // Connexion déjà fermée — ignore.
      }
      this.client = null;
    }

    // Attend que la boucle se termine.
    if (this.startPromise) {
      await this.startPromise.catch(() => {});
    }

    this.clearStableTimer();
    this.consecutiveFailures = 0;
  }

  private async runLoop(): Promise<void> {
    const accountId = String(this.account._id);

    while (this.running) {
      this.abortController = new AbortController();

      try {
        // 1. Déchiffre le mot de passe IMAP.
        if (!this.account.imapConfig?.encryptedPassword) {
          throw new Error('Configuration IMAP manquante pour ce compte');
        }
        const password = decrypt(this.account.imapConfig.encryptedPassword);

        // 2. Crée et connecte le client ImapFlow.
        this.client = new ImapFlow({
          host: this.account.imapConfig.host,
          port: this.account.imapConfig.port,
          secure: this.account.imapConfig.secure,
          auth: {
            user: this.account.imapConfig.username,
            pass: password,
          },
          logger: false,
          qresync: true,
          disableAutoIdle: false,
          autoIdleDelay: 15_000,
          // Relance l'IDLE toutes les 30s pour maintenir la connexion active
          // (évite les Socket timeouts). ImapFlow n'expose pas d'option keepalive.
          maxIdleTime: 30_000,
        });

        await this.client.connect();
        logger.info({ accountId }, 'Connexion IMAP établie');

        // 3. Sync initiale (idempotente) — INBOX + dossiers spéciaux (Sent, Drafts, Trash, Junk, Archive).
        const syncedCount = await runInitialSyncAll(this.client, accountId, this.account);

        // 3b. Reconciliation multi-dossiers — supprime les messages fantômes
        // (supprimés distamment entre deux connexions du worker). Bornée aux UID
        // trackés en base, pas de SEARCH ALL. Voir services/sync/AGENTS.md.
        const deletedCount = await reconcileAllFolders(this.client, accountId, this.account);
        if (deletedCount > 0) {
          logger.info({ accountId, deleted: deletedCount }, 'Reconciliation : messages fantômes supprimés');
        }

        // Publie un événement si des messages ont été synchronisés (rattrapage après reconnexion).
        if (syncedCount > 0 || deletedCount > 0) {
          publishEvent({
            type: 'message:new',
            accountId,
            userId: String(this.account.userId),
            payload: { folder: 'INBOX' },
          }).catch(() => {});
        }

        // Marque la sync comme réussie : met à jour lastSyncedAt et efface lastSyncError.
        try {
          await AccountModel.updateOne(
            { _id: this.account._id },
            { lastSyncedAt: new Date(), $unset: { lastSyncError: '' } },
          );
        } catch {
          // Non bloquant — la sync continue même si la mise à jour du statut échoue.
        }

        // Si stop() a été appelé pendant initialSync, on sort proprement.
        if (this.abortController.signal.aborted) {
          logger.info({ accountId }, 'Stop pendant sync initiale, arrêt propre');
          break;
        }

        // 4. Démarre le timer de connexion stable (reset du compteur d'échecs).
        this.startStableTimer();

        // 5. Boucle IDLE (bloque tant que la connexion est active).
        await runIdleLoop(
          this.client,
          accountId,
          String(this.account.userId),
          'INBOX',
          this.abortController.signal,
        );

        // 6. La boucle IDLE s'est terminée (close/error/abort).
        this.clearStableTimer();

        if (this.abortController.signal.aborted) {
          // stop() volontaire — on sort de la boucle.
          break;
        }

        // Connexion perdue involontairement → on retentera.
        throw new Error('Boucle IDLE terminée sans stop volontaire');
      } catch (error) {
        this.clearStableTimer();

        const errorMsg = error instanceof Error ? error.message : 'erreur inconnue';

        // Ferme la connexion si encore ouverte.
        if (this.client) {
          try {
            await this.client.logout();
          } catch {
            // Ignore.
          }
          this.client = null;
        }

        if (this.abortController?.signal.aborted) {
          // stop() volontaire pendant l'erreur — on sort.
          break;
        }

        this.consecutiveFailures++;
        logger.warn({ accountId, failures: this.consecutiveFailures, error: errorMsg }, 'Échec de sync');

        // Met à jour lastSyncError en base.
        try {
          await AccountModel.updateOne(
            { _id: this.account._id },
            { lastSyncError: errorMsg },
          );
        } catch {
          // Si la base est injoignable, on continue quand même le backoff.
        }

        // Désactivation automatique après trop d'échecs consécutifs.
        if (this.consecutiveFailures > MAX_CONSECUTIVE_SYNC_FAILURES) {
          logger.error({ accountId, failures: this.consecutiveFailures }, 'Compte désactivé après échecs consécutifs');
          try {
            await AccountModel.updateOne(
              { _id: this.account._id },
              { isActive: false, lastSyncError: `Désactivé : ${errorMsg}` },
            );
          } catch (dbError) {
            logger.error(
              { accountId, error: dbError instanceof Error ? dbError.message : 'erreur inconnue' },
              'Impossible de désactiver le compte en base',
            );
          }
          // Notifie le frontend de l'erreur de sync via Redis Pub/Sub.
          publishEvent({
            type: 'account:syncError',
            accountId,
            userId: String(this.account.userId),
            payload: { error: errorMsg, disabled: true },
          }).catch(() => {
            // Non bloquant — Redis peut être indisponible.
          });
          this.running = false;
          break;
        }

        // Backoff exponentiel : base * 2^(failures-1), plafonné à max.
        const backoffMs = Math.min(
          SYNC_BACKOFF_BASE_MS * Math.pow(2, this.consecutiveFailures - 1),
          SYNC_BACKOFF_MAX_MS,
        );
        logger.info({ accountId, backoffMs }, 'Reconnexion dans');

        await this.sleep(backoffMs);
      }
    }
  }

  private startStableTimer(): void {
    this.clearStableTimer();
    this.stableTimer = setTimeout(() => {
      if (this.consecutiveFailures > 0) {
        logger.info({ accountId: String(this.account._id) }, 'Connexion stable, reset du compteur d\'échecs');
        this.consecutiveFailures = 0;
      }
    }, STABLE_CONNECTION_RESET_MS);
  }

  private clearStableTimer(): void {
    if (this.stableTimer) {
      clearTimeout(this.stableTimer);
      this.stableTimer = null;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
