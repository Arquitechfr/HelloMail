import { describe, it, expect, beforeEach, vi } from "vitest";
import { useUndoSendStore } from "./undoSendStore";
import type { SendEmailInput } from "@/lib/api-types";

function makeItem(overrides: Record<string, unknown> = {}) {
  const payload: SendEmailInput = {
    to: ["bob@test.com"],
    cc: ["cc@test.com"],
    subject: "Sujet test",
    html: "<p>Corps</p>",
    text: "Corps",
  };
  return {
    accountId: "acc1",
    payload,
    mode: "new" as const,
    draftUid: null,
    attachments: [],
    recipientPreview: "bob@test.com",
    subjectPreview: "Sujet test",
    totalDurationMs: 5000,
    onExecute: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("undoSendStore", () => {
  beforeEach(() => {
    useUndoSendStore.setState({ pendingSend: null });
  });

  it("queueSend empile un envoi avec expiration", () => {
    const id = useUndoSendStore.getState().queueSend(makeItem());
    const pending = useUndoSendStore.getState().pendingSend;
    expect(id).toBeTruthy();
    expect(pending).not.toBeNull();
    expect(pending!.expiresAt - pending!.createdAt).toBe(5000);
  });

  it("cancelPendingSend restaure les données de composition et vide la file", () => {
    useUndoSendStore.getState().queueSend(makeItem());
    const restored = useUndoSendStore.getState().cancelPendingSend();

    expect(restored).not.toBeNull();
    expect(restored!.to).toBe("bob@test.com");
    expect(restored!.cc).toBe("cc@test.com");
    expect(restored!.subject).toBe("Sujet test");
    expect(restored!.body).toBe("<p>Corps</p>");
    expect(useUndoSendStore.getState().pendingSend).toBeNull();
  });

  it("cancelPendingSend retourne null si rien en file", () => {
    expect(useUndoSendStore.getState().cancelPendingSend()).toBeNull();
  });

  it("confirmPendingSend exécute l'envoi et vide la file", () => {
    const onExecute = vi.fn().mockResolvedValue(undefined);
    useUndoSendStore.getState().queueSend(makeItem({ onExecute }));
    useUndoSendStore.getState().confirmPendingSend();

    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(useUndoSendStore.getState().pendingSend).toBeNull();
  });

  it("setUndoSendDelay met à jour le délai", () => {
    useUndoSendStore.getState().setUndoSendDelay(15);
    expect(useUndoSendStore.getState().undoSendDelay).toBe(15);
  });
});
