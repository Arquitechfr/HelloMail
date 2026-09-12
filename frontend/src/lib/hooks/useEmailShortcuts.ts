"use client";

import { useEffect } from "react";

interface EmailShortcutsOptions {
  enabled?: boolean;
  onReply?: () => void;
  onReplyAll?: () => void;
  onForward?: () => void;
  onToggleSeen?: () => void;
  onToggleFlagged?: () => void;
  onTogglePin?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  onMarkJunk?: () => void;
  onPrint?: () => void;
  onNavigateNext?: () => void;
  onNavigatePrev?: () => void;
  onToggleSelectCurrent?: () => void;
  onExtendSelectionDown?: () => void;
  onExtendSelectionUp?: () => void;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
}

/**
 * Hook gérant les raccourcis clavier rapides sur les emails (R, F, U, S, E, !, Suppr, P)
 * ainsi que la navigation et multi-sélection Power User (J, K, X, Shift+J, Shift+K, Cmd+A, Échap).
 * Protégé contre l'interception intempestive lors de la saisie dans un champ texte ou une modale.
 */
export function useEmailShortcuts({
  enabled = true,
  onReply,
  onReplyAll,
  onForward,
  onToggleSeen,
  onToggleFlagged,
  onTogglePin,
  onArchive,
  onDelete,
  onMarkJunk,
  onPrint,
  onNavigateNext,
  onNavigatePrev,
  onToggleSelectCurrent,
  onExtendSelectionDown,
  onExtendSelectionUp,
  onSelectAll,
  onClearSelection,
}: EmailShortcutsOptions) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore si frappe dans un input, textarea ou éditeur de texte
      const isElement = e.target instanceof Element;
      const isInput =
        isElement &&
        (e.target.tagName === "INPUT" ||
          e.target.tagName === "TEXTAREA" ||
          (e.target as HTMLElement).isContentEditable ||
          Boolean(e.target.closest(".tiptap")) ||
          Boolean(e.target.closest("[contenteditable='true']")));

      if (isInput) return;

      // Ignore si une modale ou dialogue est affiché
      const hasModal = !!document.querySelector(
        "[data-slot='dialog-content'], [role='dialog']",
      );
      if (hasModal) return;

      // Raccourcis avec Ctrl / Cmd (ex: Ctrl+P pour imprimer, Ctrl+A pour tout sélectionner)
      if (e.ctrlKey || e.metaKey) {
        if ((e.key === "p" || e.key === "P") && onPrint) {
          e.preventDefault();
          onPrint();
        } else if ((e.key === "a" || e.key === "A") && onSelectAll) {
          e.preventDefault();
          onSelectAll();
        }
        return;
      }

      // Raccourcis directs sans Ctrl / Cmd
      switch (e.key) {
        case "Escape":
          if (onClearSelection) {
            e.preventDefault();
            onClearSelection();
          }
          break;

        case "j":
        case "J":
        case "ArrowDown":
          if (e.shiftKey) {
            if (onExtendSelectionDown) {
              e.preventDefault();
              onExtendSelectionDown();
            }
          } else {
            if (onNavigateNext) {
              e.preventDefault();
              onNavigateNext();
            }
          }
          break;

        case "k":
        case "K":
        case "ArrowUp":
          if (e.shiftKey) {
            if (onExtendSelectionUp) {
              e.preventDefault();
              onExtendSelectionUp();
            }
          } else {
            if (onNavigatePrev) {
              e.preventDefault();
              onNavigatePrev();
            }
          }
          break;

        case "x":
        case "X":
          if (onToggleSelectCurrent) {
            e.preventDefault();
            onToggleSelectCurrent();
          }
          break;

        case "r":
        case "R":
          if (e.shiftKey) {
            if (onReplyAll) {
              e.preventDefault();
              onReplyAll();
            }
          } else {
            if (onReply) {
              e.preventDefault();
              onReply();
            }
          }
          break;

        case "f":
        case "F":
          if (onForward) {
            e.preventDefault();
            onForward();
          }
          break;

        case "u":
        case "U":
          if (onToggleSeen) {
            e.preventDefault();
            onToggleSeen();
          }
          break;

        case "s":
        case "S":
          if (onToggleFlagged) {
            e.preventDefault();
            onToggleFlagged();
          }
          break;

        case "h":
        case "H":
          if (onTogglePin) {
            e.preventDefault();
            onTogglePin();
          }
          break;

        case "e":
        case "E":
          if (onArchive) {
            e.preventDefault();
            onArchive();
          }
          break;

        case "!":
          if (onMarkJunk) {
            e.preventDefault();
            onMarkJunk();
          }
          break;

        case "Delete":
        case "Backspace":
        case "#":
          if (onDelete) {
            e.preventDefault();
            onDelete();
          }
          break;

        case "p":
        case "P":
          if (onPrint) {
            e.preventDefault();
            onPrint();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    enabled,
    onReply,
    onReplyAll,
    onForward,
    onToggleSeen,
    onToggleFlagged,
    onTogglePin,
    onArchive,
    onDelete,
    onMarkJunk,
    onPrint,
    onNavigateNext,
    onNavigatePrev,
    onToggleSelectCurrent,
    onExtendSelectionDown,
    onExtendSelectionUp,
    onSelectAll,
    onClearSelection,
  ]);
}
