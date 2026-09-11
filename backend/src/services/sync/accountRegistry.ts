import { AccountModel, type IAccountDocument } from '../../models/Account.js';
import { ACCOUNT_POLL_INTERVAL_MS } from '../../config/constants.js';
import { logger } from '../../config/logger.js';
import { SyncManager } from './syncManager.js';
import { acquireSyncLock, closeSyncLockRedis, type SyncLockHandle } from './syncLock.js';
import { checkExpiredSnoozes } from '../email/snoozeService.js';

/**
 * Registre des SyncManager actifs en mémoire.
 *
 * Polling périodique (ACCOUNT_POLL_INTERVAL_MS) de la collection Account pour
 * découvrir les comptes actifs et démarrer/arrêter les SyncManager.
 * Tous les providers sont couverts : imap (mot de passe) et OAuth
 * (google_oauth, microsoft_oauth — authentification XOAUTH2 dans SyncManager).
 *
 * Volontairement simple (pas de change streams ni pub/sub) — structuré pour
 * rester extractible plus tard (Redis, BullMQ, sharding multi-worker).
 */
class AccountRegistry {
  private managers = new Map<string, SyncManager>();
  private locks = new Map<string, SyncLockHandle>();
  private interval: NodeJS.Timeout | null = null;

  /**
   * Démarre le polling : cycle immédiat puis intervalle régulier.
   */
  start(): void {
    logger.info('Démarrage du polling des comptes actifs');
    // Premier cycle immédiat.
    this.poll();
    this.interval = setInterval(() => this.poll(), ACCOUNT_POLL_INTERVAL_MS);
  }

  /**
   * Arrêt propre : stoppe tous les SyncManager et l'intervalle.
   */
  async shutdown(): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    logger.info({ count: this.managers.size }, 'Arrêt des SyncManager');

    const stopPromises: Promise<void>[] = [];
    for (const manager of this.managers.values()) {
      stopPromises.push(manager.stop().catch((err) => {
        logger.error(
          { err: err instanceof Error ? err.message : 'erreur inconnue' },
          'Erreur arrêt SyncManager',
        );
      }));
    }

    await Promise.allSettled(stopPromises);
    this.managers.clear();

    // Libère tous les locks Redis détenus.
    const releasePromises: Promise<void>[] = [];
    for (const lock of this.locks.values()) {
      releasePromises.push(lock.release());
    }
    this.locks.clear();
    await Promise.allSettled(releasePromises);
    await closeSyncLockRedis();

    logger.info('Tous les SyncManager arrêtés');
  }

  /**
   * Un cycle de polling : découvre les comptes actifs, démarre les nouveaux,
   * arrête ceux qui ne sont plus actifs.
   */
  private async poll(): Promise<void> {
    // Vérifie et réveille les emails en sommeil expirés
    try {
      await checkExpiredSnoozes();
    } catch (err) {
      logger.error(
        { err: err instanceof Error ? err.message : 'erreur inconnue' },
        'Erreur vérification snoozes expirés',
      );
    }

    let activeAccounts: IAccountDocument[];

    try {
      // Tous les providers : imap + OAuth (google_oauth, microsoft_oauth).
      // SyncManager rejette proprement un compte sans imapConfig.
      activeAccounts = await AccountModel.find({ isActive: true });
    } catch (error) {
      // Si Mongo est injoignable, on ne crash pas — on retentera au prochain cycle.
      logger.error(
        { err: error instanceof Error ? error.message : 'erreur inconnue' },
        'Erreur lors du polling des comptes',
      );
      return;
    }

    const activeIds = new Set(activeAccounts.map((a) => String(a._id)));

    // Démarre les nouveaux comptes actifs (sous lock distribué — R5).
    for (const account of activeAccounts) {
      const accountId = String(account._id);
      if (!this.managers.has(accountId)) {
        // Lock distribué Redis : si un autre worker synchronise déjà ce
        // compte, acquireSyncLock retourne null et on réessaiera au
        // prochain cycle. Fail-open si Redis est down (lock no-op).
        const lock = await acquireSyncLock(accountId, () => {
          // Lock perdu (expiré ou volé) → on arrête ce SyncManager.
          logger.warn({ accountId }, 'Lock de sync perdu, arrêt du SyncManager');
          this.stopManager(accountId);
        });
        if (!lock) {
          logger.debug({ accountId }, 'Sync déjà détenue par un autre worker, compte ignoré');
          continue;
        }

        logger.info({ accountId, provider: account.provider }, 'Démarrage SyncManager');
        const manager = new SyncManager(account);
        this.managers.set(accountId, manager);
        this.locks.set(accountId, lock);
        // Fire-and-forget : la boucle tourne en arrière-plan.
        manager.start().catch((err) => {
          logger.error(
            { accountId, err: err instanceof Error ? err.message : 'erreur inconnue' },
            'SyncManager terminé en erreur',
          );
        });
      }
    }

    // Arrête les comptes qui ne sont plus actifs ou supprimés.
    for (const accountId of this.managers.keys()) {
      if (!activeIds.has(accountId)) {
        this.stopManager(accountId);
      }
    }
  }

  /**
   * Arrête un SyncManager et libère son lock distribué.
   * Fire-and-forget : les erreurs sont loguées, jamais propagées.
   */
  private stopManager(accountId: string): void {
    const manager = this.managers.get(accountId);
    const lock = this.locks.get(accountId);

    logger.info({ accountId }, 'Arrêt SyncManager');
    this.managers.delete(accountId);
    this.locks.delete(accountId);

    if (manager) {
      manager.stop().catch((err) => {
        logger.error(
          { accountId, err: err instanceof Error ? err.message : 'erreur inconnue' },
          'Erreur arrêt SyncManager',
        );
      });
    }
    if (lock) {
      lock.release().catch((err) => {
        logger.warn(
          { accountId, err: err instanceof Error ? err.message : 'erreur inconnue' },
          'Erreur libération lock de sync',
        );
      });
    }
  }
}

export const accountRegistry = new AccountRegistry();
