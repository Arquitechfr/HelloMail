import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SendEmailInput } from "@/lib/api-types";
import type { AttachmentItem } from "@/components/mail/AttachmentDropzone";

export interface RestoredComposeData {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  attachments?: AttachmentItem[];
  requestReadReceipt?: boolean;
  draftUid?: number | null;
}

export interface PendingSendItem {
  id: string;
  accountId: string;
  payload: SendEmailInput;
  mode: "new" | "reply" | "forward";
  replyTo?: { messageId?: string; subject?: string; from?: string; to?: string[] } | null;
  draftUid: number | null;
  attachments: AttachmentItem[];
  recipientPreview: string;
  subjectPreview: string;
  createdAt: number;
  totalDurationMs: number;
  expiresAt: number;
  onExecute: () => Promise<void>;
}

interface UndoSendState {
  undoSendDelay: number; // 0, 5, 10, 15, 30 secondes
  pendingSend: PendingSendItem | null;
  setUndoSendDelay: (delay: number) => void;
  queueSend: (item: Omit<PendingSendItem, "id" | "createdAt" | "expiresAt">) => string;
  cancelPendingSend: () => RestoredComposeData | null;
  confirmPendingSend: () => void;
  clearPendingSend: () => void;
}

export const useUndoSendStore = create<UndoSendState>()(
  persist(
    (set, get) => ({
      undoSendDelay: 5, // Par défaut : 5 secondes
      pendingSend: null,

      setUndoSendDelay: (delay: number) => set({ undoSendDelay: delay }),

      queueSend: (item) => {
        const id = crypto.randomUUID();
        const now = Date.now();
        const pendingItem: PendingSendItem = {
          ...item,
          id,
          createdAt: now,
          expiresAt: now + item.totalDurationMs,
        };

        set({ pendingSend: pendingItem });
        return id;
      },

      cancelPendingSend: () => {
        const current = get().pendingSend;
        if (!current) return null;

        const restoredData: RestoredComposeData = {
          to: current.payload.to.join(", "),
          cc: current.payload.cc?.join(", "),
          bcc: current.payload.bcc?.join(", "),
          subject: current.payload.subject,
          body: current.payload.html || current.payload.text || "",
          attachments: current.attachments,
          requestReadReceipt: current.payload.requestReadReceipt,
          draftUid: current.draftUid,
        };

        set({ pendingSend: null });
        return restoredData;
      },

      confirmPendingSend: () => {
        const current = get().pendingSend;
        if (current) {
          // Exécute l'envoi immédiatement
          current.onExecute().catch(() => {});
          set({ pendingSend: null });
        }
      },

      clearPendingSend: () => set({ pendingSend: null }),
    }),
    {
      name: "hellomail-undo-send",
      partialize: (state) => ({
        undoSendDelay: state.undoSendDelay,
      }),
    },
  ),
);
