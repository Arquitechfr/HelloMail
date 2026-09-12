import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FollowUpDialog } from "./FollowUpDialog";

const mockCreateReminder = vi.fn();
const mockCancelReminder = vi.fn();

vi.mock("@/lib/queries/reminders", () => ({
  useMessageReminder: vi.fn().mockReturnValue({ data: null, isLoading: false }),
  useCreateReminder: () => ({
    mutateAsync: mockCreateReminder,
    isPending: false,
  }),
  useCancelReminder: () => ({
    mutateAsync: mockCancelReminder,
    isPending: false,
  }),
}));

describe("FollowUpDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche les options de presets de relance", () => {
    render(
      <FollowUpDialog
        open={true}
        onOpenChange={vi.fn()}
        accountId="acc-1"
        folder="INBOX"
        uid={10}
      />
    );

    expect(screen.getByText("Rappel de suivi & relance")).toBeInTheDocument();
    expect(screen.getByText("Dans 2 jours")).toBeInTheDocument();
    expect(screen.getByText("Dans 4 jours")).toBeInTheDocument();
    expect(screen.getByText("Dans 1 semaine")).toBeInTheDocument();
    expect(screen.getByText("Dans 2 semaines")).toBeInTheDocument();
  });

  it("appelle createMutation lors du clic sur un preset en mode direct", async () => {
    mockCreateReminder.mockResolvedValueOnce({ ok: true });
    const onOpenChange = vi.fn();

    render(
      <FollowUpDialog
        open={true}
        onOpenChange={onOpenChange}
        accountId="acc-1"
        folder="INBOX"
        uid={10}
      />
    );

    const presetBtn = screen.getByRole("button", { name: /Dans 2 jours/i });
    await userEvent.click(presetBtn);

    expect(mockCreateReminder).toHaveBeenCalledTimes(1);
    expect(mockCreateReminder.mock.calls[0][0]).toHaveProperty("remindAt");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("appelle onSelect en mode composition sans appeler la mutation directe", async () => {
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <FollowUpDialog
        open={true}
        onOpenChange={onOpenChange}
        accountId="acc-1"
        folder="Sent"
        uid={0}
        onSelect={onSelect}
      />
    );

    const presetBtn = screen.getByRole("button", { name: /Dans 4 jours/i });
    await userEvent.click(presetBtn);

    expect(mockCreateReminder).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(typeof onSelect.mock.calls[0][0]).toBe("string");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("permet de supprimer un rappel existant en mode composition avec onClear", async () => {
    const onClear = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <FollowUpDialog
        open={true}
        onOpenChange={onOpenChange}
        accountId="acc-1"
        folder="Sent"
        uid={0}
        initialRemindAt={new Date(Date.now() + 86400000 * 3).toISOString()}
        onSelect={vi.fn()}
        onClear={onClear}
      />
    );

    expect(screen.getByText(/Rappel prévu pour le/i)).toBeInTheDocument();
    const deleteBtn = screen.getByRole("button", { name: /Supprimer/i });
    await userEvent.click(deleteBtn);

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
