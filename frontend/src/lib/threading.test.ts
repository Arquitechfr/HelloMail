import { describe, it, expect } from "vitest";
import { normalizeSubject, groupMessagesIntoThreads } from "./threading";
import type { Message } from "./api-types";

function createMockMessage(partial: Partial<Message>): Message {
  return {
    _id: `msg-${partial.uid ?? 1}`,
    accountId: "acc-1",
    folder: "INBOX",
    uid: partial.uid ?? 1,
    flags: { seen: true, flagged: false, answered: false },
    subject: partial.subject ?? "Sujet test",
    from: { name: "Expéditeur", address: "sender@example.com" },
    to: [{ name: "Moi", address: "me@example.com" }],
    date: partial.date ?? "2026-09-12T10:00:00.000Z",
    hasAttachments: false,
    size: 1024,
    ...partial,
  };
}

describe("threading - normalizeSubject", () => {
  it("normalise correctement les préfixes usuels Re, Fwd, Tr, etc.", () => {
    expect(normalizeSubject("Re: Réunion projet")).toBe("réunion projet");
    expect(normalizeSubject("RE:  re:  Fwd: tr: Projet X")).toBe("projet x");
    expect(normalizeSubject("Fwd: FW: Document")).toBe("document");
    expect(normalizeSubject("TR: Nouveau devis")).toBe("nouveau devis");
  });

  it("gère les sujets sans préfixe ou vides", () => {
    expect(normalizeSubject("Hello World")).toBe("hello world");
    expect(normalizeSubject("")).toBe("");
  });
});

describe("threading - groupMessagesIntoThreads", () => {
  it("retourne une liste vide si aucun message fourni", () => {
    expect(groupMessagesIntoThreads([])).toEqual([]);
  });

  it("regroupe les messages par sujet normalisé en ordonnant les messages", () => {
    const msg1 = createMockMessage({
      uid: 1,
      subject: "Projet Alpha",
      date: "2026-09-12T09:00:00.000Z",
      flags: { seen: true, flagged: false, answered: false },
    });
    const msg2 = createMockMessage({
      uid: 2,
      subject: "Re: Projet Alpha",
      date: "2026-09-12T11:00:00.000Z",
      flags: { seen: false, flagged: false, answered: false },
    });

    const threads = groupMessagesIntoThreads([msg1, msg2]);

    expect(threads).toHaveLength(1);
    expect(threads[0].count).toBe(2);
    expect(threads[0].rootMessage.uid).toBe(2); // Le plus récent
    expect(threads[0].hasUnread).toBe(true);
    expect(threads[0].messages[0].uid).toBe(2);
    expect(threads[0].messages[1].uid).toBe(1);
  });

  it("regroupe via inReplyTo et messageId même avec des sujets différents", () => {
    const msg1 = createMockMessage({
      uid: 10,
      messageId: "<parent-123@domain.com>",
      subject: "Question initiale",
      date: "2026-09-12T08:00:00.000Z",
    });
    const msg2 = createMockMessage({
      uid: 11,
      inReplyTo: "<parent-123@domain.com>",
      subject: "Réponse sans préfixe standard",
      date: "2026-09-12T12:00:00.000Z",
    });

    const threads = groupMessagesIntoThreads([msg1, msg2]);

    expect(threads).toHaveLength(1);
    expect(threads[0].count).toBe(2);
    expect(threads[0].rootMessage.uid).toBe(11);
  });

  it("place les conversations avec message épinglé en tête", () => {
    const normalThread = createMockMessage({
      uid: 1,
      subject: "Discussion normale",
      date: "2026-09-12T15:00:00.000Z",
      isPinned: false,
    });
    const pinnedThread = createMockMessage({
      uid: 2,
      subject: "Discussion épinglée plus ancienne",
      date: "2026-09-12T10:00:00.000Z",
      isPinned: true,
    });

    const threads = groupMessagesIntoThreads([normalThread, pinnedThread]);

    expect(threads).toHaveLength(2);
    expect(threads[0].rootMessage.uid).toBe(2);
    expect(threads[0].isPinned).toBe(true);
    expect(threads[1].rootMessage.uid).toBe(1);
  });
});
