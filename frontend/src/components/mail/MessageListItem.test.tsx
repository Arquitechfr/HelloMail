import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import { MessageListItem } from "./MessageListItem";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Message } from "@/lib/api-types";

vi.mock("@/lib/hooks/useMessageActions", () => ({
  useMessageActions: () => ({
    toggleSeen: vi.fn(),
    toggleFlagged: vi.fn(),
    archiveMessage: vi.fn(),
    deleteMsg: vi.fn(),
    markJunkMsg: vi.fn(),
    moveTo: vi.fn(),
    toggleTag: vi.fn(),
    applySnooze: vi.fn(),
    reply: vi.fn(),
    replyAll: vi.fn(),
    forward: vi.fn(),
    downloadEml: vi.fn(),
    print: vi.fn(),
    editDraft: vi.fn(),
  }),
}));

vi.mock("@/lib/queries/folders", () => ({
  useFolders: () => ({ data: [] }),
}));

vi.mock("@/lib/queries/tags", () => ({
  useTags: () => ({ data: { data: [] } }),
}));

describe("MessageListItem prefetching", () => {
  let queryClient: QueryClient;
  const dummyMessage: Message = {
    _id: "msg-123",
    accountId: "acc-test",
    folder: "INBOX",
    uid: 456,
    subject: "Rapport de performance",
    from: { name: "Audit Bot", address: "bot@test.com" },
    to: [{ name: "Utilisateur", address: "user@test.com" }],
    date: new Date().toISOString(),
    flags: { seen: false, answered: false, flagged: false },
    hasAttachments: false,
    size: 1024,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    queryClient = new QueryClient();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("déclenche le prefetch TanStack Query après 65ms de survol (debounce)", () => {
    const prefetchSpy = vi.spyOn(queryClient, "prefetchQuery").mockResolvedValue(undefined as unknown as void);

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MessageListItem
          accountId="acc-test"
          folder="INBOX"
          message={dummyMessage}
          isSelected={false}
          onSelect={vi.fn()}
        />
      </QueryClientProvider>,
    );

    const itemElement = container.querySelector('[draggable="true"]')!;
    expect(itemElement).toBeTruthy();

    // Survol
    fireEvent.mouseEnter(itemElement);

    // À 30ms : le prefetch ne doit pas encore avoir eu lieu
    act(() => {
      vi.advanceTimersByTime(30);
    });
    expect(prefetchSpy).not.toHaveBeenCalled();

    // À 70ms cumulées : le debounce (65ms) est dépassé, prefetch exécuté
    act(() => {
      vi.advanceTimersByTime(40);
    });
    expect(prefetchSpy).toHaveBeenCalledTimes(1);
    expect(prefetchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["message", "acc-test", "INBOX", 456],
        staleTime: 60_000,
      }),
    );
  });

  it("annule le prefetch si la souris quitte l'élément avant 65ms", () => {
    const prefetchSpy = vi.spyOn(queryClient, "prefetchQuery").mockResolvedValue(undefined as unknown as void);

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MessageListItem
          accountId="acc-test"
          folder="INBOX"
          message={dummyMessage}
          isSelected={false}
          onSelect={vi.fn()}
        />
      </QueryClientProvider>,
    );

    const itemElement = container.querySelector('[draggable="true"]')!;

    // Entrée puis sortie immédiate après 30ms
    fireEvent.mouseEnter(itemElement);
    act(() => {
      vi.advanceTimersByTime(30);
    });
    fireEvent.mouseLeave(itemElement);

    // On avance au-delà du délai de 65ms
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Le prefetch ne doit jamais avoir été appelé
    expect(prefetchSpy).not.toHaveBeenCalled();
  });
});
