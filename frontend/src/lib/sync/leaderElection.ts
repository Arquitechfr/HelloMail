import { tabSyncHub, TabSyncHub } from "./tabSyncHub";
import type {
  LeaderHeartbeatPayload,
  LeaderResignedPayload,
  LeaderClaimPayload,
} from "./tabSyncTypes";

export const HEARTBEAT_INTERVAL_MS = 3000;
export const LEADER_TIMEOUT_MS = 7000;

export type LeaderChangeCallback = (isLeader: boolean) => void;

/**
 * Coordonne l'élection d'un onglet leader ("Leader Election") pour n'avoir qu'un
 * unique flux SSE ouvert vers le serveur par instance de navigateur.
 */
export class LeaderElection {
  private hub: TabSyncHub;
  private tabId: string;
  private isLeader = false;
  private currentLeaderId: string | null = null;
  private lastHeartbeat = 0;
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private unsubs: (() => void)[] = [];
  private onLeaderChangeCallbacks = new Set<LeaderChangeCallback>();
  private isRunning = false;
  private unloadHandler: (() => void) | null = null;

  constructor(hub: TabSyncHub = tabSyncHub, tabId?: string) {
    this.hub = hub;
    this.tabId = tabId || hub.getTabId();
  }

  /**
   * Démarre la détection et l'élection de leader.
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // Écoute des heartbeats émis par le leader en titre
    this.unsubs.push(
      this.hub.subscribe<LeaderHeartbeatPayload>("leader:heartbeat", (payload) => {
        if (payload.leaderTabId !== this.tabId) {
          this.lastHeartbeat = Date.now();
          this.currentLeaderId = payload.leaderTabId;
          if (this.isLeader) {
            // Conflit : si un autre onglet envoie aussi un heartbeat, départage par ordre lexicographique
            if (payload.leaderTabId < this.tabId) {
              this.setLeadership(false);
            }
          }
        }
      }),
    );

    // Écoute de la démission immédiate du leader lors de la fermeture de son onglet
    this.unsubs.push(
      this.hub.subscribe<LeaderResignedPayload>("leader:resigned", (payload) => {
        if (payload.resigningTabId === this.currentLeaderId) {
          this.currentLeaderId = null;
          this.lastHeartbeat = 0;
          // Revendication rapide avec un léger jitter aléatoire pour éviter collision simultanée
          const jitter = Math.floor(Math.random() * 200);
          setTimeout(() => {
            if (this.isRunning && !this.currentLeaderId && !this.isLeader) {
              this.claimLeadership();
            }
          }, jitter);
        }
      }),
    );

    // Écoute des candidatures
    this.unsubs.push(
      this.hub.subscribe<LeaderClaimPayload>("leader:claim", (payload) => {
        if (payload.candidateTabId !== this.tabId) {
          if (this.isLeader) {
            // Nous sommes déjà le leader établi : nous réaffirmons notre statut
            this.broadcastHeartbeat();
          } else if (!this.currentLeaderId || Date.now() - this.lastHeartbeat > LEADER_TIMEOUT_MS) {
            this.currentLeaderId = payload.candidateTabId;
            this.lastHeartbeat = Date.now();
          }
        }
      }),
    );

    // Enregistrement de la démission propre avant fermeture de l'onglet
    if (typeof window !== "undefined") {
      this.unloadHandler = () => {
        if (this.isLeader) {
          this.hub.broadcast<LeaderResignedPayload>("leader:resigned", {
            resigningTabId: this.tabId,
          });
        }
      };
      window.addEventListener("beforeunload", this.unloadHandler);
      window.addEventListener("pagehide", this.unloadHandler);
    }

    // Période initiale d'écoute avant de revendiquer le leadership
    const startupJitter = 200 + Math.floor(Math.random() * 300);
    setTimeout(() => {
      if (this.isRunning && !this.currentLeaderId && Date.now() - this.lastHeartbeat > startupJitter) {
        this.claimLeadership();
      }
    }, startupJitter);

    // Boucle de surveillance régulière (toutes les secondes)
    this.checkInterval = setInterval(() => {
      this.tick();
    }, 1000);
  }

  /**
   * Arrête la surveillance et démissionne si nous étions leader.
   */
  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    if (this.unloadHandler && typeof window !== "undefined") {
      window.removeEventListener("beforeunload", this.unloadHandler);
      window.removeEventListener("pagehide", this.unloadHandler);
      this.unloadHandler = null;
    }

    for (const unsub of this.unsubs) {
      unsub();
    }
    this.unsubs = [];

    if (this.isLeader) {
      this.hub.broadcast<LeaderResignedPayload>("leader:resigned", {
        resigningTabId: this.tabId,
      });
      this.setLeadership(false);
    }
  }

  /**
   * Souscrit aux changements d'état du leadership (isLeader = true / false).
   */
  onLeaderChange(cb: LeaderChangeCallback): () => void {
    this.onLeaderChangeCallbacks.add(cb);
    cb(this.isLeader);
    return () => {
      this.onLeaderChangeCallbacks.delete(cb);
    };
  }

  /**
   * Indique si l'onglet courant est actuellement le leader.
   */
  getIsLeader(): boolean {
    return this.isLeader;
  }

  /**
   * Identifiant de l'onglet leader actuel (ou null).
   */
  getCurrentLeaderId(): string | null {
    return this.currentLeaderId;
  }

  private tick(): void {
    const now = Date.now();

    if (this.isLeader) {
      // Émettre un heartbeat périodique
      this.broadcastHeartbeat();
    } else {
      // Vérifier si le leader actuel est présumé inactif / mort
      const timeSinceLast = now - this.lastHeartbeat;
      if (timeSinceLast > LEADER_TIMEOUT_MS) {
        this.claimLeadership();
      }
    }
  }

  private claimLeadership(): void {
    this.hub.broadcast<LeaderClaimPayload>("leader:claim", {
      candidateTabId: this.tabId,
    });
    this.setLeadership(true);
    this.currentLeaderId = this.tabId;
    this.lastHeartbeat = Date.now();
    this.broadcastHeartbeat();
  }

  private broadcastHeartbeat(): void {
    this.hub.broadcast<LeaderHeartbeatPayload>("leader:heartbeat", {
      leaderTabId: this.tabId,
      timestamp: Date.now(),
    });
  }

  private setLeadership(value: boolean): void {
    if (this.isLeader !== value) {
      this.isLeader = value;
      for (const cb of this.onLeaderChangeCallbacks) {
        try {
          cb(value);
        } catch (err) {
          console.error("[LeaderElection] Erreur dans onLeaderChange callback:", err);
        }
      }
    }
  }
}

/**
 * Instance unique globale pour l'onglet courant.
 */
export const leaderElection = new LeaderElection();
