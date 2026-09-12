import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryOfflineDb } from "./db";
import type { Message, MessageDetail } from "@/lib/api-types";

describe("InMemoryOfflineDb", () => {
  let db: InMemoryOfflineDb;

  const mockMsg1: Message = {
    _id: "m1",
    accountId: "acc1",
    folder: "INBOX",
    uid: 101,
    subject: "Premier message",
    from: { address: "alice@test.com", name: "Alice" },
    to: [{ address: "bob@test.com" }],
    date: "2026-03-01T10:00:00Z",
    flags: { seen: false, flagged: false, answered: false },
    hasAttachments: false,
    size: 1024,
    isPinned: false,
  };

  const mockMsg2: Message = {
    _id: "m2",
    accountId: "acc1",
    folder: "INBOX",
    uid: 102,
    subject: "Deuxième message épinglé",
    from: { address: "bob@test.com", name: "Bob" },
    to: [{ address: "alice@test.com" }],
    date: "2026-03-02T10:00:00Z",
    flags: { seen: true, flagged: true, answered: false },
    hasAttachments: true,
    size: 2048,
    isPinned: true,
  };

  beforeEach(() => {
    db = new InMemoryOfflineDb();
  });

  it("sauvegarde et récupère les messages en respectant le tri (épinglés en premier)", async () => {
    await db.saveMessages("acc1", "INBOX", [mockMsg1, mockMsg2]);
    const messages = await db.getMessages("acc1", "INBOX");

    expect(messages).toHaveLength(2);
    // Le message épinglé doit être en tête de liste
    expect(messages[0].uid).toBe(102);
    expect(messages[1].uid).toBe(101);
  });

  it("sauvegarde et récupère le détail d'un message", async () => {
    const detail: MessageDetail = {
      ...mockMsg1,
      headers: {},
      text: "Corps du message en texte",
      html: "<p>Corps du message en HTML</p>",
      attachments: [],
    };

    await db.saveMessageDetail("acc1", "INBOX", 101, detail);
    const retrieved = await db.getMessageDetail("acc1", "INBOX", 101);

    expect(retrieved).not.toBeNull();
    expect(retrieved?.text).toBe("Corps du message en texte");
    expect(retrieved?.html).toBe("<p>Corps du message en HTML</p>");
  });

  it("met à jour les flags d'un message localement", async () => {
    await db.saveMessages("acc1", "INBOX", [mockMsg1]);
    await db.updateMessageFlagsLocally("acc1", "INBOX", 101, { seen: true, flagged: true });

    const messages = await db.getMessages("acc1", "INBOX");
    expect(messages[0].flags.seen).toBe(true);
    expect(messages[0].flags.flagged).toBe(true);
  });

  it("met à jour l'épinglage localement", async () => {
    await db.saveMessages("acc1", "INBOX", [mockMsg1]);
    await db.updateMessagePinLocally("acc1", "INBOX", 101, true);

    const messages = await db.getMessages("acc1", "INBOX");
    expect(messages[0].isPinned).toBe(true);
  });

  it("supprime un message localement", async () => {
    await db.saveMessages("acc1", "INBOX", [mockMsg1, mockMsg2]);
    await db.deleteMessageLocally("acc1", "INBOX", 101);

    const messages = await db.getMessages("acc1", "INBOX");
    expect(messages).toHaveLength(1);
    expect(messages[0].uid).toBe(102);
  });

  it("gère les mutations en attente (ajout, listing, suppression, purge)", async () => {
    const id1 = await db.addPendingMutation({
      type: "UPDATE_FLAGS",
      accountId: "acc1",
      folder: "INBOX",
      uid: 101,
      payload: { seen: true },
    });

    const id2 = await db.addPendingMutation({
      type: "DELETE_MESSAGE",
      accountId: "acc1",
      folder: "INBOX",
      uid: 102,
    });

    let pending = await db.getPendingMutations();
    expect(pending).toHaveLength(2);
    expect(pending[0].id).toBe(id1);
    expect(pending[1].id).toBe(id2);

    await db.removePendingMutation(id1);
    pending = await db.getPendingMutations();
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe(id2);

    await db.clearPendingMutations();
    pending = await db.getPendingMutations();
    expect(pending).toHaveLength(0);
  });
});
