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

const mockToggleSelectUid = vi.fn();
const mockSelectRangeUids = vi.fn();
let mockSelectedUids: number[] = [];

vi.mock("@/lib/stores/uiStore", () => ({
  useUIStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = {
      selectedUids: mockSelectedUids,
      toggleSelectUid: mockToggleSelectUid,
      selectRangeUids: mockSelectRangeUids,
      displayDensity: "comfortable",
      swipeRightAction: "toggle_read",
      swipeLeftAction: "trash",
    };
    return typeof selector === "function" ? selector(state) : state;
  },
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

describe("MessageListItem interactions et sélections Power User", () => {
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
    vi.clearAllMocks();
    mockSelectedUids = [];
    queryClient = new QueryClient();
  });

  it("déclenche onSelect() lors d'un clic simple", () => {
    const onSelectMock = vi.fn();
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MessageListItem
          accountId="acc-test"
          folder="INBOX"
          message={dummyMessage}
          isSelected={false}
          onSelect={onSelectMock}
          allVisibleUids={[100, 456, 200]}
        />
      </QueryClientProvider>,
    );

    const itemElement = container.querySelector('[draggable="true"]')!;
    fireEvent.click(itemElement);

    expect(onSelectMock).toHaveBeenCalledTimes(1);
    expect(mockSelectRangeUids).not.toHaveBeenCalled();
    expect(mockToggleSelectUid).not.toHaveBeenCalled();
  });

  it("déclenche selectRangeUids lors d'un Shift + Clic sur l'élément", () => {
    const onSelectMock = vi.fn();
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MessageListItem
          accountId="acc-test"
          folder="INBOX"
          message={dummyMessage}
          isSelected={false}
          onSelect={onSelectMock}
          allVisibleUids={[100, 456, 200]}
        />
      </QueryClientProvider>,
    );

    const itemElement = container.querySelector('[draggable="true"]')!;
    fireEvent.click(itemElement, { shiftKey: true });

    expect(onSelectMock).not.toHaveBeenCalled();
    expect(mockSelectRangeUids).toHaveBeenCalledWith([100, 456, 200], 456);
  });

  it("déclenche toggleSelectUid lors d'un Ctrl/Cmd + Clic sur l'élément", () => {
    const onSelectMock = vi.fn();
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MessageListItem
          accountId="acc-test"
          folder="INBOX"
          message={dummyMessage}
          isSelected={false}
          onSelect={onSelectMock}
          allVisibleUids={[100, 456, 200]}
        />
      </QueryClientProvider>,
    );

    const itemElement = container.querySelector('[draggable="true"]')!;
    fireEvent.click(itemElement, { metaKey: true });

    expect(onSelectMock).not.toHaveBeenCalled();
    expect(mockToggleSelectUid).toHaveBeenCalledWith(456);
  });

  it("gère le clic et le Shift + Clic sur le bouton de sélection rond", () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MessageListItem
          accountId="acc-test"
          folder="INBOX"
          message={dummyMessage}
          isSelected={false}
          onSelect={vi.fn()}
          allVisibleUids={[100, 456, 200]}
        />
      </QueryClientProvider>,
    );

    const selectButton = container.querySelector('button[type="button"]')!;
    expect(selectButton).toBeTruthy();

    // Clic simple sur le bouton rond -> toggleSelectUid
    fireEvent.click(selectButton);
    expect(mockToggleSelectUid).toHaveBeenCalledWith(456);

    // Shift + Clic sur le bouton rond -> selectRangeUids
    fireEvent.click(selectButton, { shiftKey: true });
    expect(mockSelectRangeUids).toHaveBeenCalledWith([100, 456, 200], 456);
  });

  it("affiche le compteur de conversation et les enfants quand le fil est déplié", () => {
    const onToggleThreadExpandMock = vi.fn();
    const childMessage: Message = {
      ...dummyMessage,
      _id: "msg-child-1",
      uid: 789,
      subject: "Re: Rapport de performance",
      folder: "Sent",
      from: { name: "Moi", address: "me@test.com" },
    };

    const { getByTitle, getByText } = render(
      <QueryClientProvider client={queryClient}>
        <MessageListItem
          accountId="acc-test"
          folder="INBOX"
          message={dummyMessage}
          isSelected={false}
          onSelect={vi.fn()}
          threadMessages={[dummyMessage, childMessage]}
          isThreadExpanded={true}
          onToggleThreadExpand={onToggleThreadExpandMock}
        />
      </QueryClientProvider>,
    );

    // Le bouton de thread doit afficher 2 messages
    const threadBtn = getByTitle(/2 messages dans cette conversation/);
    expect(threadBtn).toBeInTheDocument();
    fireEvent.click(threadBtn);
    expect(onToggleThreadExpandMock).toHaveBeenCalledTimes(1);

    // L'enfant doit être affiché avec son badge "Envoyé"
    expect(getByText("Envoyé")).toBeInTheDocument();
  });
});
