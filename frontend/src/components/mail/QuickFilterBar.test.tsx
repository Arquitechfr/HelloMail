import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuickFilterBar } from "./QuickFilterBar";

describe("QuickFilterBar", () => {
  const counts = {
    all: 12,
    unread: 4,
    starred: 3,
    pinned: 2,
    attachments: 5,
  };

  it("affiche les 5 boutons de filtres avec leurs libellés et compteurs", () => {
    render(
      <QuickFilterBar
        currentFilter="all"
        onFilterChange={vi.fn()}
        counts={counts}
      />
    );

    expect(screen.getByRole("toolbar", { name: "Filtres rapides de messages" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tous/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Non lus/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Importants/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Épinglés/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pièces jointes/i })).toBeInTheDocument();

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("met en valeur le filtre actif avec aria-pressed et la classe bg-primary", () => {
    render(
      <QuickFilterBar
        currentFilter="starred"
        onFilterChange={vi.fn()}
        counts={counts}
      />
    );

    const starredBtn = screen.getByRole("button", { name: /Importants/i });
    expect(starredBtn).toHaveClass("bg-primary");
    expect(starredBtn).toHaveAttribute("aria-pressed", "true");

    const allBtn = screen.getByRole("button", { name: /Tous/i });
    expect(allBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("affiche le raccourci clavier dans l'attribut title de chaque filtre", () => {
    render(
      <QuickFilterBar
        currentFilter="all"
        onFilterChange={vi.fn()}
        counts={counts}
      />
    );

    expect(screen.getByRole("button", { name: /Tous/i })).toHaveAttribute("title", "Tous (Alt+1)");
    expect(screen.getByRole("button", { name: /Non lus/i })).toHaveAttribute("title", "Non lus (Alt+2)");
    expect(screen.getByRole("button", { name: /Importants/i })).toHaveAttribute("title", "Importants (Alt+3)");
    expect(screen.getByRole("button", { name: /Épinglés/i })).toHaveAttribute("title", "Épinglés (Alt+4)");
    expect(screen.getByRole("button", { name: /Pièces jointes/i })).toHaveAttribute("title", "Pièces jointes (Alt+5)");
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
