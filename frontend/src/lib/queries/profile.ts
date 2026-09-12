import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/lib/stores/authStore";
import type {
  IProfilePreviewResult,
  IRestoreProfileInput,
  IRestoreReport,
} from "@/lib/types/profile";
import { tagKeys } from "./tags";
import { ruleKeys } from "./rules";
import { templateKeys } from "./templates";
import { contactKeys } from "./contacts";

export const profileKeys = {
  all: ["profile"] as const,
};

/**
 * Télécharge la sauvegarde du profil utilisateur en consommant le flux JSON avec Bearer token.
 */
export async function downloadProfileBackup(encrypt = false, password?: string): Promise<void> {
  const { accessToken } = useAuthStore.getState();
  const params = new URLSearchParams();
  if (encrypt) {
    params.set("encrypt", "true");
    if (password) params.set("password", password);
  }

  const query = params.toString() ? `?${params.toString()}` : "";
  const endpoint = `/api/profile/export${query}`;

  const res = await fetch(endpoint, {
    method: "GET",
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });

  if (!res.ok) {
    let errorMsg = "Échec du téléchargement du profil";
    try {
      const data = await res.json();
      if (data?.error?.message) errorMsg = data.error.message;
      else if (data?.message) errorMsg = data.message;
    } catch {
      // Ignorer
    }
    throw new Error(errorMsg);
  }

  const disposition = res.headers.get("content-disposition") || "";
  let filename = encrypt ? "mailora-profile.enc.json" : "mailora-profile.json";
  const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
  if (match && match[1]) {
    try {
      filename = decodeURIComponent(match[1]);
    } catch {
      filename = match[1];
    }
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Mutation pour analyser et prévisualiser une sauvegarde de profil.
 */
export function usePreviewProfile() {
  return useMutation({
    mutationFn: (body: { backupData: unknown; password?: string }) =>
      apiFetch<{ success: boolean; preview: IProfilePreviewResult }>("/api/profile/preview", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
}

/**
 * Mutation pour appliquer la restauration d'une sauvegarde de profil.
 */
export function useRestoreProfile() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (body: IRestoreProfileInput) =>
      apiFetch<{ success: boolean; report: IRestoreReport }>("/api/profile/restore", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      // Invalidation de tous les caches d'éléments de profil
      qc.invalidateQueries({ queryKey: tagKeys.all });
      qc.invalidateQueries({ queryKey: ruleKeys.all });
      qc.invalidateQueries({ queryKey: templateKeys.all });
      qc.invalidateQueries({ queryKey: contactKeys.all });
      qc.invalidateQueries({ queryKey: ["smart-folders"] });
      qc.invalidateQueries({ queryKey: ["sender-lists"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}
