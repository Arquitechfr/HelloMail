import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdvancedSearchDialog } from "./AdvancedSearchDialog";

vi.mock("@/lib/queries/accounts", () => ({
  useAccounts: () => ({
    data: [
      { _id: "acc-1", displayName: "Pro", emailAddress: "pro@example.com" },
      { _id: "acc-2", displayName: "Perso", emailAddress: "perso@example.com" },
    ],
  }),
}));

vi.mock("@/lib/queries/smartFolders", () => ({
  useCreateSmartFolder: () => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  }),
  useUpdateSmartFolder: () => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  }),
}));

describe("AdvancedSearchDialog", () => {
  const onSearchMock = vi.fn();
  const onOpenChangeMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche les éléments principaux du formulaire", () => {
    render(
      <AdvancedSearchDialog
        open={true}
        onOpenChange={onOpenChangeMock}
        onSearch={onSearchMock}
      />
    );

    expect(screen.getByText("Recherche avancée d'emails")).toBeInTheDocument();
    expect(screen.getByLabelText(/De \(Expéditeur\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/À \(Destinataire\)/)).toBeInTheDocument();
    expect(screen.getByLabelText("Objet")).toBeInTheDocument();
    expect(screen.getByLabelText("Contient les mots")).toBeInTheDocument();
    expect(screen.getByLabelText("Dossier")).toBeInTheDocument();
    expect(screen.getByLabelText(/Taille de l'email/)).toBeInTheDocument();
    expect(screen.getByLabelText("Depuis le")).toBeInTheDocument();
    expect(screen.getByLabelText("Jusqu'au")).toBeInTheDocument();
    expect(screen.getByText("Avec pièces jointes")).toBeInTheDocument();
    expect(screen.getByText("Non lus")).toBeInTheDocument();
    expect(screen.getByText("Importants")).toBeInTheDocument();
    expect(screen.getByText("Épinglés")).toBeInTheDocument();
  });

  it("réinitialise le formulaire lors du clic sur Réinitialiser", async () => {
    render(
      <AdvancedSearchDialog
        open={true}
        onOpenChange={onOpenChangeMock}
        onSearch={onSearchMock}
      />
    );

    const fromInput = screen.getByPlaceholderText("ex: client@entreprise.com");
    await userEvent.type(fromInput, "test@domain.com");
    expect(fromInput).toHaveValue("test@domain.com");

    const resetBtn = screen.getByRole("button", { name: /Réinitialiser/i });
    await userEvent.click(resetBtn);

    expect(fromInput).toHaveValue("");
  });

  it("soumet les critères et appelle onSearch avec la query string correspondante", async () => {
    render(
      <AdvancedSearchDialog
        open={true}
        onOpenChange={onOpenChangeMock}
        onSearch={onSearchMock}
      />
    );

    const fromInput = screen.getByPlaceholderText("ex: client@entreprise.com");
    await userEvent.type(fromInput, "alex@test.com");

    const subjectInput = screen.getByPlaceholderText("ex: Facture, Compte-rendu");
    await userEvent.type(subjectInput, "Facture");

    const attachCheckbox = screen.getByRole("checkbox", { name: /Avec pièces jointes/i });
    await userEvent.click(attachCheckbox);

    const searchBtn = screen.getByRole("button", { name: /^Rechercher$/i });
    await userEvent.click(searchBtn);

    expect(onSearchMock).toHaveBeenCalledTimes(1);
    const [queryStr, params] = onSearchMock.mock.calls[0];

    expect(queryStr).toContain("from:alex@test.com");
    expect(queryStr).toContain("subject:Facture");
    expect(queryStr).toContain("has:attachment");
    expect(params.from).toBe("alex@test.com");
    expect(params.subject).toBe("Facture");
    expect(params.hasAttachment).toBe(true);

    expect(onOpenChangeMock).toHaveBeenCalledWith(false);
  });
});
