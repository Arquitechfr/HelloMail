import { apiFetch, apiFetchBlob } from "@/lib/api";
import { useUIStore } from "@/lib/stores/uiStore";
import type { MessageDetail, AttachmentInfo } from "@/lib/api-types";
import type { RestoredComposeData } from "@/lib/stores/undoSendStore";
import type { AttachmentItem } from "@/components/mail/AttachmentDropzone";
import { toast } from "sonner";

/**
 * Convertit un MessageDetail en RestoredComposeData pour le formulaire de rédaction.
 */
export function messageDetailToRestoredComposeData(
  message: MessageDetail,
  draftUid?: number | null,
  attachments: AttachmentItem[] = [],
): RestoredComposeData {
  const to = message.to ? message.to.map((t) => t.address).filter(Boolean).join(", ") : "";
  const cc = message.cc ? message.cc.map((c) => c.address).filter(Boolean).join(", ") : "";
  const bcc = (message.headers?.["bcc"] || message.headers?.["x-bcc"] || "").trim();

  // Si on a du HTML, on l'utilise. Sinon, conversion des sauts de ligne en paragraphes/br.
  let body = message.html || "";
  if (!body && message.text) {
    body = `<p>${message.text.replace(/\r\n|\n/g, "<br>")}</p>`;
  }

  return {
    to,
    cc: cc || undefined,
    bcc: bcc || undefined,
    subject: message.subject || "",
    body,
    attachments,
    requestReadReceipt: !!message.readReceiptRequestedTo,
    draftUid: draftUid ?? null,
  };
}

/**
 * Télécharge les pièces jointes d'un brouillon et les convertit en AttachmentItem (base64).
 */
export async function loadDraftAttachments(
  accountId: string,
  folder: string,
  uid: number,
  attachments: AttachmentInfo[] = [],
): Promise<AttachmentItem[]> {
  const items: AttachmentItem[] = [];

  for (const att of attachments) {
    if (att.disposition === "inline") continue;
    try {
      const blob = await apiFetchBlob(
        `/api/accounts/${accountId}/messages/${encodeURIComponent(folder)}/${uid}/attachments/${att.part}`,
      );
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const res = reader.result as string;
          const pureBase64 = res.includes(",") ? res.split(",")[1] : res;
          resolve(pureBase64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      items.push({
        filename: att.filename,
        contentType: att.contentType,
        content: base64,
        sizeBytes: att.size,
      });
    } catch {
      // Tolérant aux échecs de téléchargement individuel
    }
  }

  return items;
}

/**
 * Charge un brouillon et l'ouvre dans la fenêtre de composition universelle.
 */
export async function openDraftCompose(
  accountId: string,
  folder: string,
  uid: number,
  preloadedDetail?: MessageDetail,
): Promise<void> {
  try {
    let detail = preloadedDetail;
    if (!detail) {
      detail = await apiFetch<MessageDetail>(
        `/api/accounts/${accountId}/messages/${encodeURIComponent(folder)}/${uid}`,
      );
    }

    let attachments: AttachmentItem[] = [];
    if (detail.attachments && detail.attachments.length > 0) {
      attachments = await loadDraftAttachments(accountId, folder, uid, detail.attachments);
    }

    const restoredData = messageDetailToRestoredComposeData(detail, uid, attachments);
    useUIStore.getState().openCompose("new", null, restoredData);
  } catch (error) {
    toast.error("Impossible d'ouvrir le brouillon pour modification");
    throw error;
  }
}
