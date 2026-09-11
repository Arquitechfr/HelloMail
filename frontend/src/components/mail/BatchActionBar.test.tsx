import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BatchActionBar } from "./BatchActionBar";

const mockClearSelectedUids = vi.fn();
const mockMutateBatch = vi.fn();
let mockSelectedUids: number[] = [];

vi.mock("@/lib/stores/uiStore", () => ({
  useUIStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      selectedUids: mockSelectedUids,
      clearSelectedUids: mockClearSelectedUids,
    }),
}));

vi.mock("@/lib/queries/messages", () => ({
  useBatchAction: () => ({
    mutate: mockMutateBatch,
    isPending: false,
  }),
}));

vi.mock("@/lib/queries/tags", () => ({
  useBatchSetMessageTags: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useTags: () => ({
    data: { data: [] },
  }),
}));

vi.mock("@/lib/queries/folders", () => ({
  useFolders: () => ({
    data: [],
  }),
}));

describe("BatchActionBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectedUids = [];
  });

  it("ne rend rien si aucun message n'est sélectionné", () => {
    mockSelectedUids = [];
    const { container } = render(
      <BatchActionBar accountId="acc-1" folder="INBOX" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("affiche le compteur et les boutons d'action quand des messages sont sélectionnés", () => {
    mockSelectedUids = [101, 102, 103];
    render(
      <BatchActionBar accountId="acc-1" folder="INBOX" />
    );

    expect(screen.getByText(/3/)).toBeInTheDocument();
    expect(screen.getByText(/sélectionnés/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Marquer comme lu/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mettre en avant/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Supprimer/i })).toBeInTheDocument();
  });

  it("déclenche l'action markRead lors du clic sur le bouton correspondant", async () => {
    mockSelectedUids = [101];
    render(
      <BatchActionBar accountId="acc-1" folder="INBOX" />
    );

    const markReadBtn = screen.getByRole("button", { name: /Marquer comme lu/i });
    await userEvent.click(markReadBtn);

    expect(mockMutateBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        uids: [101],
        action: "markRead",
        folder: "INBOX",
      }),
      expect.any(Object)
    );
  });

  it("déclenche l'action pin lors du clic sur le bouton Mettre en avant", async () => {
    mockSelectedUids = [101, 102];
    render(
      <BatchActionBar accountId="acc-1" folder="INBOX" />
    );

    const pinBtn = screen.getByRole("button", { name: /Mettre en avant/i });
    await userEvent.click(pinBtn);

    expect(mockMutateBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        uids: [101, 102],
        action: "pin",
        folder: "INBOX",
      }),
      expect.any(Object)
    );
  });

  it("permet d'annuler la sélection via le bouton de fermeture", async () => {
    mockSelectedUids = [101];
    render(
      <BatchActionBar accountId="acc-1" folder="INBOX" />
    );

    const closeBtn = screen.getByRole("button", { name: /Annuler la sélection/i });
    await userEvent.click(closeBtn);

    expect(mockClearSelectedUids).toHaveBeenCalled();
  });
});
