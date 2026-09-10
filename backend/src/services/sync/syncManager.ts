import { ImapFlow } from 'imapflow';
import { env } from '../../config/env.js';
import {
  MAX_CONSECUTIVE_SYNC_FAILURES,
  SYNC_BACKOFF_BASE_MS,
  SYNC_BACKOFF_MAX_MS,
  STABLE_CONNECTION_RESET_MS,
} from '../../config/constants.js';
import { AccountModel, type IAccountDocument } from '../../models/Account.js';
import { decrypt } from '../security/encryptionService.js';
import { runInitialSync } from './initialSync.js';
import { runIdleLoop } from './idleLoop.js';

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
        });

        await this.client.connect();
        console.log(`[sync] Compte ${accountId} : connexion IMAP établie`);

        // 3. Sync initiale (idempotente).
        await runInitialSync(this.client, accountId);

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
          console.log(`[sync] Compte ${accountId} : stop pendant sync initiale, arrêt propre`);
          break;
        }

        // 4. Démarre le timer de connexion stable (reset du compteur d'échecs).
        this.startStableTimer();

        // 5. Boucle IDLE (bloque tant que la connexion est active).
        await runIdleLoop(
          this.client,
          accountId,
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
        console.error(
          `[sync] Compte ${accountId} : échec n°${this.consecutiveFailures} — ${errorMsg}`,
        );

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
          console.error(
            `[sync] Compte ${accountId} : désactivé après ${this.consecutiveFailures} échecs consécutifs`,
          );
          try {
            await AccountModel.updateOne(
              { _id: this.account._id },
              { isActive: false, lastSyncError: `Désactivé : ${errorMsg}` },
            );
          } catch (dbError) {
            console.error(
              `[sync] Compte ${accountId} : impossible de désactiver le compte en base — ${dbError instanceof Error ? dbError.message : 'erreur inconnue'}`,
            );
          }
          this.running = false;
          break;
        }

        // Backoff exponentiel : base * 2^(failures-1), plafonné à max.
        const backoffMs = Math.min(
          SYNC_BACKOFF_BASE_MS * Math.pow(2, this.consecutiveFailures - 1),
          SYNC_BACKOFF_MAX_MS,
        );
        console.log(`[sync] Compte ${accountId} : reconnexion dans ${backoffMs}ms`);

        await this.sleep(backoffMs);
      }
    }
  }

  private startStableTimer(): void {
    this.clearStableTimer();
    this.stableTimer = setTimeout(() => {
      if (this.consecutiveFailures > 0) {
        console.log(
          `[sync] Compte ${this.account._id} : connexion stable, reset du compteur d'échecs`,
        );
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
