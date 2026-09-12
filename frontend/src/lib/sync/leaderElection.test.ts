import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LeaderElection, LEADER_TIMEOUT_MS } from "./leaderElection";
import { TabSyncHub } from "./tabSyncHub";
import type { TabSyncEnvelope } from "./tabSyncTypes";

describe("LeaderElection", () => {
  const channels = new Set<MockBroadcastChannel>();

  class MockBroadcastChannel {
    name: string;
    onmessage: ((e: MessageEvent<TabSyncEnvelope>) => void) | null = null;
    constructor(name: string) {
      this.name = name;
      channels.add(this);
    }
    postMessage(data: TabSyncEnvelope) {
      for (const ch of channels) {
        if (ch !== this && ch.onmessage) {
          ch.onmessage({ data } as MessageEvent<TabSyncEnvelope>);
        }
      }
    }
    close() {
      channels.delete(this);
    }
  }

  beforeEach(() => {
    channels.clear();
    vi.stubGlobal("BroadcastChannel", MockBroadcastChannel);
    vi.useFakeTimers();
  });

  afterEach(() => {
    channels.clear();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("s'élit leader après le délai initial si aucun autre leader n'est présent", () => {
    const hub = new TabSyncHub();
    const election = new LeaderElection(hub, "tab-1");
    const leaderSpy = vi.fn();
    election.onLeaderChange(leaderSpy);

    election.start();

    // Initialement false
    expect(leaderSpy).toHaveBeenCalledWith(false);

    // Avancer le temps pour passer le startup jitter (max 500ms)
    vi.advanceTimersByTime(600);

    expect(election.getIsLeader()).toBe(true);
    expect(leaderSpy).toHaveBeenCalledWith(true);

    election.stop();
  });

  it("reste suiveur (isLeader = false) s'il reçoit un heartbeat d'un autre leader", () => {
    const hubLeader = new TabSyncHub();
    const hubFollower = new TabSyncHub();

    const election = new LeaderElection(hubFollower, "tab-follower");
    const leaderSpy = vi.fn();
    election.onLeaderChange(leaderSpy);

    election.start();

    // L'autre onglet émet son heartbeat
    hubLeader.broadcast("leader:heartbeat", {
      leaderTabId: "tab-master",
      timestamp: Date.now(),
    });

    // Avancer le temps
    vi.advanceTimersByTime(2000);

    expect(election.getIsLeader()).toBe(false);
    expect(election.getCurrentLeaderId()).toBe("tab-master");

    election.stop();
  });

  it("revendique le leadership si le leader actuel cesse d'émettre des heartbeats (timeout)", () => {
    const hubLeader = new TabSyncHub();
    const hubCandidate = new TabSyncHub();

    const election = new LeaderElection(hubCandidate, "tab-2");
    election.start();

    // Reçoit un premier heartbeat du leader
    hubLeader.broadcast("leader:heartbeat", {
      leaderTabId: "tab-leader-mort",
      timestamp: Date.now(),
    });

    expect(election.getIsLeader()).toBe(false);

    // Avancer le temps au-delà de LEADER_TIMEOUT_MS
    vi.advanceTimersByTime(LEADER_TIMEOUT_MS + 2000);

    // L'onglet doit avoir pris le relais
    expect(election.getIsLeader()).toBe(true);

    election.stop();
  });

  it("prend le relais immédiatement si le leader envoie leader:resigned", () => {
    const hubLeader = new TabSyncHub();
    const hubCandidate = new TabSyncHub();

    const election = new LeaderElection(hubCandidate, "tab-3");
    election.start();

    // Reçoit un heartbeat
    hubLeader.broadcast("leader:heartbeat", {
      leaderTabId: "tab-leader-sortant",
      timestamp: Date.now(),
    });

    expect(election.getCurrentLeaderId()).toBe("tab-leader-sortant");

    // Le leader démissionne
    hubLeader.broadcast("leader:resigned", {
      resigningTabId: "tab-leader-sortant",
    });

    // Avancer légèrement pour le jitter de démission (max 200ms)
    vi.advanceTimersByTime(300);

    expect(election.getIsLeader()).toBe(true);

    election.stop();
  });

  it("émet leader:resigned lorsqu'un leader actif appelle stop()", () => {
    const hub = new TabSyncHub();
    const election = new LeaderElection(hub, "tab-4");
    const broadcastSpy = vi.spyOn(hub, "broadcast");

    election.start();
    vi.advanceTimersByTime(600);
    expect(election.getIsLeader()).toBe(true);

    election.stop();

    expect(broadcastSpy).toHaveBeenCalledWith("leader:resigned", {
      resigningTabId: "tab-4",
    });
    expect(election.getIsLeader()).toBe(false);
  });
});
