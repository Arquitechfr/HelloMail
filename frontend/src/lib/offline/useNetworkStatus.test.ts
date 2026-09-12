import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNetworkStatus } from "./useNetworkStatus";
import { offlineDb } from "./db";

const mockInvalidateQueries = vi.fn();

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
});
