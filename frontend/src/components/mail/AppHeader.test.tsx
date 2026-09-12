import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppHeader } from "./AppHeader";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

let mockNetworkStatus = {
  isOnline: true,
  pendingCount: 0,
  isSyncing: false,
};

vi.mock("@/lib/offline/useNetworkStatus", () => ({
  useNetworkStatus: () => mockNetworkStatus,
}));

vi.mock("@/lib/stores/uiStore", () => ({
  useUIStore: () => ({
    openCompose: vi.fn(),
    openSearch: vi.fn(),
    selectedFolder: "INBOX",
    toggleMobileSidebar: vi.fn(),
    setShortcutsDialogOpen: vi.fn(),
  }),
}));

vi.mock("@/components/mail/UserDropdown", () => ({
  UserDropdown: () => <div data-testid="user-dropdown" />,
}));

vi.mock("@/components/mail/ThemeToggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

describe("AppHeader - Statut Réseau", () => {
  const queryClient = new QueryClient();

  const renderWithProviders = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <AppHeader />
      </QueryClientProvider>,
    );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche la pastille 'En direct' quand le client est connecté", () => {
    mockNetworkStatus = {
      isOnline: true,
      pendingCount: 0,
      isSyncing: false,
    };

    renderWithProviders();

    expect(screen.getByTestId("network-status-online")).toBeInTheDocument();
    expect(screen.getByText("En direct")).toBeInTheDocument();
    expect(screen.queryByTestId("network-status-offline")).not.toBeInTheDocument();
  });

  it("affiche le badge 'Hors-ligne' avec le compteur d'actions en attente", () => {
    mockNetworkStatus = {
      isOnline: false,
      pendingCount: 3,
      isSyncing: false,
    };

    renderWithProviders();

    expect(screen.getByTestId("network-status-offline")).toBeInTheDocument();
    expect(screen.getByText("Hors-ligne")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("affiche l'indicateur 'Synchronisation...' quand le rejeu offline est en cours", () => {
    mockNetworkStatus = {
      isOnline: true,
      pendingCount: 0,
      isSyncing: true,
    };

    renderWithProviders();

    expect(screen.getByTestId("network-status-syncing")).toBeInTheDocument();
    expect(screen.getByText("Synchronisation...")).toBeInTheDocument();
  });

  it("affiche le bouton Sync et permet de déclencher une synchronisation", async () => {
    mockNetworkStatus = {
      isOnline: true,
      pendingCount: 0,
      isSyncing: false,
    };

    renderWithProviders();

    const syncButton = screen.getByTitle("Synchroniser les emails (Cmd+R)");
    expect(syncButton).toBeInTheDocument();
    expect(syncButton).not.toBeDisabled();
  });
});

