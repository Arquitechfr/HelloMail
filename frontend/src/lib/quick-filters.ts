import type { Message } from "./api-types";

/**
 * Types de filtres rapides disponibles pour la liste des messages.
 */
export type QuickFilter = "all" | "unread" | "starred" | "pinned" | "attachments";

export interface QuickFilterCounts {
  all: number;
  unread: number;
  starred: number;
  pinned: number;
  attachments: number;
}

export interface QuickFilterItem {
  id: QuickFilter;
  label: string;
  shortcut: string;
}

export const QUICK_FILTERS_CONFIG: QuickFilterItem[] = [
  { id: "all", label: "Tous", shortcut: "Alt+1" },
  { id: "unread", label: "Non lus", shortcut: "Alt+2" },
  { id: "starred", label: "Importants", shortcut: "Alt+3" },
  { id: "pinned", label: "Épinglés", shortcut: "Alt+4" },
  { id: "attachments", label: "Pièces jointes", shortcut: "Alt+5" },
];

/**
 * Filtre les messages selon le critère de filtre rapide sélectionné.
 */
export function filterMessages<T extends Message>(messages: T[], filter: QuickFilter): T[] {
  switch (filter) {
    case "unread":
      return messages.filter((m) => !m.flags.seen);
    case "starred":
      return messages.filter((m) => m.flags.flagged);
    case "pinned":
      return messages.filter((m) => Boolean(m.isPinned));
    case "attachments":
      return messages.filter((m) => Boolean(m.hasAttachments));
    case "all":
    default:
      return messages;
  }
}

/**
 * Calcule les totaux de messages pour chaque filtre rapide.
 */
export function computeFilterCounts<T extends Message>(messages: T[]): QuickFilterCounts {
  let unread = 0;
  let starred = 0;
  let pinned = 0;
  let attachments = 0;

  for (const m of messages) {
    if (!m.flags.seen) unread++;
    if (m.flags.flagged) starred++;
    if (m.isPinned) pinned++;
    if (m.hasAttachments) attachments++;
  }

  return {
    all: messages.length,
    unread,
    starred,
    pinned,
    attachments,
  };
}

/**
 * Retourne le filtre suivant dans l'ordre circulaire (pour le raccourci cycle Alt+F).
 */
export function getNextQuickFilter(current: QuickFilter): QuickFilter {
  const order: QuickFilter[] = ["all", "unread", "starred", "pinned", "attachments"];
  const currentIndex = order.indexOf(current);
  if (currentIndex === -1 || currentIndex === order.length - 1) {
    return order[0];
  }
  return order[currentIndex + 1];
}

/**
 * Retourne le filtre correspondant à l'index numérique 1..5.
 */
export function getQuickFilterByIndex(index: number): QuickFilter | null {
  const order: QuickFilter[] = ["all", "unread", "starred", "pinned", "attachments"];
  if (index >= 1 && index <= order.length) {
    return order[index - 1];
  }
  return null;
}
