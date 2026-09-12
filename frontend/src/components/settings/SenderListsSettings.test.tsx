import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SenderListsSettings } from "./SenderListsSettings";
import * as senderQueries from "@/lib/queries/senderLists";

vi.mock("@/lib/queries/senderLists", () => ({
  useSenderLists: vi.fn(),
  useCreateSenderEntry: vi.fn(),
  useDeleteSenderEntry: vi.fn(),
}));

describe("SenderListsSettings", () => {
  const mockDeleteMutateAsync = vi.fn();
  const mockCreateMutateAsync = vi.fn();

  const sampleEntries = [
    {
      _id: "entry-1",
      userId: "user-1",
      type: "allow" as const,
      target: "trusted@bank.com",
      note: "Banque",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      _id: "entry-2",
      userId: "user-1",
      type: "deny" as const,
      target: "spammer@evil.com",
      note: "Spam pub",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(senderQueries.useSenderLists).mockReturnValue({
      data: { success: true, data: sampleEntries },
      isLoading: false,
    } as ReturnType<typeof senderQueries.useSenderLists>);

    vi.mocked(senderQueries.useDeleteSenderEntry).mockReturnValue({
      mutateAsync: mockDeleteMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof senderQueries.useDeleteSenderEntry>);

    vi.mocked(senderQueries.useCreateSenderEntry).mockReturnValue({
      mutateAsync: mockCreateMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof senderQueries.useCreateSenderEntry>);
  });

  it("affiche la liste blanche par défaut et l'expéditeur de confiance", () => {
    render(<SenderListsSettings />);

    expect(screen.getByText("Listes de Confiance & Anti-Spam (Allowlist / Denylist)")).toBeInTheDocument();
    expect(screen.getByText("trusted@bank.com")).toBeInTheDocument();
    expect(screen.getByText("Banque")).toBeInTheDocument();
    // L'entrée de liste noire ne doit pas apparaître sous l'onglet Liste blanche
    expect(screen.queryByText("spammer@evil.com")).not.toBeInTheDocument();
  });

  it("bascule vers la liste noire au clic sur l'onglet correspondant", () => {
    render(<SenderListsSettings />);

    const denyTab = screen.getByRole("button", { name: /liste noire/i });
    fireEvent.click(denyTab);

    expect(screen.getByText("spammer@evil.com")).toBeInTheDocument();
    expect(screen.getByText("Spam pub")).toBeInTheDocument();
    expect(screen.queryByText("trusted@bank.com")).not.toBeInTheDocument();
  });

  it("filtre la liste selon la saisie dans le champ de recherche", () => {
    render(<SenderListsSettings />);

    const searchInput = screen.getByPlaceholderText(/rechercher une adresse/i);
    fireEvent.change(searchInput, { target: { value: "inexistant" } });

    expect(screen.getByText(/aucune règle ne correspond à votre recherche/i)).toBeInTheDocument();
  });

  it("déclenche la suppression au clic sur le bouton corbeille", async () => {
    mockDeleteMutateAsync.mockResolvedValueOnce({ success: true });

    render(<SenderListsSettings />);

    const deleteBtn = screen.getByTitle("Supprimer cette règle");
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(mockDeleteMutateAsync).toHaveBeenCalledWith("entry-1");
    });
  });

  it("ouvre la modale d'ajout au clic sur 'Ajouter une règle'", () => {
    render(<SenderListsSettings />);

    const addBtn = screen.getByRole("button", { name: /ajouter une règle/i });
    fireEvent.click(addBtn);

    expect(screen.getByText("Ajouter une règle de confiance")).toBeInTheDocument();
    expect(screen.getByLabelText(/adresse ou nom de domaine/i)).toBeInTheDocument();
  });
});
