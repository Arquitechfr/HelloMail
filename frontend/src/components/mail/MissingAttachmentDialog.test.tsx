import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MissingAttachmentDialog } from "./MissingAttachmentDialog";

describe("MissingAttachmentDialog", () => {
  const onOpenChange = vi.fn();
  const onAddAttachment = vi.fn();
  const onConfirmSend = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche le titre et la description quand il est ouvert", () => {
    render(
      <MissingAttachmentDialog
        open={true}
        onOpenChange={onOpenChange}
        onAddAttachment={onAddAttachment}
        onConfirmSend={onConfirmSend}
      />
    );

    expect(screen.getByText("Pièce jointe manquante ?")).toBeInTheDocument();
    expect(
      screen.getByText(/Votre message semble faire référence à une pièce jointe/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /ajouter une pièce jointe/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /envoyer quand même/i })
    ).toBeInTheDocument();
  });

  it("appelle onAddAttachment au clic sur le bouton d'ajout", () => {
    render(
      <MissingAttachmentDialog
        open={true}
        onOpenChange={onOpenChange}
        onAddAttachment={onAddAttachment}
        onConfirmSend={onConfirmSend}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: /ajouter une pièce jointe/i })
    );
    expect(onAddAttachment).toHaveBeenCalledTimes(1);
    expect(onConfirmSend).not.toHaveBeenCalled();
  });

  it("appelle onConfirmSend au clic sur Envoyer quand même", () => {
    render(
      <MissingAttachmentDialog
        open={true}
        onOpenChange={onOpenChange}
        onAddAttachment={onAddAttachment}
        onConfirmSend={onConfirmSend}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: /envoyer quand même/i })
    );
    expect(onConfirmSend).toHaveBeenCalledTimes(1);
    expect(onAddAttachment).not.toHaveBeenCalled();
  });
});
