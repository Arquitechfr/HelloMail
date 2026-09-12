import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SmartRepliesChips } from "./SmartRepliesChips";

describe("SmartRepliesChips", () => {
  it("ne rend rien si la liste de réponses est vide", () => {
    const { container } = render(
      <SmartRepliesChips replies={[]} onSelectReply={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("affiche les suggestions fournies", () => {
    const replies = ["Bien reçu, merci !", "Je regarde ça.", "Parfait"];
    render(<SmartRepliesChips replies={replies} onSelectReply={vi.fn()} />);

    expect(screen.getByText("Suggestions :")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bien reçu, merci !" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Je regarde ça." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Parfait" })).toBeInTheDocument();
  });

  it("déclenche onSelectReply avec le texte de la réponse cliquée", () => {
    const onSelect = vi.fn();
    const replies = ["Bien reçu, merci !", "D'accord pour moi."];
    render(<SmartRepliesChips replies={replies} onSelectReply={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "Bien reçu, merci !" }));
    expect(onSelect).toHaveBeenCalledWith("Bien reçu, merci !");
  });
});
