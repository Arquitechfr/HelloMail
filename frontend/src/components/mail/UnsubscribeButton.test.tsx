import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { UnsubscribeButton } from "./UnsubscribeButton";
import * as api from "@/lib/api";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

describe("UnsubscribeButton", () => {
  const mockInfo = {
    httpUrl: "https://example.com/one-click",
    mailto: undefined,
    isOneClick: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche le bouton 'Se désabonner'", () => {
    render(
      <UnsubscribeButton
        accountId="acc-1"
        folder="INBOX"
        uid={42}
        info={mockInfo}
      />
    );

    expect(screen.getByRole("button", { name: /se désabonner/i })).toBeInTheDocument();
  });

  it("ouvre la modale de confirmation au clic", () => {
    render(
      <UnsubscribeButton
        accountId="acc-1"
        folder="INBOX"
        uid={42}
        info={mockInfo}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /se désabonner/i }));
    expect(screen.getByText(/se désabonner de cette liste \?/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirmer en 1 clic/i })).toBeInTheDocument();
  });

  it("exécute le désabonnement et affiche le badge 'Désabonné'", async () => {
    vi.mocked(api.apiFetch).mockResolvedValueOnce({
      success: true,
      action: "one_click",
      details: "Désabonnement en 1 clic effectué",
    });

    render(
      <UnsubscribeButton
        accountId="acc-1"
        folder="INBOX"
        uid={42}
        info={mockInfo}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /se désabonner/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirmer en 1 clic/i }));

    await waitFor(() => {
      expect(api.apiFetch).toHaveBeenCalledWith(
        "/api/accounts/acc-1/messages/INBOX/42/unsubscribe",
        expect.objectContaining({ method: "POST" })
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Désabonné")).toBeInTheDocument();
    });
  });
});
