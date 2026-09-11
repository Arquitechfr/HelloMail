import { AccountModel } from '../models/Account.js';

/**
 * Palette de 12 couleurs modernes et contrastées pour les comptes email.
 */
export const DEFAULT_ACCOUNT_COLORS = [
  '#3b82f6', // Bleu
  '#8b5cf6', // Violet
  '#10b981', // Émeraude
  '#f59e0b', // Ambre
  '#ec4899', // Rose
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#6366f1', // Indigo
  '#14b8a6', // Sarcelle
  '#84cc16', // Lime
  '#a855f7', // Pourpre
  '#ef4444', // Rouge corail
] as const;

/**
 * Attribue automatiquement une couleur parmi la palette par défaut
 * en évitant les doublons avec les comptes déjà existants de l'utilisateur.
 */
export async function getNextAccountColor(userId: string): Promise<string> {
  const accounts = await AccountModel.find({ userId }).select('color').lean();
  const usedColors = new Set(
    accounts
      .map((a) => (a.color ? a.color.toLowerCase() : ''))
      .filter((c) => Boolean(c)),
  );

  // Recherche la première couleur de la palette non encore attribuée.
  const availableColor = DEFAULT_ACCOUNT_COLORS.find(
    (color) => !usedColors.has(color.toLowerCase()),
  );

  if (availableColor) {
    return availableColor;
  }

  // Si toutes les couleurs sont utilisées (> 12 comptes), cycle équitable.
  const index = accounts.length % DEFAULT_ACCOUNT_COLORS.length;
  return DEFAULT_ACCOUNT_COLORS[index];
}
