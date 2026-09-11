import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useScheduleSend } from "./useScheduleSend";
import { toast } from "sonner";

const mockMutateAsync = vi.fn();
const mockDeleteMutate = vi.fn();

vi.mock("@/lib/queries/scheduled", () => ({
  useScheduleEmail: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

vi.mock("@/lib/queries/drafts", () => ({
  useDeleteDraft: () => ({
    mutate: mockDeleteMutate,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("useScheduleSend", () => {
  const accountId = "acc-test-123";

  it("refuse la programmation si le destinataire est vide", async () => {
    const { result } = renderHook(() => useScheduleSend({ accountId }));

    await act(async () => {
      await result.current.scheduleSend(new Date(Date.now() + 3600000), {
        to: [],
        subject: "Test",
        text: "Contenu",
      });
    });

    expect(toast.error).toHaveBeenCalledWith("Veuillez saisir au moins un destinataire");
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("refuse la programmation si le sujet est vide", async () => {
    const { result } = renderHook(() => useScheduleSend({ accountId }));

    await act(async () => {
      await result.current.scheduleSend(new Date(Date.now() + 3600000), {
        to: ["dest@example.com"],
        subject: "   ",
        text: "Contenu",
      });
    });

    expect(toast.error).toHaveBeenCalledWith("Veuillez saisir un sujet");
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("programme avec succès et supprime le brouillon associé", async () => {
    mockMutateAsync.mockResolvedValueOnce({ id: "scheduled-1" });
    const onClose = vi.fn();

    const { result } = renderHook(() =>
      useScheduleSend({ accountId, draftUid: 42, onClose })
    );

    const targetDate = new Date(Date.now() + 7200000);

    await act(async () => {
      await result.current.scheduleSend(targetDate, {
        to: ["dest@example.com"],
        subject: "Sujet valide",
        text: "Contenu valide",
      });
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({
      to: ["dest@example.com"],
      subject: "Sujet valide",
      text: "Contenu valide",
      scheduledAt: targetDate.toISOString(),
    });

    expect(mockDeleteMutate).toHaveBeenCalledWith(42);
    expect(toast.success).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
