import { describe, it, expect, vi, beforeEach } from "vitest";
import { queueOfflineMutation, replayPendingMutations } from "./offlineQueueService";
import { offlineDb } from "./db";

describe("offlineQueueService", () => {
  beforeEach(async () => {
    await offlineDb.clearPendingMutations();
  });

  it("enregistre une mutation hors-ligne avec son payload", async () => {
    const id = await queueOfflineMutation(
      "UPDATE_FLAGS",
      "acc1",
      "INBOX",
      42,
      { flags: { seen: true } },
    );

    expect(id).toBeGreaterThan(0);
    const pending = await offlineDb.getPendingMutations();
    expect(pending).toHaveLength(1);
    expect(pending[0].type).toBe("UPDATE_FLAGS");
    expect(pending[0].uid).toBe(42);
  });

  it("rejoue avec succès les mutations en attente et les supprime de la file", async () => {
    await queueOfflineMutation("UPDATE_FLAGS", "acc1", "INBOX", 1, { flags: { seen: true } });
    await queueOfflineMutation("PIN_MESSAGE", "acc1", "INBOX", 2, { isPinned: true });
    await queueOfflineMutation("DELETE_MESSAGE", "acc1", "INBOX", 3);

    const mockCaller = vi.fn().mockResolvedValue({ ok: true });

    const result = await replayPendingMutations(mockCaller);

    expect(result.total).toBe(3);
    expect(result.applied).toBe(3);
    expect(result.failed).toBe(0);

    expect(mockCaller).toHaveBeenCalledTimes(3);
    expect(mockCaller).toHaveBeenNthCalledWith(
      1,
      "/api/accounts/acc1/messages/INBOX/1/flags",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(mockCaller).toHaveBeenNthCalledWith(
      2,
      "/api/accounts/acc1/messages/INBOX/2/pin",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(mockCaller).toHaveBeenNthCalledWith(
      3,
      "/api/accounts/acc1/messages/INBOX/3",
      expect.objectContaining({ method: "DELETE" }),
    );

    const remaining = await offlineDb.getPendingMutations();
    expect(remaining).toHaveLength(0);
  });

  it("supprime une mutation qui renvoie une erreur 404 pour ne pas bloquer la file", async () => {
    await queueOfflineMutation("DELETE_MESSAGE", "acc1", "INBOX", 999);
    await queueOfflineMutation("PIN_MESSAGE", "acc1", "INBOX", 2, { isPinned: true });

    const mockCaller = vi.fn()
      .mockRejectedValueOnce({ status: 404, message: "Non trouvé" })
      .mockResolvedValueOnce({ ok: true });

    const result = await replayPendingMutations(mockCaller);

    expect(result.applied).toBe(1);
    expect(result.failed).toBe(1);

    const remaining = await offlineDb.getPendingMutations();
    expect(remaining).toHaveLength(0);
  });

  it("s'interrompt en cas d'erreur réseau pour préserver l'ordre", async () => {
    await queueOfflineMutation("UPDATE_FLAGS", "acc1", "INBOX", 1, { flags: { seen: true } });
    await queueOfflineMutation("UPDATE_FLAGS", "acc1", "INBOX", 2, { flags: { seen: true } });

    const mockCaller = vi.fn().mockRejectedValueOnce(new Error("Failed to fetch"));

    const result = await replayPendingMutations(mockCaller);

    expect(result.applied).toBe(0);
    expect(result.failed).toBe(1);

    // Les mutations restent dans la file
    const remaining = await offlineDb.getPendingMutations();
    expect(remaining).toHaveLength(2);
  });

  it("diffuse les événements offline:mutation_added et offline:sync_completed via tabSyncHub", async () => {
    const { tabSyncHub } = await import("@/lib/sync/tabSyncHub");
    const broadcastSpy = vi.spyOn(tabSyncHub, "broadcast");

    const id = await queueOfflineMutation("PIN_MESSAGE", "acc1", "INBOX", 42, { isPinned: true });
    expect(broadcastSpy).toHaveBeenCalledWith(
      "offline:mutation_added",
      expect.objectContaining({
        mutation: expect.objectContaining({ id, uid: 42, type: "PIN_MESSAGE" }),
      }),
    );

    const mockCaller = vi.fn().mockResolvedValue({ ok: true });
    await replayPendingMutations(mockCaller);

    expect(broadcastSpy).toHaveBeenCalledWith(
      "offline:sync_completed",
      { appliedCount: 1 },
    );

    broadcastSpy.mockRestore();
  });
});
