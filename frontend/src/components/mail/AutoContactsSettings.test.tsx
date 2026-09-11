import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AutoContactsSettings } from "./AutoContactsSettings";
import { useAuthStore } from "@/lib/stores/authStore";

const mockMutateAsync = vi.fn().mockResolvedValue({});

vi.mock("@/lib/queries/auth", () => ({
  useUpdatePreferences: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("AutoContactsSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ accessToken: null, user: null, isRestoringSession: false });
  });

  it("reflète la préférence utilisateur (activée)", async () => {
    useAuthStore.setState({
      user: { id: "u1", email: "a@test.com", preferences: { autoAddContacts: true } },
    });
    render(<AutoContactsSettings />);

    const toggle = await screen.findByRole("switch");
    await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "true"));
  });

  it("reflète la préférence utilisateur (désactivée par défaut)", async () => {
    useAuthStore.setState({
      user: { id: "u1", email: "a@test.com" },
    });
    render(<AutoContactsSettings />);

    const toggle = await screen.findByRole("switch");
    await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "false"));
  });

  it("appelle la mutation avec la valeur basculée", async () => {
    useAuthStore.setState({
      user: { id: "u1", email: "a@test.com", preferences: { autoAddContacts: false } },
    });
    render(<AutoContactsSettings />);

    const toggle = await screen.findByRole("switch");
    await userEvent.click(toggle);

    expect(mockMutateAsync).toHaveBeenCalledWith({ autoAddContacts: true });
  });
});
