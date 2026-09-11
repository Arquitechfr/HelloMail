import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MessageQuickActions } from "./MessageQuickActions";
import { MessageContextMenu } from "./MessageContextMenu";
import type { Message } from "@/lib/api-types";

const mockToggleSeen = vi.fn();
const mockToggleFlagged = vi.fn();
const mockArchiveMessage = vi.fn();
const mockDeleteMsg = vi.fn();
const mockMarkJunkMsg = vi.fn();
const mockMoveTo = vi.fn();
const mockToggleTag = vi.fn();
const mockApplySnooze = vi.fn();
const mockReply = vi.fn();
const mockReplyAll = vi.fn();
const mockForward = vi.fn();
const mockDownloadEml = vi.fn();
const mockPrint = vi.fn();

vi.mock("@/lib/hooks/useMessageActions", () => ({
  useMessageActions: () => ({
    toggleSeen: mockToggleSeen,
    toggleFlagged: mockToggleFlagged,
    archiveMessage: mockArchiveMessage,
    deleteMsg: mockDeleteMsg,
    markJunkMsg: mockMarkJunkMsg,
    moveTo: mockMoveTo,
    toggleTag: mockToggleTag,
    applySnooze: mockApplySnooze,
    reply: mockReply,
    replyAll: mockReplyAll,
    forward: mockForward,
    downloadEml: mockDownloadEml,
    print: mockPrint,
  }),
}));

vi.mock("@/lib/queries/folders", () => ({
  useFolders: () => ({ data: [] }),
}));

vi.mock("@/lib/queries/tags", () => ({
  useTags: () => ({ data: { data: [] } }),
}));

describe("MessageQuickActions", () => {
  const dummyMessage: Message = {
    _id: "msg-1",
    accountId: "acc-1",
    folder: "INBOX",
    uid: 42,
    subject: "Test email",
    from: { name: "Expéditeur", address: "expediteur@test.com" },
    to: [{ name: "Moi", address: "moi@test.com" }],
    date: new Date().toISOString(),
    flags: { seen: false, answered: false, flagged: false },
    hasAttachments: false,
    size: 1024,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche les boutons d'actions rapides et réagit aux clics", async () => {
    render(
      <MessageQuickActions
        accountId="acc-1"
        folder="INBOX"
        message={dummyMessage}
      />,
    );

    // 1. Bouton Lu / Non lu
    const markSeenBtn = screen.getByRole("button", { name: /Marquer comme lu/i });
    expect(markSeenBtn).toBeInTheDocument();
    await userEvent.click(markSeenBtn);
    expect(mockToggleSeen).toHaveBeenCalledTimes(1);

    // 2. Bouton Important
    const flagBtn = screen.getByRole("button", { name: /Important/i });
    expect(flagBtn).toBeInTheDocument();
    await userEvent.click(flagBtn);
    expect(mockToggleFlagged).toHaveBeenCalledTimes(1);

    // 3. Bouton Archiver
    const archiveBtn = screen.getByRole("button", { name: /Archiver/i });
    expect(archiveBtn).toBeInTheDocument();
    await userEvent.click(archiveBtn);
    expect(mockArchiveMessage).toHaveBeenCalledTimes(1);

    // 4. Bouton Supprimer
    const deleteBtn = screen.getByRole("button", { name: /Supprimer/i });
    expect(deleteBtn).toBeInTheDocument();
    await userEvent.click(deleteBtn);
    expect(mockDeleteMsg).toHaveBeenCalledTimes(1);

    // 5. Bouton Plus d'actions (⋮)
    const moreBtn = screen.getByRole("button", { name: /Plus d'actions/i });
    expect(moreBtn).toBeInTheDocument();
  });
});

describe("MessageContextMenu", () => {
  const dummyMessage: Message = {
    _id: "msg-2",
    accountId: "acc-1",
    folder: "INBOX",
    uid: 43,
    subject: "Autre email",
    from: { name: "Contact", address: "contact@test.com" },
    to: [{ name: "Moi", address: "moi@test.com" }],
    date: new Date().toISOString(),
    flags: { seen: true, answered: false, flagged: true },
    hasAttachments: false,
    size: 2048,
  };

  it("rend les enfants et gère l'événement contextmenu sans planter", () => {
    render(
      <MessageContextMenu
        accountId="acc-1"
        folder="INBOX"
        message={dummyMessage}
      >
        <div data-testid="email-row">Ligne email</div>
      </MessageContextMenu>,
    );

    const row = screen.getByTestId("email-row");
    expect(row).toBeInTheDocument();

    // Simule un clic droit
    fireEvent.contextMenu(row);
  });
});
