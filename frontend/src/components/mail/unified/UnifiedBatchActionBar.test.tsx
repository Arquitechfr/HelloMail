import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UnifiedBatchActionBar } from "./UnifiedBatchActionBar";
import type { Message } from "@/lib/api-types";

const mockClearSelectedUids = vi.fn();
let mockSelectedUids: number[] = [];
const mockApiFetch = vi.fn();

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

vi.mock("@/lib/stores/uiStore", () => ({
  useUIStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      selectedUids: mockSelectedUids,
      clearSelectedUids: mockClearSelectedUids,
    }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

describe("UnifiedBatchActionBar", () => {
  const dummyMessages: (Message & { accountId: string; folder: string })[] = [
    {
      _id: "m1",
      accountId: "acc-1",
      folder: "INBOX",
      uid: 10,
      subject: "Test 1",
      from: { name: "Alice", address: "alice@test.com" },
      to: [{ name: "Moi", address: "moi@test.com" }],
      date: new Date().toISOString(),
      flags: { seen: false, answered: false, flagged: false },
      hasAttachments: false,
      size: 100,
    },
    {
      _id: "m2",
      accountId: "acc-2",
      folder: "INBOX",
      uid: 20,
      subject: "Test 2",
      from: { name: "Bob", address: "bob@test.com" },
      to: [{ name: "Moi", address: "moi@test.com" }],
      date: new Date().toISOString(),
      flags: { seen: false, answered: false, flagged: false },
      hasAttachments: false,
      size: 200,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectedUids = [];
    mockApiFetch.mockResolvedValue({});
  });

  it("ne rend rien si aucun message n'est sélectionné", () => {
    mockSelectedUids = [];
    const { container } = render(
      <UnifiedBatchActionBar messages={dummyMessages} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("affiche le compteur et les actions quand des messages sont sélectionnés", () => {
    mockSelectedUids = [10, 20];
    render(
      <UnifiedBatchActionBar messages={dummyMessages} />
    );

    expect(screen.getByText(/2/)).toBeInTheDocument();
    expect(screen.getByText(/sélectionnés/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Marquer comme lu/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mettre en avant/i })).toBeInTheDocument();
  });

  it("déclenche les appels API groupés par compte lors du clic sur Marquer comme lu", async () => {
    mockSelectedUids = [10, 20];
    render(
      <UnifiedBatchActionBar messages={dummyMessages} />
    );

    const markReadBtn = screen.getByRole("button", { name: /Marquer comme lu/i });
    await userEvent.click(markReadBtn);

    expect(mockApiFetch).toHaveBeenCalledTimes(2);
    expect(mockClearSelectedUids).toHaveBeenCalled();
  });
});
