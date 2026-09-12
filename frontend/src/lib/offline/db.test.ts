import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryOfflineDb } from "./inMemoryDb";
import type { Message, MessageDetail } from "@/lib/api-types";

describe("OfflineDatabase - pruneOldCache", () => {
  let db: InMemoryOfflineDb;

  beforeEach(() => {
    db = new InMemoryOfflineDb();
  });

  it("supprime les détails de messages expirés selon le TTL maxDetailAgeDays", async () => {
    const accountId = "acc-1";
    const folder = "INBOX";

    const freshDetail: MessageDetail = {
      flags: { seen: true, flagged: false, answered: false },
      from: { address: "a@b.com" },
      to: [{ address: "me@b.com" }],
      subject: "Frais",
      date: new Date().toISOString(),
      headers: {},
      attachments: [],
      size: 100,
      text: "Corps récent",
    };

    const oldDetail: MessageDetail = {
      flags: { seen: true, flagged: false, answered: false },
      from: { address: "old@b.com" },
      to: [{ address: "me@b.com" }],
      subject: "Ancien",
      date: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
      headers: {},
      attachments: [],
      size: 100,
      text: "Corps ancien",
    };

    // Sauvegarder les détails
    await db.saveMessageDetail(accountId, folder, 1, freshDetail);
    await db.saveMessageDetail(accountId, folder, 2, oldDetail);

    // Simuler que le détail 2 est daté de 35 jours dans le cache
    const thirtyFiveDaysAgo = Date.now() - 35 * 24 * 60 * 60 * 1000;
    (db as unknown as { details: Map<string, unknown> }).details.set(`${accountId}:${folder}:2`, {
      ...oldDetail,
      cachedAt: thirtyFiveDaysAgo,
    });

    // Exécuter l'élagage avec un TTL de 30 jours
    const result = await db.pruneOldCache(500, 30);

    expect(result.prunedDetails).toBe(1);
    expect(await db.getMessageDetail(accountId, folder, 1)).not.toBeNull();
    expect(await db.getMessageDetail(accountId, folder, 2)).toBeNull();
  });

  it("plafonne le nombre de messages stockés par dossier au seuil maxMessagesPerFolder", async () => {
    const accountId = "acc-1";
    const folder = "INBOX";

    const messages: Message[] = [];
    for (let i = 1; i <= 10; i++) {
      messages.push({
        _id: `msg-${i}`,
        accountId,
        folder,
        uid: i,
        flags: { seen: true, flagged: false, answered: false },
        from: { address: `sender${i}@test.com` },
        to: [{ address: "me@test.com" }],
        subject: `Message ${i}`,
        date: new Date(2026, 0, i).toISOString(), // i = 10 est le plus récent
        hasAttachments: false,
        size: 200,
      });
    }

    await db.saveMessages(accountId, folder, messages);

    // Élaguer avec un seuil de 5 messages max par dossier
    const result = await db.pruneOldCache(5, 30);

    expect(result.prunedMessages).toBe(5);
    const remaining = await db.getMessages(accountId, folder);
    expect(remaining).toHaveLength(5);
    // Doit avoir conservé les 5 plus récents (UIDs 6 à 10)
    const remainingUids = remaining.map((m) => m.uid);
    expect(remainingUids).toContain(10);
    expect(remainingUids).toContain(9);
    expect(remainingUids).toContain(8);
    expect(remainingUids).toContain(7);
    expect(remainingUids).toContain(6);
    expect(remainingUids).not.toContain(1);
  });
});
