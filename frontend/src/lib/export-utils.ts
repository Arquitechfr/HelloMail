import { useAuthStore } from "@/lib/stores/authStore";

export interface DownloadExportOptions {
  accountId: string;
  format: "mbox" | "zip";
  folder?: string;
  folders?: string[];
  exportId?: string;
  abortSignal?: AbortSignal;
}

/**
 * Déclenche le téléchargement d'une archive d'exportation MBOX ou ZIP
 * en consommant le flux streamé de l'API avec authentification Bearer.
 */
export async function downloadExportFile(options: DownloadExportOptions): Promise<void> {
  const { accessToken } = useAuthStore.getState();
  const { accountId, format, folder, folders, exportId, abortSignal } = options;

  const params = new URLSearchParams();
  if (folder) params.set("folder", folder);
  if (folders && folders.length > 0) params.set("folders", folders.join(","));
  if (exportId) params.set("exportId", exportId);

  const query = params.toString() ? `?${params.toString()}` : "";
  const endpoint = `/api/accounts/${accountId}/export/${format}${query}`;

  const res = await fetch(endpoint, {
    method: "GET",
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    signal: abortSignal,
  });

  if (!res.ok) {
    let errorMsg = "Erreur lors de l'exportation des données";
    try {
      const data = await res.json();
      if (data?.message) errorMsg = data.message;
    } catch {
      // Ignorer
    }
    throw new Error(errorMsg);
  }

  // Extraire le nom de fichier depuis le Content-Disposition
  const disposition = res.headers.get("content-disposition") || "";
  let filename = format === "zip" ? "mailora-export.zip" : "export.mbox";

  const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
  if (match && match[1]) {
    try {
      filename = decodeURIComponent(match[1]);
    } catch {
      filename = match[1];
    }
  }

  const blob = await res.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Nettoyage de l'URL objet après le téléchargement
  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
}
