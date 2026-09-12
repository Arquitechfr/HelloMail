/**
 * Types relatifs à la densité d'affichage et aux gestes tactiles de balayage (Phase 27).
 */

export type DisplayDensity = "compact" | "comfortable" | "spacious";

export type SwipeAction = "toggle_read" | "archive" | "star" | "trash" | "junk" | "none";

export interface SwipeActionsConfig {
  swipeRightAction: SwipeAction;
  swipeLeftAction: SwipeAction;
}

export interface DisplayDensityOption {
  id: DisplayDensity;
  label: string;
  description: string;
  height: number;
}

export const DISPLAY_DENSITIES: DisplayDensityOption[] = [
  {
    id: "compact",
    label: "Compact",
    description: "Affichage ultra-dense sur 1 ligne, idéal pour les grands écrans.",
    height: 44,
  },
  {
    id: "comfortable",
    label: "Confortable",
    description: "Équilibre optimal entre informations, extrait et confort visuel.",
    height: 72,
  },
  {
    id: "spacious",
    label: "Aéré",
    description: "Grands espacements et grand avatar, parfait pour l'usage tactile.",
    height: 92,
  },
];

export interface SwipeActionOption {
  id: SwipeAction;
  label: string;
  color: string;
}

export const SWIPE_ACTIONS_RIGHT: SwipeActionOption[] = [
  { id: "toggle_read", label: "Marquer comme lu / non lu", color: "emerald" },
  { id: "archive", label: "Archiver le message", color: "indigo" },
  { id: "star", label: "Marquer comme important", color: "amber" },
  { id: "none", label: "Aucune action", color: "muted" },
];

export const SWIPE_ACTIONS_LEFT: SwipeActionOption[] = [
  { id: "trash", label: "Mettre à la corbeille", color: "rose" },
  { id: "junk", label: "Signaler comme indésirable", color: "amber" },
  { id: "archive", label: "Archiver le message", color: "indigo" },
  { id: "none", label: "Aucune action", color: "muted" },
];
