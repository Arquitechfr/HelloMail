export { cn } from "cn";

import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

/** Formate une date ISO en format court (ex: "10 sept. 2026"). */
export function formatDate(iso: string): string {
  return format(new Date(iso), "d MMM yyyy", { locale: fr });
}

/** Formate une date ISO en relatif (ex: "il y a 2 h"). */
export function formatRelativeDate(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: fr });
}

/** Formate une taille en octets lisible (ex: "1.2 Mo"). */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

/** Formate une taille de stockage de boîte mail pouvant atteindre les Go/To (ex: "15.0 Go", "850 Mo"). */
export function formatStorageSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "0 o";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} Go`;
}

/** Télécharge un blob avec un nom de fichier donné. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Initiales d'un nom/email pour les avatars. */
export function getInitials(name?: string, email?: string): string {
  const source = name ?? email ?? "?";
  const parts = source.split(/[\s@.]/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}
