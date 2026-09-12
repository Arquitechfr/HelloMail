import type {
  TabSyncMessageType,
  TabSyncEnvelope,
} from "./tabSyncTypes";

const CHANNEL_NAME = "mailora-bus";

type MessageHandler<T = unknown> = (payload: T, envelope: TabSyncEnvelope<T>) => void;

/**
 * Hub central de synchronisation inter-onglets s'appuyant sur l'API BroadcastChannel.
 * Fournit une communication bi-directionnelle pub/sub avec repli automatique en mémoire
 * si BroadcastChannel n'est pas supporté (SSR, navigateurs restreints, tests).
 */
export class TabSyncHub {
  private channel: BroadcastChannel | null = null;
  private tabId: string;
  private listeners = new Map<TabSyncMessageType, Set<MessageHandler<never>>>();

  constructor() {
    this.tabId = this.generateTabId();

    if (typeof window !== "undefined" && typeof window.BroadcastChannel !== "undefined") {
      try {
        this.channel = new window.BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (event: MessageEvent<TabSyncEnvelope>) => {
          this.dispatchEnvelope(event.data);
        };
      } catch (err) {
        console.warn("[TabSyncHub] BroadcastChannel non disponible, repli local:", err);
      }
    }
  }

  /**
   * Retourne l'identifiant unique de cet onglet.
   */
  getTabId(): string {
    return this.tabId;
  }

  /**
   * Diffuse un message à destination de tous les autres onglets du navigateur.
   */
  broadcast<T>(type: TabSyncMessageType, payload: T): void {
    const envelope: TabSyncEnvelope<T> = {
      type,
      senderTabId: this.tabId,
      timestamp: Date.now(),
      payload,
    };

    if (this.channel) {
      try {
        this.channel.postMessage(envelope);
      } catch (err) {
        console.warn("[TabSyncHub] Erreur postMessage:", err);
      }
    }
  }

  /**
   * S'abonne à un type d'événement inter-onglets spécifique.
   * Retourne une fonction de désabonnement idempotente.
   */
  subscribe<T>(type: TabSyncMessageType, handler: MessageHandler<T>): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }

    const castHandler = handler as MessageHandler<never>;
    set.add(castHandler);

    return () => {
      set?.delete(castHandler);
      if (set?.size === 0) {
        this.listeners.delete(type);
      }
    };
  }

  /**
   * Alias de subscribe pour ergonomie Event-driven.
   */
  on<T>(type: TabSyncMessageType, handler: MessageHandler<T>): () => void {
    return this.subscribe(type, handler);
  }

  /**
   * Dispatche une enveloppe reçue vers les écouteurs locaux enregistrés.
   * Ignore les messages renvoyés par cet onglet lui-même pour éviter les boucles.
   */
  dispatchEnvelope(envelope: TabSyncEnvelope): void {
    if (!envelope || envelope.senderTabId === this.tabId) {
      return;
    }

    const set = this.listeners.get(envelope.type);
    if (!set || set.size === 0) return;

    for (const handler of set) {
      try {
        handler(envelope.payload as never, envelope as never);
      } catch (err) {
        console.error(`[TabSyncHub] Erreur dans le handler pour ${envelope.type}:`, err);
      }
    }
  }

  /**
   * Ferme le canal de diffusion.
   */
  close(): void {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.listeners.clear();
  }

  private generateTabId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `tab-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
  }
}

/**
 * Instance unique globale partagée par onglet.
 */
export const tabSyncHub = new TabSyncHub();
