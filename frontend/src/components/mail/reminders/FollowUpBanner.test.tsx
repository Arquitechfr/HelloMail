import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FollowUpBanner } from "./FollowUpBanner";

const mockReminder = vi.fn();
const mockSnooze = vi.fn();
const mockDismiss = vi.fn();
const mockCancel = vi.fn();

vi.mock("@/lib/queries/reminders", () => ({
  useMessageReminder: () => mockReminder(),
  useCreateReminder: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useSnoozeReminder: () => ({
    mutateAsync: mockSnooze,
    isPending: false,
  }),
  useDismissReminder: () => ({
    mutateAsync: mockDismiss,
    isPending: false,
  }),
  useCancelReminder: () => ({
    mutateAsync: mockCancel,
    isPending: false,
  }),
}));

describe("FollowUpBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ne rend rien si aucun rappel n'est trouvé", () => {
    mockReminder.mockReturnValue({ data: null, isLoading: false });

    const { container } = render(
      <FollowUpBanner
        accountId="acc-1"
        folder="Sent"
        uid={100}
        subject="Devis projet"
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("affiche la bannière de rappel échu (triggered) avec actions rapides", async () => {
    mockReminder.mockReturnValue({
      data: {
        id: "rem-1",
        accountId: "acc-1",
        folder: "Sent",
        uid: 100,
        status: "triggered",
        remindAt: "2026-09-10T09:00:00.000Z",
        note: "Relancer le client",
      },
      isLoading: false,
    });

    const onReply = vi.fn();

    render(
      <FollowUpBanner
        accountId="acc-1"
        folder="Sent"
        uid={100}
        subject="Devis projet"
        onReply={onReply}
      />
    );

    expect(
      screen.getByText("Rappel de suivi : aucune réponse reçue à ce message")
    ).toBeInTheDocument();
    expect(screen.getByText(/Relancer le client/)).toBeInTheDocument();

    const relancerBtn = screen.getByRole("button", { name: /Relancer/i });
    await userEvent.click(relancerBtn);
    expect(onReply).toHaveBeenCalledTimes(1);

    const snooze2jBtn = screen.getByRole("button", { name: /\+2j/i });
    await userEvent.click(snooze2jBtn);
    expect(mockSnooze).toHaveBeenCalledTimes(1);

    const dismissBtn = screen.getByRole("button", { name: /Traiter/i });
    await userEvent.click(dismissBtn);
    expect(mockDismiss).toHaveBeenCalledWith("rem-1");
  });

  it("affiche la bannière de rappel en attente (pending)", async () => {
    mockReminder.mockReturnValue({
      data: {
        id: "rem-2",
        accountId: "acc-1",
        folder: "Sent",
        uid: 101,
        status: "pending",
        remindAt: "2026-09-20T09:00:00.000Z",
        note: "Attente validation",
      },
      isLoading: false,
    });

    render(
      <FollowUpBanner
        accountId="acc-1"
        folder="Sent"
        uid={101}
        subject="Proposition commerciale"
      />
    );

    expect(screen.getByText(/Rappel de relance actif pour le/i)).toBeInTheDocument();
    expect(screen.getByText(/Attente validation/)).toBeInTheDocument();

    const cancelBtn = screen.getByRole("button", { name: /Annuler/i });
    await userEvent.click(cancelBtn);
    expect(mockCancel).toHaveBeenCalledWith("rem-2");
  });

  it("affiche le message de réponse reçue (replied)", () => {
    mockReminder.mockReturnValue({
      data: {
        id: "rem-3",
        accountId: "acc-1",
        folder: "Sent",
        uid: 102,
        status: "replied",
        remindAt: "2026-09-10T09:00:00.000Z",
        repliedAt: "2026-09-11T14:30:00.000Z",
      },
      isLoading: false,
    });

    render(
      <FollowUpBanner
        accountId="acc-1"
        folder="Sent"
        uid={102}
        subject="Facture en attente"
      />
    );

    expect(screen.getByText(/Réponse reçue/i)).toBeInTheDocument();
    expect(screen.getByText(/Rappel de suivi désactivé/i)).toBeInTheDocument();
  });
});
