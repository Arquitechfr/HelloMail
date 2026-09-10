import { AccountModel, type IAccountDocument } from '../../models/Account.js';
import { ACCOUNT_POLL_INTERVAL_MS } from '../../config/constants.js';
import { SyncManager } from './syncManager.js';

/**
 * Registre des SyncManager actifs en mémoire.
 *
 * Polling périodique (ACCOUNT_POLL_INTERVAL_MS) de la collection Account pour
 * découvrir les comptes actifs et démarrer/arrêter les SyncManager.
 *
 * Volontairement simple (pas de change streams ni pub/sub) — structuré pour
 * rester extractible plus tard (Redis, BullMQ, sharding multi-worker).
 */
class AccountRegistry {
  private managers = new Map<string, SyncManager>();
  private interval: NodeJS.Timeout | null = null;

  /**
   * Démarre le polling : cycle immédiat puis intervalle régulier.
   */
  start(): void {
    console.log('[registry] Démarrage du polling des comptes actifs');
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

    console.log(`[registry] Arrêt de ${this.managers.size} SyncManager(s)`);

    const stopPromises: Promise<void>[] = [];
    for (const manager of this.managers.values()) {
      stopPromises.push(manager.stop().catch((err) => {
        console.error(`[registry] Erreur arrêt SyncManager — ${err instanceof Error ? err.message : 'erreur inconnue'}`);
      }));
    }

    await Promise.allSettled(stopPromises);
    this.managers.clear();
    console.log('[registry] Tous les SyncManager arrêtés');
  }

  /**
   * Un cycle de polling : découvre les comptes actifs, démarre les nouveaux,
   * arrête ceux qui ne sont plus actifs.
   */
  private async poll(): Promise<void> {
    let activeAccounts: IAccountDocument[];

    try {
      activeAccounts = await AccountModel.find({ provider: 'imap', isActive: true });
    } catch (error) {
      // Si Mongo est injoignable, on ne crash pas — on retentera au prochain cycle.
      console.error(
        `[registry] Erreur lors du polling des comptes — ${error instanceof Error ? error.message : 'erreur inconnue'}`,
      );
      return;
    }

    const activeIds = new Set(activeAccounts.map((a) => String(a._id)));

    // Démarre les nouveaux comptes actifs.
    for (const account of activeAccounts) {
      const accountId = String(account._id);
      if (!this.managers.has(accountId)) {
        console.log(`[registry] Démarrage SyncManager pour le compte ${accountId}`);
        const manager = new SyncManager(account);
        this.managers.set(accountId, manager);
        // Fire-and-forget : la boucle tourne en arrière-plan.
        manager.start().catch((err) => {
          console.error(
            `[registry] SyncManager compte ${accountId} terminé en erreur — ${err instanceof Error ? err.message : 'erreur inconnue'}`,
          );
        });
      }
    }

    // Arrête les comptes qui ne sont plus actifs ou supprimés.
    for (const [accountId, manager] of this.managers) {
      if (!activeIds.has(accountId)) {
        console.log(`[registry] Arrêt SyncManager pour le compte ${accountId} (inactif/supprimé)`);
        this.managers.delete(accountId);
        manager.stop().catch((err) => {
          console.error(
            `[registry] Erreur arrêt SyncManager compte ${accountId} — ${err instanceof Error ? err.message : 'erreur inconnue'}`,
          );
        });
      }
    }
  }
}

export const accountRegistry = new AccountRegistry();
