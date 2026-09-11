import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UnifiedFolderList } from "./UnifiedFolderList";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/mail/unified/inbox",
}));

vi.mock("@/lib/stores/authStore", () => ({
  useAuthStore: (selector: (s: { user: { preferences?: Record<string, unknown> } | null }) => unknown) =>
    selector({
      user: {
        preferences: {
          unifiedFoldersEnabled: true,
          unifiedFolders: [
            { id: "inbox", label: "Boîte Principale", enabled: true, order: 0 },
            { id: "starred", label: "Favoris", enabled: true, order: 1 },
            { id: "pinned", label: "Épinglés", enabled: false, order: 2 },
          ],
        },
      },
    }),
}));

vi.mock("@/lib/queries/auth", () => ({
  useMe: () => ({ data: undefined }),
  useUpdatePreferences: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/lib/queries/unified", () => ({
  useUnifiedStatus: () => ({
    data: {
      inbox: { unseen: 5, total: 42 },
      starred: { unseen: 0, total: 10 },
    },
  }),
}));

vi.mock("@/lib/stores/uiStore", () => ({
  useUIStore: () => ({
    setSelectedAccount: vi.fn(),
    setSelectedFolder: vi.fn(),
    setMobileSidebarOpen: vi.fn(),
  }),
}));

describe("UnifiedFolderList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche les dossiers unifiés actifs avec leurs compteurs", () => {
    render(<UnifiedFolderList />);

    // Doit afficher "Boîte Principale" et "Favoris"
    expect(screen.getByText("Boîte Principale")).toBeDefined();
    expect(screen.getByText("Favoris")).toBeDefined();

    // "Épinglés" est désactivé dans la config, donc il ne doit pas être affiché
    expect(screen.queryByText("Épinglés")).toBeNull();

    // Compteur non lu sur la boîte principale
    expect(screen.getByText("5")).toBeDefined();
  });

  it("navigue vers le dossier unifié lors d'un clic", () => {
    render(<UnifiedFolderList />);

    const favButton = screen.getByText("Favoris").closest("button");
    expect(favButton).not.toBeNull();

    if (favButton) {
      fireEvent.click(favButton);
      expect(mockPush).toHaveBeenCalledWith("/mail/unified/starred");
    }
  });
});
