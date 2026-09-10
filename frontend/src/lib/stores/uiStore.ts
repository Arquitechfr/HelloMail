import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { RestoredComposeData } from "./undoSendStore";

/**
 * Store UI — état de l'interface (compte/dossier/message sélectionnés, compose).
 * Persisté partiellement (compte/dossier sélectionnés) via localStorage.
 * Aucun secret/token stocké ici.
 */
type ComposeMode = "new" | "reply" | "forward";

interface UIState {
  selectedAccountId: string | null;
  selectedFolder: string;
  selectedUid: number | null;
  composeOpen: boolean;
  composeMode: ComposeMode;
  composeReplyTo: { messageId?: string; subject?: string; from?: string; to?: string[]; html?: string } | null;
  composeRestoredData: RestoredComposeData | null;
  mobileSidebarOpen: boolean;
  shortcutsDialogOpen: boolean;
  selectedTag: string | null;
  desktopNotificationsEnabled: boolean;
  notificationSoundEnabled: boolean;
  setSelectedAccount: (accountId: string | null) => void;
  setSelectedFolder: (folder: string) => void;
  setSelectedTag: (tag: string | null) => void;
  setSelectedUid: (uid: number | null) => void;
  openCompose: (
    mode?: ComposeMode,
    replyTo?: UIState["composeReplyTo"],
    restoredData?: RestoredComposeData | null,
  ) => void;
  closeCompose: () => void;
  clearRestoredComposeData: () => void;
  setMobileSidebarOpen: (open: boolean) => void;
  toggleMobileSidebar: () => void;
  setShortcutsDialogOpen: (open: boolean) => void;
  setDesktopNotificationsEnabled: (enabled: boolean) => void;
  setNotificationSoundEnabled: (enabled: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      selectedAccountId: null,
      selectedFolder: "INBOX",
      selectedTag: null,
      selectedUid: null,
      composeOpen: false,
      composeMode: "new",
      composeReplyTo: null,
      composeRestoredData: null,
      mobileSidebarOpen: false,
      shortcutsDialogOpen: false,
      desktopNotificationsEnabled: true,
      notificationSoundEnabled: true,
      setSelectedAccount: (accountId) => set({ selectedAccountId: accountId }),
      setSelectedFolder: (folder) => set({ selectedFolder: folder, selectedTag: null }),
      setSelectedTag: (tag) => set({ selectedTag: tag, selectedUid: null }),
      setSelectedUid: (uid) => set({ selectedUid: uid }),
      openCompose: (mode = "new", replyTo = null, restoredData = null) =>
        set({
          composeOpen: true,
          composeMode: mode,
          composeReplyTo: replyTo,
          composeRestoredData: restoredData,
        }),
      closeCompose: () =>
        set({ composeOpen: false, composeReplyTo: null, composeRestoredData: null }),
      clearRestoredComposeData: () => set({ composeRestoredData: null }),
      setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
      toggleMobileSidebar: () => set((state) => ({ mobileSidebarOpen: !state.mobileSidebarOpen })),
      setShortcutsDialogOpen: (open) => set({ shortcutsDialogOpen: open }),
      setDesktopNotificationsEnabled: (enabled) => set({ desktopNotificationsEnabled: enabled }),
      setNotificationSoundEnabled: (enabled) => set({ notificationSoundEnabled: enabled }),
    }),
    {
      name: "hellomail-ui",
      partialize: (state) => ({
        selectedAccountId: state.selectedAccountId,
        selectedFolder: state.selectedFolder,
        desktopNotificationsEnabled: state.desktopNotificationsEnabled,
        notificationSoundEnabled: state.notificationSoundEnabled,
      }),
    },
  ),
);
