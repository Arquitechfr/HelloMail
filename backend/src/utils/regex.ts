/**
 * Échappe tous les caractères spéciaux d'une chaîne pour une utilisation sécurisée
 * dans les expressions régulières et requêtes MongoDB $regex.
 *
 * Prévient les erreurs de syntaxe de parsing (ex: caractères "+", "[", "(")
 * et protège contre les attaques de déni de service par expressions régulières (ReDoS).
 */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
