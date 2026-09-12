import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DensitySelector } from "./DensitySelector";
import { useUIStore } from "@/lib/stores/uiStore";

const mockMutate = vi.fn();

vi.mock("@/lib/queries/auth", () => ({
  useUpdatePreferences: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

describe("DensitySelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUIStore.setState({ displayDensity: "comfortable" });
  });

  it("affiche le bouton trigger pour la densité d'affichage", () => {
    render(<DensitySelector />);
    const trigger = screen.getByRole("button", { name: /densité d'affichage/i });
    expect(trigger).toBeInTheDocument();
  });

  it("permet de changer la densité en 'compact'", async () => {
    const user = userEvent.setup();
    render(<DensitySelector />);

    const trigger = screen.getByRole("button", { name: /densité d'affichage/i });
    await user.click(trigger);

    const compactOption = await screen.findByText("Compact");
    await user.click(compactOption);

    expect(useUIStore.getState().displayDensity).toBe("compact");
    expect(mockMutate).toHaveBeenCalledWith({ displayDensity: "compact" });
  });

  it("permet de changer la densité en 'spacious'", async () => {
    const user = userEvent.setup();
    render(<DensitySelector />);

    const trigger = screen.getByRole("button", { name: /densité d'affichage/i });
    await user.click(trigger);

    const spaciousOption = await screen.findByText("Aéré");
    await user.click(spaciousOption);

    expect(useUIStore.getState().displayDensity).toBe("spacious");
    expect(mockMutate).toHaveBeenCalledWith({ displayDensity: "spacious" });
  });
});
