import { describe, it, expect } from "vitest";
import {
  filterMessages,
  computeFilterCounts,
  getNextQuickFilter,
  getQuickFilterByIndex,
} from "./quick-filters";
import type { Message } from "./api-types";

describe("quick-filters", () => {
  const mockMessages: Message[] = [
    {
      _id: "1",
      uid: 1,
      messageId: "msg-1",
      accountId: "acc-1",
      folder: "INBOX",
      subject: "Test 1",
      from: { address: "alice@example.com" },
      to: [{ address: "me@example.com" }],
      date: new Date().toISOString(),
      flags: { seen: true, answered: false, flagged: false },
      size: 1024,
      isPinned: true,
      hasAttachments: false,
    },
    {
      _id: "2",
      uid: 2,
      messageId: "msg-2",
      accountId: "acc-1",
      folder: "INBOX",
      subject: "Test 2 (Unread + Starred)",
      from: { address: "bob@example.com" },
      to: [{ address: "me@example.com" }],
      date: new Date().toISOString(),
      flags: { seen: false, answered: false, flagged: true },
      size: 2048,
      isPinned: false,
      hasAttachments: true,
    },
    {
      _id: "3",
      uid: 3,
      messageId: "msg-3",
      accountId: "acc-1",
      folder: "INBOX",
      subject: "Test 3 (Unread only)",
      from: { address: "charlie@example.com" },
      to: [{ address: "me@example.com" }],
      date: new Date().toISOString(),
      flags: { seen: false, answered: false, flagged: false },
      size: 512,
      isPinned: false,
      hasAttachments: false,
    },
  ];

  describe("filterMessages", () => {
    it("retourne tous les messages avec le filtre 'all'", () => {
      expect(filterMessages(mockMessages, "all")).toHaveLength(3);
    });

    it("filtre les messages non lus avec 'unread'", () => {
      const filtered = filterMessages(mockMessages, "unread");
      expect(filtered).toHaveLength(2);
      expect(filtered.map((m) => m.uid)).toEqual([2, 3]);
    });

    it("filtre les messages importants / étoilés avec 'starred'", () => {
      const filtered = filterMessages(mockMessages, "starred");
      expect(filtered).toHaveLength(1);
      expect(filtered[0].uid).toBe(2);
    });

    it("filtre les messages épinglés avec 'pinned'", () => {
      const filtered = filterMessages(mockMessages, "pinned");
      expect(filtered).toHaveLength(1);
      expect(filtered[0].uid).toBe(1);
    });

    it("filtre les messages avec pièces jointes avec 'attachments'", () => {
      const filtered = filterMessages(mockMessages, "attachments");
      expect(filtered).toHaveLength(1);
      expect(filtered[0].uid).toBe(2);
    });
  });

  describe("computeFilterCounts", () => {
    it("calcule les totaux exacts pour chaque type de filtre", () => {
      const counts = computeFilterCounts(mockMessages);
      expect(counts).toEqual({
        all: 3,
        unread: 2,
        starred: 1,
        pinned: 1,
        attachments: 1,
      });
    });

    it("gère une liste vide de messages sans erreur", () => {
      const counts = computeFilterCounts([]);
      expect(counts).toEqual({
        all: 0,
        unread: 0,
        starred: 0,
        pinned: 0,
        attachments: 0,
      });
    });
  });

  describe("getNextQuickFilter", () => {
    it("cycle à travers les 5 filtres dans l'ordre circulaire", () => {
      expect(getNextQuickFilter("all")).toBe("unread");
      expect(getNextQuickFilter("unread")).toBe("starred");
      expect(getNextQuickFilter("starred")).toBe("pinned");
      expect(getNextQuickFilter("pinned")).toBe("attachments");
      expect(getNextQuickFilter("attachments")).toBe("all");
    });
  });

  describe("getQuickFilterByIndex", () => {
    it("retourne le filtre correspondant aux index 1 à 5", () => {
      expect(getQuickFilterByIndex(1)).toBe("all");
      expect(getQuickFilterByIndex(2)).toBe("unread");
      expect(getQuickFilterByIndex(3)).toBe("starred");
      expect(getQuickFilterByIndex(4)).toBe("pinned");
      expect(getQuickFilterByIndex(5)).toBe("attachments");
    });

    it("retourne null pour des index hors bornes", () => {
      expect(getQuickFilterByIndex(0)).toBeNull();
      expect(getQuickFilterByIndex(6)).toBeNull();
      expect(getQuickFilterByIndex(-1)).toBeNull();
    });
  });
});
