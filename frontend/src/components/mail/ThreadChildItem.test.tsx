import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThreadChildItem } from "./ThreadChildItem";
import type { Message } from "@/lib/api-types";

function createMockMessage(partial: Partial<Message>): Message {
  return {
    _id: `msg-${partial.uid ?? 1}`,
    accountId: "acc-1",
    folder: "Sent",
    uid: partial.uid ?? 1,
    flags: { seen: true, flagged: false, answered: false },
    subject: partial.subject ?? "Re: Sujet test",
    from: { name: "Alice", address: "alice@example.com" },
    to: [{ name: "Moi", address: "me@example.com" }],
    date: partial.date ?? "2026-09-12T10:00:00.000Z",
    hasAttachments: false,
    size: 1024,
    ...partial,
  };
}

describe("ThreadChildItem", () => {
  it("affiche l'expéditeur et le badge de dossier si différent du dossier courant", () => {
    const message = createMockMessage({ folder: "Sent", from: { name: "Alice", address: "alice@example.com" } });
    const onSelect = vi.fn();

    render(
      <ThreadChildItem
        accountId="acc-1"
        folder="INBOX"
        message={message}
        isSelected={false}
        onSelect={onSelect}
      />
    );

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Envoyé")).toBeInTheDocument();
  });

  it("n'affiche pas de badge si le message est dans le même dossier que le dossier courant", () => {
    const message = createMockMessage({ folder: "INBOX", from: { name: "Bob", address: "bob@example.com" } });
    const onSelect = vi.fn();

    render(
      <ThreadChildItem
        accountId="acc-1"
        folder="INBOX"
        message={message}
        isSelected={false}
        onSelect={onSelect}
      />
    );

    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.queryByText("Envoyé")).not.toBeInTheDocument();
  });

  it("déclenche onSelect lors du clic", () => {
    const message = createMockMessage({ uid: 42 });
    const onSelect = vi.fn();

    render(
      <ThreadChildItem
        accountId="acc-1"
        folder="INBOX"
        message={message}
        isSelected={false}
        onSelect={onSelect}
      />
    );

    fireEvent.click(screen.getByText("Alice"));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
