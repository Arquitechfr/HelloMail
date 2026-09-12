import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SmartFolderDialog } from "./SmartFolderDialog";

const mockMutateAsync = vi.fn().mockResolvedValue({});

vi.mock("@/lib/queries/smartFolders", () => ({
  useCreateSmartFolder: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
  useUpdateSmartFolder: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

vi.mock("@/lib/queries/accounts", () => ({
  useAccounts: () => ({
    data: [
      { _id: "acc-1", emailAddress: "pro@example.com" },
      { _id: "acc-2", emailAddress: "perso@example.com" },
    ],
  }),
}));

describe("SmartFolderDialog", () => {
  it("affiche les éléments du dialogue et les deux sections", () => {
    render(<SmartFolderDialog open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Créer un dossier intelligent")).toBeInTheDocument();
    expect(screen.getByLabelText("Nom du dossier")).toBeInTheDocument();
    expect(screen.getByText("Icône")).toBeInTheDocument();
    expect(screen.getByText("Couleur")).toBeInTheDocument();
    expect(screen.getByLabelText("Périmètre des comptes")).toBeInTheDocument();
    expect(screen.getByText("Critères de recherche")).toBeInTheDocument();
    expect(screen.getByText("+ Non lus")).toBeInTheDocument();
    expect(screen.getByText("+ Épinglés")).toBeInTheDocument();
  });

  it("ajoute un filtre rapide au clic dans la requête", async () => {
    render(<SmartFolderDialog open={true} onOpenChange={vi.fn()} />);

    const queryInput = screen.getByPlaceholderText("Ex : is:unread from:stripe.com");
    expect(queryInput).toHaveValue("");

    const unreadFilterBtn = screen.getByRole("button", { name: "+ Non lus" });
    await userEvent.click(unreadFilterBtn);

    expect(queryInput).toHaveValue("is:unread");

    const pinnedFilterBtn = screen.getByRole("button", { name: "+ Épinglés" });
    await userEvent.click(pinnedFilterBtn);

    expect(queryInput).toHaveValue("is:unread is:pinned");
  });

  it("soumet les données et appelle la mutation de création", async () => {
    const onOpenChange = vi.fn();
    render(<SmartFolderDialog open={true} onOpenChange={onOpenChange} />);

    const nameInput = screen.getByLabelText("Nom du dossier");
    await userEvent.type(nameInput, "Factures");

    const unreadBtn = screen.getByRole("button", { name: "+ Non lus" });
    await userEvent.click(unreadBtn);

    const submitBtn = screen.getByRole("button", { name: "Créer le dossier" });
    await userEvent.click(submitBtn);

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Factures",
        query: "is:unread",
      }),
    );
  });
});
