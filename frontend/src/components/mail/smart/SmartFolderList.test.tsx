import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SmartFolderList } from "./SmartFolderList";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/mail",
}));

const mockSmartFolders = [
  {
    _id: "sf-1",
    userId: "user-1",
    name: "Urgents",
    query: "is:unread is:flagged",
    icon: "Sparkles",
    color: "#ef4444",
    order: 0,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  },
  {
    _id: "sf-2",
    userId: "user-1",
    name: "Documents",
    query: "has:attachment",
    icon: "FileText",
    color: "#10b981",
    order: 1,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  },
];

const mockCounts = {
  "sf-1": { total: 5, unread: 3 },
  "sf-2": { total: 12, unread: 0 },
};

vi.mock("@/lib/queries/smartFolders", () => ({
  useSmartFolders: () => ({
    data: { data: mockSmartFolders },
    isLoading: false,
  }),
  useSmartFolderCounts: () => ({
    data: { data: mockCounts },
  }),
  useDeleteSmartFolder: () => ({
    mutateAsync: vi.fn(),
  }),
  useCreateSmartFolder: () => ({
    mutateAsync: vi.fn(),
  }),
  useUpdateSmartFolder: () => ({
    mutateAsync: vi.fn(),
  }),
}));

vi.mock("@/lib/queries/accounts", () => ({
  useAccounts: () => ({ data: [] }),
}));

describe("SmartFolderList", () => {
  it("affiche la section et les dossiers intelligents avec leurs compteurs", () => {
    render(<SmartFolderList />);

    expect(screen.getByText("Dossiers intelligents")).toBeInTheDocument();
    expect(screen.getByText("Urgents")).toBeInTheDocument();
    expect(screen.getByText("Documents")).toBeInTheDocument();

    // Compteur non-lu pour Urgents (badge 3)
    expect(screen.getByText("3")).toBeInTheDocument();
    // Compteur total pour Documents (12 car unread = 0)
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("navigue vers /mail/smart/:id au clic sur un dossier intelligent", async () => {
    render(<SmartFolderList />);

    const item = screen.getByText("Urgents");
    await userEvent.click(item);

    expect(mockPush).toHaveBeenCalledWith("/mail/smart/sf-1");
  });
});
