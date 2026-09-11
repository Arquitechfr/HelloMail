/**
 * Protection des dossiers système contre la suppression et le renommage.
 */

const PROTECTED_SYSTEM_NAMES = new Set([
  'inbox',
  'sent',
  'sent items',
  'sent mail',
  'envoyés',
  'envoye',
  'outbox',
  'trash',
  'corbeille',
  'deleted',
  'deleted items',
  'bin',
  'drafts',
  'brouillons',
  'brouillon',
  'junk',
  'spam',
  'junk mail',
  'junk email',
  'courrier indésirable',
  'indésirables',
  'archive',
  'archives',
  'archivés',
]);

const PROTECTED_SPECIAL_USES = new Set([
  '\\inbox',
  '\\sent',
  '\\trash',
  '\\drafts',
  '\\junk',
  '\\archive',
  '\\flagged',
]);

/**
 * Détermine si un dossier est un dossier système protégé (ne pouvant être ni renommé ni supprimé).
 */
export function isProtectedFolder(path: string, specialUse?: string): boolean {
  const normalized = path.toLowerCase().trim();
  if (normalized === 'inbox') return true;
  if (specialUse && PROTECTED_SPECIAL_USES.has(specialUse.toLowerCase().trim())) {
    return true;
  }
  return PROTECTED_SYSTEM_NAMES.has(normalized);
}
