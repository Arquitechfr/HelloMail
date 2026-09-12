import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchMessagesWithOfflineFallback,
  fetchDetailWithOfflineFallback,
  executeOrQueueOffline,
} from "./offlineSyncHelpers";
import { offlineDb } from "./db";
import * as queueModule from "./offlineQueueService";
import * as apiModule from "@/lib/api";
import type { Message, MessageDetail, PaginatedResponse } from "@/lib/api-types";

describe("offlineSyncHelpers", () => {
  const originalNavigator = global.navigator;

  const mockMessage: Message = {
    _id: "msg-id-1",
    accountId: "acc1",
    folder: "INBOX",
    uid: 101,
    messageId: "msg-101",
    subject: "Test Offline",
    from: { name: "Alice", address: "alice@example.com" },
    to: [{ name: "Bob", address: "bob@example.com" }],
    date: "2026-09-12T10:00:00.000Z",
    flags: { seen: true, answered: false, flagged: false },
    hasAttachments: false,
    size: 1024,
  };

  const mockDetail: MessageDetail = {
    subject: "Test Offline",
    from: { name: "Alice", address: "alice@example.com" },
    to: [{ name: "Bob", address: "bob@example.com" }],
    date: "2026-09-12T10:00:00.000Z",
    flags: { seen: true, answered: false, flagged: false },
    size: 1024,
    headers: {},
    text: "Hello offline world",
    html: "<p>Hello offline world</p>",
    attachments: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(global, "navigator", {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  describe("fetchMessagesWithOfflineFallback", () => {
    it("renvoie les messages depuis le cache IndexedDB quand le navigateur est hors-ligne", async () => {
      Object.defineProperty(global, "navigator", {
        value: { onLine: false },
        configurable: true,
        writable: true,
      });

      const getMessagesSpy = vi
        .spyOn(offlineDb, "getMessages")
        .mockResolvedValue([mockMessage]);

      const result = await fetchMessagesWithOfflineFallback(
        "acc1",
        "INBOX",
        "/api/accounts/acc1/messages?folder=INBOX",
      );

      expect(getMessagesSpy).toHaveBeenCalledWith("acc1", "INBOX");
      expect(result.data).toHaveLength(1);
      expect(result.data[0].uid).toBe(101);
      expect(result.total).toBe(1);
    });

    it("appelle l'API et met en cache quand le navigateur est en ligne", async () => {
      Object.defineProperty(global, "navigator", {
        value: { onLine: true },
        configurable: true,
        writable: true,
      });

      const apiResponse: PaginatedResponse<Message> = {
        data: [mockMessage],
        page: 1,
        limit: 50,
        total: 1,
      };

      vi.spyOn(apiModule, "apiFetch").mockResolvedValue(apiResponse);
      const saveMessagesSpy = vi
        .spyOn(offlineDb, "saveMessages")
        .mockResolvedValue();

      const result = await fetchMessagesWithOfflineFallback(
        "acc1",
        "INBOX",
        "/api/accounts/acc1/messages?folder=INBOX",
      );

      expect(result.data[0].uid).toBe(101);
      expect(saveMessagesSpy).toHaveBeenCalledWith("acc1", "INBOX", [mockMessage]);
    });

    it("se replie sur le cache en cas d'erreur réseau pendant le fetch en ligne", async () => {
      Object.defineProperty(global, "navigator", {
        value: { onLine: true },
        configurable: true,
        writable: true,
      });

      vi.spyOn(apiModule, "apiFetch").mockRejectedValue(new TypeError("Failed to fetch"));
      vi.spyOn(offlineDb, "getMessages").mockResolvedValue([mockMessage]);

      const result = await fetchMessagesWithOfflineFallback(
        "acc1",
        "INBOX",
        "/api/accounts/acc1/messages?folder=INBOX",
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].uid).toBe(101);
    });
  });

  describe("fetchDetailWithOfflineFallback", () => {
    it("renvoie le détail en cache quand hors-ligne", async () => {
      Object.defineProperty(global, "navigator", {
        value: { onLine: false },
        configurable: true,
        writable: true,
      });

      vi.spyOn(offlineDb, "getMessageDetail").mockResolvedValue(mockDetail);

      const onlineFetch = vi.fn();
      const result = await fetchDetailWithOfflineFallback(
        "acc1",
        "INBOX",
        101,
        onlineFetch,
      );

      expect(onlineFetch).not.toHaveBeenCalled();
      expect(result.text).toBe("Hello offline world");
    });

    it("lève une erreur si le détail n'est pas disponible hors-ligne", async () => {
      Object.defineProperty(global, "navigator", {
        value: { onLine: false },
        configurable: true,
        writable: true,
      });

      vi.spyOn(offlineDb, "getMessageDetail").mockResolvedValue(null);

      await expect(
        fetchDetailWithOfflineFallback("acc1", "INBOX", 999, vi.fn()),
      ).rejects.toThrow("Message non disponible hors-ligne");
    });

    it("appelle onlineFetch et sauvegarde dans le cache quand en ligne", async () => {
      Object.defineProperty(global, "navigator", {
        value: { onLine: true },
        configurable: true,
        writable: true,
      });

      const saveDetailSpy = vi
        .spyOn(offlineDb, "saveMessageDetail")
        .mockResolvedValue();

      const onlineFetch = vi.fn().mockResolvedValue(mockDetail);
      const result = await fetchDetailWithOfflineFallback(
        "acc1",
        "INBOX",
        101,
        onlineFetch,
      );

      expect(result.text).toBe("Hello offline world");
      expect(saveDetailSpy).toHaveBeenCalledWith("acc1", "INBOX", 101, mockDetail);
    });
  });

  describe("executeOrQueueOffline", () => {
    it("met en file d'attente immédiatement si le client est hors-ligne", async () => {
      Object.defineProperty(global, "navigator", {
        value: { onLine: false },
        configurable: true,
        writable: true,
      });

      const queueSpy = vi
        .spyOn(queueModule, "queueOfflineMutation")
        .mockResolvedValue({} as never);

      const onlineCall = vi.fn();

      await executeOrQueueOffline(
        "UPDATE_FLAGS",
        "acc1",
        "INBOX",
        101,
        { flags: { seen: true } },
        onlineCall,
      );

      expect(onlineCall).not.toHaveBeenCalled();
      expect(queueSpy).toHaveBeenCalledWith(
        "UPDATE_FLAGS",
        "acc1",
        "INBOX",
        101,
        { flags: { seen: true } },
      );
    });

    it("exécute l'appel en ligne directement si connecté", async () => {
      Object.defineProperty(global, "navigator", {
        value: { onLine: true },
        configurable: true,
        writable: true,
      });

      const queueSpy = vi.spyOn(queueModule, "queueOfflineMutation");
      const onlineCall = vi.fn().mockResolvedValue({ success: true });

      const res = await executeOrQueueOffline(
        "MARK_JUNK",
        "acc1",
        "INBOX",
        101,
        undefined,
        onlineCall,
      );

      expect(onlineCall).toHaveBeenCalled();
      expect(queueSpy).not.toHaveBeenCalled();
      expect(res).toEqual({ success: true });
    });

    it("bascule en file d'attente automatique en cas d'erreur TypeError (coupure réseau)", async () => {
      Object.defineProperty(global, "navigator", {
        value: { onLine: true },
        configurable: true,
        writable: true,
      });

      const queueSpy = vi
        .spyOn(queueModule, "queueOfflineMutation")
        .mockResolvedValue({} as never);

      const onlineCall = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

      await executeOrQueueOffline(
        "DELETE_MESSAGE",
        "acc1",
        "INBOX",
        101,
        { permanent: false },
        onlineCall,
      );

      expect(queueSpy).toHaveBeenCalledWith(
        "DELETE_MESSAGE",
        "acc1",
        "INBOX",
        101,
        { permanent: false },
      );
    });
  });
});
