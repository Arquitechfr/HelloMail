/**
 * Utilitaires pour la gestion des dossiers et sous-dossiers IMAP.
 */

const PROTECTED_SYSTEM_NAMES = new Set([
  "inbox",
  "sent",
  "sent items",
  "sent mail",
  "envoyés",
  "envoye",
  "outbox",
  "trash",
  "corbeille",
  "deleted",
  "deleted items",
  "bin",
  "drafts",
  "brouillons",
  "brouillon",
  "junk",
  "spam",
  "junk mail",
  "junk email",
  "courrier indésirable",
  "indésirables",
  "archive",
  "archives",
  "archivés",
  "snoozed",
]);

const PROTECTED_SPECIAL_USES = new Set([
  "\\inbox",
  "\\sent",
  "\\trash",
  "\\drafts",
  "\\junk",
  "\\archive",
  "\\flagged",
]);

/**
 * Détermine si un dossier est un dossier système protégé.
 * Les dossiers protégés (comme INBOX, Sent, Trash) ne peuvent être ni renommés ni supprimés.
 */
export function isProtectedFolder(folder: {
  path: string;
  name?: string;
  specialUse?: string;
}): boolean {
  const normPath = folder.path.toLowerCase().trim();
  if (normPath === "inbox") return true;

  if (folder.specialUse && PROTECTED_SPECIAL_USES.has(folder.specialUse.toLowerCase().trim())) {
    return true;
  }

  if (PROTECTED_SYSTEM_NAMES.has(normPath)) {
    return true;
  }

  if (folder.name) {
    const normName = folder.name.toLowerCase().trim();
    if (PROTECTED_SYSTEM_NAMES.has(normName)) {
      return true;
    }
  }

  return false;
}

/**
 * Extrait le chemin parent à partir du délimiteur.
 * Ex: "Work/Clients" avec "/" -> "Work", "INBOX" -> null
 */
export function getParentPath(path: string, delimiter: string = "/"): string | null {
  if (!path.includes(delimiter)) return null;
  const lastIndex = path.lastIndexOf(delimiter);
  return lastIndex > 0 ? path.substring(0, lastIndex) : null;
}

/**
 * Extrait le nom court affiché du dossier (après le dernier délimiteur).
 * Ex: "Work/Clients" avec "/" -> "Clients"
 */
export function getBaseFolderName(path: string, delimiter: string = "/"): string {
  if (!path.includes(delimiter)) return path;
  const lastIndex = path.lastIndexOf(delimiter);
  return path.substring(lastIndex + delimiter.length);
}

/**
 * Construit le chemin complet d'un sous-dossier.
 * Ex: parent "Work", nom "Projets", délimiteur "/" -> "Work/Projets"
 */
export function buildSubFolderPath(
  parentPath: string | null | undefined,
  subName: string,
  delimiter: string = "/"
): string {
  const cleanName = subName.trim();
  if (!parentPath) return cleanName;
  return `${parentPath}${delimiter}${cleanName}`;
}

/**
 * Valide le nom d'un dossier. Retourne un message d'erreur ou null si valide.
 */
export function validateFolderName(name: string, delimiter: string = "/"): string | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return "Le nom du dossier est requis";
  }
  if (trimmed.includes(delimiter)) {
    return `Le nom ne peut pas contenir le délimiteur « ${delimiter} »`;
  }
  if (trimmed.length > 100) {
    return "Le nom du dossier est trop long (max 100 caractères)";
  }
  if (trimmed.toLowerCase() === "inbox") {
    return "Le nom « INBOX » est réservé pour le système";
  }
  return null;
}

const TRASH_FOLDER_NAMES = new Set([
  "trash",
  "corbeille",
  "deleted",
  "deleted items",
  "deleted messages",
  "bin",
  "[gmail]/trash",
  "[gmail]/corbeille",
]);

/**
 * Détermine si un dossier représente la corbeille (Trash).
 * Vérifie par flag RFC specialUse (\Trash), par chemin ou par nom de repli.
 * Utilisé notamment pour afficher « Supprimer définitivement » : la
 * suppression dans la corbeille est permanente côté backend.
 */
export function isTrashFolder(
  folder: string | { path: string; name?: string; specialUse?: string } | null | undefined,
  folders?: { path: string; name?: string; specialUse?: string }[],
): boolean {
  if (!folder) return false;

  const folderObj =
    typeof folder === "object"
      ? folder
      : folders?.find((f) => f.path.toLowerCase() === folder.toLowerCase());

  if (folderObj?.specialUse && folderObj.specialUse.toLowerCase().trim() === "\\trash") {
    return true;
  }

  const rawPath = typeof folder === "string" ? folder : folder.path;
  const normPath = rawPath.toLowerCase().trim();
  if (TRASH_FOLDER_NAMES.has(normPath)) return true;

  const baseName = getBaseFolderName(rawPath).toLowerCase().trim();
  if (TRASH_FOLDER_NAMES.has(baseName)) return true;

  if (folderObj?.name && TRASH_FOLDER_NAMES.has(folderObj.name.toLowerCase().trim())) {
    return true;
  }

  return false;
}

const DRAFT_FOLDER_NAMES = new Set([
  "drafts",
  "brouillons",
  "brouillon",
  "draft",
  "[gmail]/drafts",
  "[gmail]/brouillons",
]);

/**
 * Détermine si un dossier représente les brouillons (Drafts).
 * Vérifie par flag RFC specialUse (\Drafts), par chemin ou par nom de repli.
 */
export function isDraftFolder(
  folder: string | { path: string; name?: string; specialUse?: string } | null | undefined,
  folders?: { path: string; name?: string; specialUse?: string }[],
): boolean {
  if (!folder) return false;

  const folderObj =
    typeof folder === "object"
      ? folder
      : folders?.find((f) => f.path.toLowerCase() === folder.toLowerCase());

  if (folderObj?.specialUse && folderObj.specialUse.toLowerCase().trim() === "\\drafts") {
    return true;
  }

  const rawPath = typeof folder === "string" ? folder : folder.path;
  const normPath = rawPath.toLowerCase().trim();
  if (DRAFT_FOLDER_NAMES.has(normPath)) return true;

  const baseName = getBaseFolderName(rawPath).toLowerCase().trim();
  if (DRAFT_FOLDER_NAMES.has(baseName)) return true;

  if (folderObj?.name && DRAFT_FOLDER_NAMES.has(folderObj.name.toLowerCase().trim())) {
    return true;
  }

  return false;
}

