import {
  FileImage,
  FileText,
  FileCode,
  FileAudio,
  FileVideo,
  FileArchive,
  FileSpreadsheet,
  FileCheck,
  File,
  type LucideIcon,
} from "lucide-react";

export type AttachmentCategory =
  | "image"
  | "pdf"
  | "text"
  | "audio"
  | "video"
  | "archive"
  | "spreadsheet"
  | "document"
  | "presentation"
  | "other";

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"]);
const AUDIO_EXTS = new Set(["mp3", "wav", "ogg", "m4a", "aac", "flac", "weba"]);
const VIDEO_EXTS = new Set(["mp4", "webm", "ogv", "mov", "mkv"]);
const TEXT_EXTS = new Set([
  "txt",
  "md",
  "markdown",
  "json",
  "csv",
  "tsv",
  "html",
  "htm",
  "xml",
  "css",
  "js",
  "jsx",
  "ts",
  "tsx",
  "py",
  "sh",
  "bash",
  "yaml",
  "yml",
  "log",
  "sql",
  "env",
  "ini",
]);
const ARCHIVE_EXTS = new Set(["zip", "tar", "gz", "tgz", "bz2", "7z", "rar"]);
const SPREADSHEET_EXTS = new Set(["xls", "xlsx", "ods"]);
const DOCUMENT_EXTS = new Set(["doc", "docx", "odt", "rtf"]);
const PRESENTATION_EXTS = new Set(["ppt", "pptx", "odp"]);

/**
 * Extrait l'extension d'un nom de fichier en minuscules sans le point.
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  if (parts.length < 2) return "";
  return parts[parts.length - 1].toLowerCase().trim();
}

/**
 * Détermine la catégorie fonctionnelle d'une pièce jointe selon son Content-Type et son nom.
 */
export function getAttachmentCategory(contentType: string, filename: string): AttachmentCategory {
  const mime = contentType.toLowerCase().split(";")[0].trim();
  const ext = getFileExtension(filename);

  // 1. PDF
  if (mime === "application/pdf" || ext === "pdf") {
    return "pdf";
  }

  // 2. Images
  if (mime.startsWith("image/") || IMAGE_EXTS.has(ext)) {
    return "image";
  }

  // 3. Audio
  if (mime.startsWith("audio/") || AUDIO_EXTS.has(ext)) {
    return "audio";
  }

  // 4. Vidéo
  if (mime.startsWith("video/") || VIDEO_EXTS.has(ext)) {
    return "video";
  }

  // 5. Texte & Code
  if (
    mime.startsWith("text/") ||
    mime === "application/json" ||
    mime === "application/xml" ||
    mime === "application/javascript" ||
    mime === "application/typescript" ||
    TEXT_EXTS.has(ext)
  ) {
    return "text";
  }

  // 6. Tableurs
  if (
    mime.includes("spreadsheet") ||
    mime === "application/vnd.ms-excel" ||
    SPREADSHEET_EXTS.has(ext)
  ) {
    return "spreadsheet";
  }

  // 7. Documents bureautiques
  if (mime.includes("wordprocessingml") || mime === "application/msword" || DOCUMENT_EXTS.has(ext)) {
    return "document";
  }

  // 8. Présentations
  if (
    mime.includes("presentationml") ||
    mime === "application/vnd.ms-powerpoint" ||
    PRESENTATION_EXTS.has(ext)
  ) {
    return "presentation";
  }

  // 9. Archives
  if (
    mime.includes("zip") ||
    mime.includes("tar") ||
    mime.includes("compressed") ||
    ARCHIVE_EXTS.has(ext)
  ) {
    return "archive";
  }

  return "other";
}

/**
 * Indique si le fichier peut être prévisualisé directement in-app.
 */
export function isAttachmentPreviewable(contentType: string, filename: string): boolean {
  const category = getAttachmentCategory(contentType, filename);
  return (
    category === "image" ||
    category === "pdf" ||
    category === "text" ||
    category === "audio" ||
    category === "video"
  );
}

/**
 * Retourne l'icône Lucide correspondant à la catégorie.
 */
export function getAttachmentIcon(category: AttachmentCategory): LucideIcon {
  switch (category) {
    case "image":
      return FileImage;
    case "pdf":
      return FileCheck;
    case "text":
      return FileCode;
    case "audio":
      return FileAudio;
    case "video":
      return FileVideo;
    case "archive":
      return FileArchive;
    case "spreadsheet":
      return FileSpreadsheet;
    case "document":
      return FileText;
    case "presentation":
      return FileText;
    default:
      return File;
  }
}

/**
 * Retourne les classes de couleur de pastille associées à la catégorie.
 */
export function getCategoryBadgeClasses(category: AttachmentCategory): string {
  switch (category) {
    case "image":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    case "pdf":
      return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
    case "text":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    case "audio":
      return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
    case "video":
      return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20";
    case "spreadsheet":
      return "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20";
    case "document":
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
    case "archive":
      return "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

/**
 * Déduit la syntaxe de coloration pour lowlight / code preview.
 */
export function getLanguageFromFilename(filename: string): string {
  const ext = getFileExtension(filename);
  switch (ext) {
    case "js":
    case "jsx":
      return "javascript";
    case "ts":
    case "tsx":
      return "typescript";
    case "json":
      return "json";
    case "html":
    case "htm":
      return "html";
    case "css":
      return "css";
    case "py":
      return "python";
    case "md":
    case "markdown":
      return "markdown";
    case "sh":
    case "bash":
      return "bash";
    case "yaml":
    case "yml":
      return "yaml";
    case "xml":
      return "xml";
    case "sql":
      return "sql";
    default:
      return "plaintext";
  }
}
