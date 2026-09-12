import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNetworkStatus } from "./useNetworkStatus";
import { offlineDb } from "./db";
import { tabSyncHub } from "@/lib/sync/tabSyncHub";

const mockInvalidateQueries = vi.fn().mockResolvedValue(undefined);

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

describe("useNetworkStatus", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await offlineDb.clearPendingMutations();
  });

  it("détecte le statut réseau initial", () => {
    const { result } = renderHook(() => useNetworkStatus());
    expect(typeof result.current.isOnline).toBe("boolean");
    expect(result.current.pendingCount).toBe(0);
    expect(result.current.isSyncing).toBe(false);
  });

  it("réagit à l'événement window offline", async () => {
    const { result } = renderHook(() => useNetworkStatus());

    await act(async () => {
      window.dispatchEvent(new Event("offline"));
    });

    expect(result.current.isOnline).toBe(false);
  });

  it("réagit à l'événement window online et déclenche la synchronisation", async () => {
    await offlineDb.addPendingMutation({
      type: "UPDATE_FLAGS",
      accountId: "acc1",
      folder: "INBOX",
      uid: 10,
    });

    const { result } = renderHook(() => useNetworkStatus());

    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });

    expect(result.current.isOnline).toBe(true);
  });

  it("met à jour pendingCount lors de la réception de offline:mutation_added", async () => {
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.pendingCount).toBe(0);

    await offlineDb.addPendingMutation({
      type: "UPDATE_FLAGS",
      accountId: "acc1",
      folder: "INBOX",
      uid: 10,
    });

    await act(async () => {
      tabSyncHub.dispatchEnvelope({
        type: "offline:mutation_added",
        senderTabId: "other-tab",
        timestamp: Date.now(),
        payload: {
          mutation: {
            id: 1,
            type: "UPDATE_FLAGS",
            accountId: "acc1",
            folder: "INBOX",
            uid: 10,
            createdAt: Date.now(),
          },
        },
      });
    });

    expect(result.current.pendingCount).toBe(1);
  });

  it("met à jour pendingCount et invalide les caches lors de offline:sync_completed", async () => {
    renderHook(() => useNetworkStatus());

    await act(async () => {
      tabSyncHub.dispatchEnvelope({
        type: "offline:sync_completed",
        senderTabId: "other-tab",
        timestamp: Date.now(),
        payload: { appliedCount: 3 },
      });
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["messages"] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["folders"] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["unified"] });
  });
});
