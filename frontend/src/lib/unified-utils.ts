import type { UnifiedFolderType, UnifiedFolderConfig } from "./api-types";
import {
  Inbox,
  Star,
  Pin,
  FileText,
  Send,
  Clock,
  Archive,
  Ban,
  Trash2,
  type LucideIcon,
} from "lucide-react";

export interface UnifiedFolderMeta {
  id: UnifiedFolderType;
  defaultLabel: string;
  icon: LucideIcon;
  description: string;
}

export const UNIFIED_FOLDER_DEFINITIONS: Record<UnifiedFolderType, UnifiedFolderMeta> = {
  inbox: {
    id: "inbox",
    defaultLabel: "Toutes les boîtes de réception",
    icon: Inbox,
    description: "Messages reçus sur tous vos comptes",
  },
  starred: {
    id: "starred",
    defaultLabel: "Tous les messages suivis",
    icon: Star,
    description: "Messages marqués d'une étoile",
  },
  pinned: {
    id: "pinned",
    defaultLabel: "Tous les messages épinglés",
    icon: Pin,
    description: "Messages mis en avant au sommet",
  },
  drafts: {
    id: "drafts",
    defaultLabel: "Tous les brouillons",
    icon: FileText,
    description: "Brouillons en cours de rédaction",
  },
  sent: {
    id: "sent",
    defaultLabel: "Tous les messages envoyés",
    icon: Send,
    description: "Emails expédiés depuis vos comptes",
  },
  snoozed: {
    id: "snoozed",
    defaultLabel: "Tous les messages en sommeil",
    icon: Clock,
    description: "Emails temporairement mis en attente",
  },
  archive: {
    id: "archive",
    defaultLabel: "Toutes les archives",
    icon: Archive,
    description: "Messages archivés de tous vos comptes",
  },
  junk: {
    id: "junk",
    defaultLabel: "Tous les indésirables",
    icon: Ban,
    description: "Courriers signalés comme spam",
  },
  trash: {
    id: "trash",
    defaultLabel: "Toutes les corbeilles",
    icon: Trash2,
    description: "Messages supprimés",
  },
};

export const ALL_UNIFIED_TYPES: UnifiedFolderType[] = [
  "inbox",
  "starred",
  "pinned",
  "drafts",
  "sent",
  "snoozed",
  "archive",
  "junk",
  "trash",
];

export const DEFAULT_UNIFIED_FOLDERS: UnifiedFolderConfig[] = [
  { id: "inbox", label: "Toutes les boîtes", enabled: true, order: 0 },
  { id: "starred", label: "Messages suivis", enabled: true, order: 1 },
  { id: "pinned", label: "Messages épinglés", enabled: true, order: 2 },
  { id: "drafts", label: "Brouillons", enabled: false, order: 3 },
  { id: "sent", label: "Envoyés", enabled: false, order: 4 },
  { id: "snoozed", label: "En sommeil", enabled: false, order: 5 },
  { id: "archive", label: "Archives", enabled: false, order: 6 },
  { id: "junk", label: "Indésirables", enabled: false, order: 7 },
  { id: "trash", label: "Corbeille", enabled: false, order: 8 },
];

/**
 * Fusionne la configuration utilisateur avec la liste exhaustive pour garantir
 * qu'aucun type n'est manquant.
 */
export function resolveUnifiedFolders(
  userConfig?: UnifiedFolderConfig[],
): UnifiedFolderConfig[] {
  if (!userConfig || userConfig.length === 0) {
    return DEFAULT_UNIFIED_FOLDERS;
  }

  const existingTypes = new Set(userConfig.map((c) => c.id));
  const merged: UnifiedFolderConfig[] = [...userConfig];

  let nextOrder = merged.reduce((max, c) => Math.max(max, c.order), 0) + 1;
  for (const defType of ALL_UNIFIED_TYPES) {
    if (!existingTypes.has(defType)) {
      const defaultItem = DEFAULT_UNIFIED_FOLDERS.find((d) => d.id === defType);
      merged.push({
        id: defType,
        label: defaultItem?.label ?? UNIFIED_FOLDER_DEFINITIONS[defType].defaultLabel,
        enabled: false,
        order: nextOrder++,
      });
    }
  }

  return merged.sort((a, b) => a.order - b.order);
}
