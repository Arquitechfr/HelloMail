import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BlockSenderDialog } from "./BlockSenderDialog";
import * as api from "@/lib/api";

const mockInvalidateQueries = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

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

describe("BlockSenderDialog", () => {
  const onOpenChange = vi.fn();
  const onSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche les détails du blocage pour l'adresse spécifiée", () => {
    render(
      <BlockSenderDialog
        open={true}
        onOpenChange={onOpenChange}
        accountId="acc-1"
        folder="INBOX"
        uid={123}
        senderEmail="spammer@example.com"
        onSuccess={onSuccess}
      />
    );

    expect(screen.getByText("Bloquer cet expéditeur ?")).toBeInTheDocument();
    expect(screen.getAllByText("spammer@example.com").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: /bloquer et déplacer en spam/i })).toBeInTheDocument();
  });

  it("exécute le blocage au clic et notifie le succès", async () => {
    vi.mocked(api.apiFetch).mockResolvedValueOnce({
      message: "L'expéditeur a été bloqué avec succès",
    });

    render(
      <BlockSenderDialog
        open={true}
        onOpenChange={onOpenChange}
        accountId="acc-1"
        folder="INBOX"
        uid={123}
        senderEmail="spammer@example.com"
        onSuccess={onSuccess}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /bloquer et déplacer en spam/i }));

    await waitFor(() => {
      expect(api.apiFetch).toHaveBeenCalledWith(
        "/api/accounts/acc-1/messages/INBOX/123/block-sender",
        expect.objectContaining({ method: "POST" })
      );
    });

    await waitFor(() => {
      expect(mockInvalidateQueries).toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
