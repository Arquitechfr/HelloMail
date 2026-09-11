import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountAliasesDialog } from "./AccountAliasesDialog";
import type { Account, AccountAlias } from "@/lib/api-types";

// Mocks des hooks React Query
const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockDeleteMutate = vi.fn();

const mockAliases: AccountAlias[] = [
  {
    _id: "alias-1",
    name: "Support Pro",
    email: "support@hellomail.fr",
    isDefault: true,
  },
  {
    _id: "alias-2",
    name: "Direction",
    email: "direction@hellomail.fr",
    isDefault: false,
  },
];

vi.mock("@/lib/queries/aliases", () => ({
  useAccountAliases: () => ({
    data: mockAliases,
    isLoading: false,
  }),
  useCreateAccountAlias: () => ({
    mutate: mockCreateMutate,
    isPending: false,
  }),
  useUpdateAccountAlias: () => ({
    mutate: mockUpdateMutate,
    isPending: false,
  }),
  useDeleteAccountAlias: () => ({
    mutate: mockDeleteMutate,
    isPending: false,
  }),
}));

describe("AccountAliasesDialog", () => {
  const mockAccount: Account = {
    _id: "acc-123",
    provider: "imap",
    emailAddress: "principal@hellomail.fr",
    displayName: "Jean Dupont",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche l'adresse principale et les alias configurés", () => {
    render(
      <AccountAliasesDialog
        account={mockAccount}
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    expect(
      screen.getByRole("heading", { name: /Alias d'expédition/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Jean Dupont <principal@hellomail.fr>"),
    ).toBeInTheDocument();
    expect(screen.getByText("support@hellomail.fr")).toBeInTheDocument();
    expect(screen.getByText("direction@hellomail.fr")).toBeInTheDocument();
    expect(screen.getByText(/Défaut/i)).toBeInTheDocument();
  });

  it("permet d'ouvrir le formulaire d'ajout et d'ajouter un alias", async () => {
    render(
      <AccountAliasesDialog
        account={mockAccount}
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    const addBtn = screen.getByRole("button", {
      name: /Ajouter un alias d'expédition/i,
    });
    await userEvent.click(addBtn);

    const emailInput = screen.getByLabelText(/Adresse email/i);
    const nameInput = screen.getByLabelText(/Nom d'affichage/i);

    await userEvent.type(emailInput, "commercial@hellomail.fr");
    await userEvent.type(nameInput, "Ventes");

    const submitBtn = screen.getByRole("button", { name: "Ajouter" });
    await userEvent.click(submitBtn);

    expect(mockCreateMutate).toHaveBeenCalledTimes(1);
    expect(mockCreateMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Ventes",
        email: "commercial@hellomail.fr",
        isDefault: false,
      }),
      expect.any(Object),
    );
  });

  it("permet de supprimer un alias", async () => {
    render(
      <AccountAliasesDialog
        account={mockAccount}
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    const deleteButtons = screen.getAllByTitle("Supprimer");
    expect(deleteButtons.length).toBe(2);

    await userEvent.click(deleteButtons[0]);

    expect(mockDeleteMutate).toHaveBeenCalledWith("alias-1", expect.any(Object));
  });

  it("permet de définir un alias comme par défaut", async () => {
    render(
      <AccountAliasesDialog
        account={mockAccount}
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    const setDefaultBtn = screen.getByTitle("Définir par défaut");
    await userEvent.click(setDefaultBtn);

    expect(mockUpdateMutate).toHaveBeenCalledWith(
      {
        aliasId: "alias-2",
        body: { isDefault: true },
      },
      expect.any(Object),
    );
  });
});
