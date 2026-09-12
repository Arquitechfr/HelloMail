import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TabSyncHub } from "./tabSyncHub";
import type { TabSyncEnvelope } from "./tabSyncTypes";

describe("TabSyncHub", () => {
  let mockPostMessage: ReturnType<typeof vi.fn>;
  let mockClose: ReturnType<typeof vi.fn>;
  let messageCallback: ((e: MessageEvent<TabSyncEnvelope>) => void) | null = null;

  beforeEach(() => {
    mockPostMessage = vi.fn();
    mockClose = vi.fn();
    messageCallback = null;

    class MockBroadcastChannel {
      name: string;
      constructor(name: string) {
        this.name = name;
      }
      postMessage = mockPostMessage;
      close = mockClose;
      set onmessage(cb: (e: MessageEvent<TabSyncEnvelope>) => void) {
        messageCallback = cb;
      }
    }

    vi.stubGlobal("BroadcastChannel", MockBroadcastChannel);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("génère un identifiant d'onglet unique non vide", () => {
    const hub = new TabSyncHub();
    expect(hub.getTabId()).toBeTruthy();
    expect(typeof hub.getTabId()).toBe("string");
  });

  it("diffuse un message vers le BroadcastChannel avec senderTabId et timestamp", () => {
    const hub = new TabSyncHub();
    hub.broadcast("offline:sync_completed", { appliedCount: 3 });

    expect(mockPostMessage).toHaveBeenCalledTimes(1);
    const envelope = mockPostMessage.mock.calls[0][0] as TabSyncEnvelope;
    expect(envelope.type).toBe("offline:sync_completed");
    expect(envelope.senderTabId).toBe(hub.getTabId());
    expect(envelope.payload).toEqual({ appliedCount: 3 });
    expect(typeof envelope.timestamp).toBe("number");
  });

  it("notifie les écouteurs abonnés lors de la réception d'un message d'un autre onglet", () => {
    const hub = new TabSyncHub();
    const handler = vi.fn();
    hub.subscribe("offline:sync_completed", handler);

    expect(messageCallback).toBeTypeOf("function");

    // Simuler un message arrivant d'un autre onglet
    const incomingEnvelope: TabSyncEnvelope = {
      type: "offline:sync_completed",
      senderTabId: "other-tab-id",
      timestamp: Date.now(),
      payload: { appliedCount: 5 },
    };

    messageCallback!({ data: incomingEnvelope } as MessageEvent<TabSyncEnvelope>);

    expect(handler).toHaveBeenCalledWith({ appliedCount: 5 }, incomingEnvelope);
  });

  it("ignore les messages émis par soi-même (anti-loop)", () => {
    const hub = new TabSyncHub();
    const handler = vi.fn();
    hub.subscribe("offline:sync_completed", handler);

    // Message avec le même senderTabId
    const selfEnvelope: TabSyncEnvelope = {
      type: "offline:sync_completed",
      senderTabId: hub.getTabId(),
      timestamp: Date.now(),
      payload: { appliedCount: 1 },
    };

    messageCallback!({ data: selfEnvelope } as MessageEvent<TabSyncEnvelope>);

    expect(handler).not.toHaveBeenCalled();
  });

  it("permet de se désabonner proprement via la fonction retournée", () => {
    const hub = new TabSyncHub();
    const handler = vi.fn();
    const unsubscribe = hub.subscribe("auth:logout", handler);

    unsubscribe();

    const incoming: TabSyncEnvelope = {
      type: "auth:logout",
      senderTabId: "other-tab",
      timestamp: Date.now(),
      payload: {},
    };

    messageCallback!({ data: incoming } as MessageEvent<TabSyncEnvelope>);

    expect(handler).not.toHaveBeenCalled();
  });
});
