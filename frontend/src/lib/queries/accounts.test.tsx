import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSyncAccount } from "./accounts";

const mockApiFetch = vi.fn();
vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

describe("useSyncAccount", () => {
  let queryClient: QueryClient;

  const createWrapper = () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("appelle l'endpoint de synchronisation manuelle avec le dossier spécifié", async () => {
    mockApiFetch.mockResolvedValue({
      success: true,
      syncedCount: 3,
      deletedCount: 0,
      folder: "INBOX",
      syncedAt: new Date().toISOString(),
    });

    const { result } = renderHook(() => useSyncAccount(), {
      wrapper: createWrapper(),
    });

    let syncResult;
    await act(async () => {
      syncResult = await result.current.mutateAsync({
        accountId: "acc-123",
        folder: "INBOX",
      });
    });

    expect(mockApiFetch).toHaveBeenCalledWith("/api/accounts/acc-123/sync?folder=INBOX", {
      method: "POST",
    });
    expect(syncResult).toEqual(
      expect.objectContaining({
        success: true,
        syncedCount: 3,
        folder: "INBOX",
      }),
    );
  });

  it("appelle l'endpoint sans paramètre folder si non fourni", async () => {
    mockApiFetch.mockResolvedValue({
      success: true,
      syncedCount: 0,
      deletedCount: 0,
      folder: "ALL",
      syncedAt: new Date().toISOString(),
    });

    const { result } = renderHook(() => useSyncAccount(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        accountId: "acc-456",
      });
    });

    expect(mockApiFetch).toHaveBeenCalledWith("/api/accounts/acc-456/sync", {
      method: "POST",
    });
  });
});
