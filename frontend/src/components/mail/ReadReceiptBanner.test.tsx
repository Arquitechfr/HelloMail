import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReadReceiptBanner } from "./ReadReceiptBanner";

const mockSendReadReceipt = vi.fn();

vi.mock("@/lib/queries/messages", () => ({
  useSendReadReceipt: () => ({
    mutateAsync: mockSendReadReceipt,
    isPending: false,
  }),
}));

describe("ReadReceiptBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche la bannière de demande si non encore envoyé", () => {
    render(
      <ReadReceiptBanner
        accountId="acc-1"
        folder="INBOX"
        uid={42}
        recipientEmail="contact@test.com"
      />
    );

    expect(screen.getByText("Accusé de lecture :")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Envoyer la confirmation/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ignorer/i })).toBeInTheDocument();
  });

  it("affiche directement l'état envoyé si readReceiptSentAt est présent", () => {
    render(
      <ReadReceiptBanner
        accountId="acc-1"
        folder="INBOX"
        uid={42}
        recipientEmail="contact@test.com"
        readReceiptSentAt="2026-09-11T12:00:00Z"
      />
    );

    expect(screen.getByText("Accusé de lecture envoyé")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Envoyer la confirmation/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Masquer/i })).toBeInTheDocument();
  });

  it("envoie l'accusé et bascule en état confirmé sans possibilité de ré-envoi", async () => {
    mockSendReadReceipt.mockResolvedValueOnce({ ok: true, sentTo: "contact@test.com" });

    render(
      <ReadReceiptBanner
        accountId="acc-1"
        folder="INBOX"
        uid={42}
        recipientEmail="contact@test.com"
      />
    );

    const sendBtn = screen.getByRole("button", { name: /Envoyer la confirmation/i });
    await userEvent.click(sendBtn);

    expect(mockSendReadReceipt).toHaveBeenCalledWith({ folder: "INBOX", uid: 42 });
    expect(await screen.findByText("Accusé de lecture envoyé")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Envoyer la confirmation/i })).not.toBeInTheDocument();
  });

  it("masque la bannière au clic sur Ignorer", async () => {
    const { container } = render(
      <ReadReceiptBanner
        accountId="acc-1"
        folder="INBOX"
        uid={42}
        recipientEmail="contact@test.com"
      />
    );

    const ignoreBtn = screen.getByRole("button", { name: /Ignorer/i });
    await userEvent.click(ignoreBtn);

    expect(container).toBeEmptyDOMElement();
  });
});
