import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuickFilterBar } from "./QuickFilterBar";

describe("QuickFilterBar", () => {
  const counts = {
    all: 12,
    unread: 4,
    pinned: 2,
    attachments: 5,
  };

  it("affiche tous les boutons de filtres avec leurs libellés et compteurs", () => {
    render(
      <QuickFilterBar
        currentFilter="all"
        onFilterChange={vi.fn()}
        counts={counts}
      />
    );

    expect(screen.getByRole("button", { name: /Tous/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Non lus/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Épinglés/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pièces jointes/i })).toBeInTheDocument();
  });

  it("met en valeur le filtre actif avec la classe bg-primary", () => {
    render(
      <QuickFilterBar
        currentFilter="pinned"
        onFilterChange={vi.fn()}
        counts={counts}
      />
    );

    const pinnedBtn = screen.getByRole("button", { name: /Épinglés/i });
    expect(pinnedBtn).toHaveClass("bg-primary");
  });

  it("appelle onFilterChange lors d'un clic sur un filtre différent", async () => {
    const handleFilterChange = vi.fn();
    render(
      <QuickFilterBar
        currentFilter="all"
        onFilterChange={handleFilterChange}
        counts={counts}
      />
    );

    const unreadBtn = screen.getByRole("button", { name: /Non lus/i });
    await userEvent.click(unreadBtn);

    expect(handleFilterChange).toHaveBeenCalledWith("unread");
  });
});
