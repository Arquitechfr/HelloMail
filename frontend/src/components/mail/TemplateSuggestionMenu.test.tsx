import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TemplateSuggestionMenu } from "./TemplateSuggestionMenu";
import type { EmailTemplate } from "@/lib/types/templates";

describe("TemplateSuggestionMenu", () => {
  const mockTemplates: EmailTemplate[] = [
    {
      id: "tpl-1",
      userId: "u1",
      title: "Remerciement",
      shortcut: "merci",
      subject: "Merci pour votre message",
      bodyHtml: "<p>Je vous remercie.</p>",
      bodyText: "Je vous remercie.",
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "tpl-2",
      userId: "u1",
      title: "Absence",
      shortcut: "!absent",
      bodyHtml: "<p>Je suis absent.</p>",
      bodyText: "Je suis absent.",
      order: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  it("affiche les modèles avec leurs titres et raccourcis formatés", () => {
    render(
      <TemplateSuggestionMenu
        templates={mockTemplates}
        selectedIndex={0}
        query=""
        coords={{ top: 100, left: 100, bottom: 120 }}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Modèles d'emails")).toBeInTheDocument();
    expect(screen.getByText("Remerciement")).toBeInTheDocument();
    expect(screen.getByText("!merci")).toBeInTheDocument();
    expect(screen.getByText("Absence")).toBeInTheDocument();
    expect(screen.getByText("!absent")).toBeInTheDocument();
  });

  it("met en valeur l'élément correspondant à selectedIndex", () => {
    render(
      <TemplateSuggestionMenu
        templates={mockTemplates}
        selectedIndex={1}
        query="ab"
        coords={{ top: 100, left: 100, bottom: 120 }}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveAttribute("data-active", "false");
    expect(buttons[1]).toHaveAttribute("data-active", "true");
  });

  it("déclenche onSelect au clic sur un modèle", () => {
    const handleSelect = vi.fn();
    render(
      <TemplateSuggestionMenu
        templates={mockTemplates}
        selectedIndex={0}
        query=""
        coords={{ top: 100, left: 100, bottom: 120 }}
        onSelect={handleSelect}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("Remerciement"));
    expect(handleSelect).toHaveBeenCalledWith(mockTemplates[0]);
  });

  it("affiche un message d'absence de résultat si la liste est vide", () => {
    render(
      <TemplateSuggestionMenu
        templates={[]}
        selectedIndex={0}
        query="inconnu"
        coords={{ top: 100, left: 100, bottom: 120 }}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/Aucun modèle ne correspond/)).toBeInTheDocument();
  });
});
