import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useEmailShortcuts } from "./useEmailShortcuts";

describe("useEmailShortcuts", () => {
  const onReply = vi.fn();
  const onReplyAll = vi.fn();
  const onForward = vi.fn();
  const onToggleSeen = vi.fn();
  const onToggleFlagged = vi.fn();
  const onTogglePin = vi.fn();
  const onArchive = vi.fn();
  const onDelete = vi.fn();
  const onMarkJunk = vi.fn();
  const onPrint = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("déclenche onReply sur appui de 'R'", () => {
    renderHook(() =>
      useEmailShortcuts({
        enabled: true,
        onReply,
        onReplyAll,
        onForward,
        onToggleSeen,
        onToggleFlagged,
        onArchive,
        onDelete,
        onMarkJunk,
        onPrint,
      }),
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "r" }));
    expect(onReply).toHaveBeenCalledTimes(1);
    expect(onReplyAll).not.toHaveBeenCalled();
  });

  it("déclenche onReplyAll sur appui de Shift + 'R'", () => {
    renderHook(() =>
      useEmailShortcuts({
        enabled: true,
        onReply,
        onReplyAll,
      }),
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "R", shiftKey: true }));
    expect(onReplyAll).toHaveBeenCalledTimes(1);
    expect(onReply).not.toHaveBeenCalled();
  });

  it("déclenche onToggleSeen sur appui de 'U'", () => {
    renderHook(() =>
      useEmailShortcuts({
        enabled: true,
        onToggleSeen,
      }),
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "u" }));
    expect(onToggleSeen).toHaveBeenCalledTimes(1);
  });

  it("déclenche onToggleFlagged sur appui de 'S'", () => {
    renderHook(() =>
      useEmailShortcuts({
        enabled: true,
        onToggleFlagged,
      }),
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "s" }));
    expect(onToggleFlagged).toHaveBeenCalledTimes(1);
  });

  it("déclenche onTogglePin sur appui de 'H'", () => {
    renderHook(() =>
      useEmailShortcuts({
        enabled: true,
        onTogglePin,
      }),
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "h" }));
    expect(onTogglePin).toHaveBeenCalledTimes(1);
  });

  it("déclenche onArchive sur 'E' et onDelete sur 'Delete'", () => {
    renderHook(() =>
      useEmailShortcuts({
        enabled: true,
        onArchive,
        onDelete,
      }),
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "e" }));
    expect(onArchive).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("ignore les raccourcis si la cible est un champ de saisie INPUT", () => {
    renderHook(() =>
      useEmailShortcuts({
        enabled: true,
        onReply,
      }),
    );

    const input = document.createElement("input");
    document.body.appendChild(input);

    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "r", bubbles: true }),
    );

    expect(onReply).not.toHaveBeenCalled();
  });

  it("déclenche la navigation descendante sur 'j' et 'ArrowDown', ascendante sur 'k' et 'ArrowUp'", () => {
    const onNavigateNext = vi.fn();
    const onNavigatePrev = vi.fn();

    renderHook(() =>
      useEmailShortcuts({
        enabled: true,
        onNavigateNext,
        onNavigatePrev,
      }),
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "j" }));
    expect(onNavigateNext).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    expect(onNavigateNext).toHaveBeenCalledTimes(2);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k" }));
    expect(onNavigatePrev).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    expect(onNavigatePrev).toHaveBeenCalledTimes(2);
  });

  it("déclenche onToggleSelectCurrent sur 'x'", () => {
    const onToggleSelectCurrent = vi.fn();

    renderHook(() =>
      useEmailShortcuts({
        enabled: true,
        onToggleSelectCurrent,
      }),
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "x" }));
    expect(onToggleSelectCurrent).toHaveBeenCalledTimes(1);
  });

  it("déclenche l'extension de sélection avec Shift + 'j' ou Shift + 'k'", () => {
    const onExtendSelectionDown = vi.fn();
    const onExtendSelectionUp = vi.fn();

    renderHook(() =>
      useEmailShortcuts({
        enabled: true,
        onExtendSelectionDown,
        onExtendSelectionUp,
      }),
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "j", shiftKey: true }));
    expect(onExtendSelectionDown).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", shiftKey: true }));
    expect(onExtendSelectionUp).toHaveBeenCalledTimes(1);
  });

  it("déclenche onSelectAll sur 'Cmd+A' et onClearSelection sur 'Escape'", () => {
    const onSelectAll = vi.fn();
    const onClearSelection = vi.fn();

    renderHook(() =>
      useEmailShortcuts({
        enabled: true,
        onSelectAll,
        onClearSelection,
      }),
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", metaKey: true }));
    expect(onSelectAll).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });
});
