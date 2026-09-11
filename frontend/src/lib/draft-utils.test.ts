import { describe, it, expect, vi, beforeEach } from "vitest";
import { isDraftFolder } from "@/lib/folder-utils";
import {
  messageDetailToRestoredComposeData,
  openDraftCompose,
} from "@/lib/draft-utils";
import type { MessageDetail } from "@/lib/api-types";
import { useUIStore } from "@/lib/stores/uiStore";

// Mock des modules externes
vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
  apiFetchBlob: vi.fn(),
}));

describe("isDraftFolder", () => {
  it("détecte les dossiers de brouillons par chemin classique", () => {
    expect(isDraftFolder("Drafts")).toBe(true);
    expect(isDraftFolder("drafts")).toBe(true);
    expect(isDraftFolder("Brouillons")).toBe(true);
    expect(isDraftFolder("brouillon")).toBe(true);
    expect(isDraftFolder("[Gmail]/Drafts")).toBe(true);
  });

  it("détecte un sous-dossier ou objet avec specialUse \\Drafts", () => {
    expect(isDraftFolder({ path: "INBOX/MyDrafts", specialUse: "\\Drafts" })).toBe(true);
    expect(isDraftFolder({ path: "CustomFolder", name: "Brouillons" })).toBe(true);
  });

  it("utilise la liste des dossiers de repli pour identifier \\Drafts", () => {
    const folders = [
      { path: "INBOX", name: "Boîte de réception", flags: [] },
      { path: "Dossier123", name: "MonDossier", specialUse: "\\Drafts", flags: [] },
    ];
    expect(isDraftFolder("Dossier123", folders)).toBe(true);
    expect(isDraftFolder("INBOX", folders)).toBe(false);
  });

  it("retourne false pour les dossiers non brouillons", () => {
    expect(isDraftFolder("INBOX")).toBe(false);
    expect(isDraftFolder("Sent")).toBe(false);
    expect(isDraftFolder("Trash")).toBe(false);
    expect(isDraftFolder(null)).toBe(false);
    expect(isDraftFolder(undefined)).toBe(false);
  });
});

describe("messageDetailToRestoredComposeData", () => {
  it("convertit un MessageDetail avec HTML vers RestoredComposeData", () => {
    const detail: MessageDetail = {
      subject: "Projet Alpha",
      from: { name: "Moi", address: "me@test.com" },
      to: [{ name: "Alice", address: "alice@test.com" }],
      cc: [{ name: "Bob", address: "bob@test.com" }],
      date: new Date().toISOString(),
      headers: { bcc: "secret@test.com" },
      html: "<p>Bonjour Alice</p>",
      flags: { seen: true, answered: false, flagged: false },
      size: 1024,
      attachments: [],
      readReceiptRequestedTo: "receipt@test.com",
    };

    const result = messageDetailToRestoredComposeData(detail, 42);

    expect(result.subject).toBe("Projet Alpha");
    expect(result.to).toBe("alice@test.com");
    expect(result.cc).toBe("bob@test.com");
    expect(result.bcc).toBe("secret@test.com");
    expect(result.body).toBe("<p>Bonjour Alice</p>");
    expect(result.draftUid).toBe(42);
    expect(result.requestReadReceipt).toBe(true);
  });

  it("convertit les retours à la ligne si seul message.text est fourni", () => {
    const detail: MessageDetail = {
      subject: "Test Texte",
      from: { address: "me@test.com" },
      to: [{ address: "dest@test.com" }],
      date: new Date().toISOString(),
      headers: {},
      text: "Ligne 1\nLigne 2",
      flags: { seen: true, answered: false, flagged: false },
      size: 512,
      attachments: [],
    };

    const result = messageDetailToRestoredComposeData(detail, 99);

    expect(result.body).toBe("<p>Ligne 1<br>Ligne 2</p>");
    expect(result.draftUid).toBe(99);
  });
});

describe("openDraftCompose", () => {
  beforeEach(() => {
    useUIStore.setState({ composeOpen: false, composeRestoredData: null });
  });

  it("ouvre ComposePanel avec les données restaurées préchargées", async () => {
    const detail: MessageDetail = {
      subject: "Brouillon urgent",
      from: { address: "me@test.com" },
      to: [{ address: "client@test.com" }],
      date: new Date().toISOString(),
      headers: {},
      html: "<p>Contenu brouillon</p>",
      flags: { seen: true, answered: false, flagged: false },
      size: 256,
      attachments: [],
    };

    await openDraftCompose("acc-1", "Drafts", 101, detail);

    const state = useUIStore.getState();
    expect(state.composeOpen).toBe(true);
    expect(state.composeMode).toBe("new");
    expect(state.composeRestoredData?.subject).toBe("Brouillon urgent");
    expect(state.composeRestoredData?.to).toBe("client@test.com");
    expect(state.composeRestoredData?.draftUid).toBe(101);
  });
});
