import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AccountColorPicker } from "./AccountColorPicker";

describe("AccountColorPicker", () => {
  it("affiche toutes les options de couleur et appelle onSelectColor au clic", () => {
    const onSelectColor = vi.fn();
    render(
      <AccountColorPicker
        currentColor="#3b82f6"
        usedColors={["#ef4444"]}
        onSelectColor={onSelectColor}
      />,
    );

    // On s'attend à 12 boutons de pastilles de couleur
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(12);

    // Clic sur une couleur différente (Émeraude)
    const emeraldButton = screen.getByTitle("Émeraude");
    expect(emeraldButton).toBeDefined();

    fireEvent.click(emeraldButton);
    expect(onSelectColor).toHaveBeenCalledWith("#10b981");
  });

  it("affiche l'indicateur utilisé pour les couleurs déjà attribuées", () => {
    render(
      <AccountColorPicker
        currentColor="#3b82f6"
        usedColors={["#ef4444"]}
        onSelectColor={() => {}}
      />,
    );

    const redButton = screen.getByTitle("Rouge (utilisé par un autre compte)");
    expect(redButton).toBeDefined();
  });
});
