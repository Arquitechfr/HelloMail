import { create } from "zustand";
import { persist } from "zustand/middleware";

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
  composeReplyTo: { messageId?: string; subject?: string; from?: string; to?: string[] } | null;
  mobileSidebarOpen: boolean;
  shortcutsDialogOpen: boolean;
  desktopNotificationsEnabled: boolean;
  notificationSoundEnabled: boolean;
  setSelectedAccount: (accountId: string | null) => void;
  setSelectedFolder: (folder: string) => void;
  setSelectedUid: (uid: number | null) => void;
  openCompose: (mode?: ComposeMode, replyTo?: UIState["composeReplyTo"]) => void;
  closeCompose: () => void;
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
      selectedUid: null,
      composeOpen: false,
      composeMode: "new",
      composeReplyTo: null,
      mobileSidebarOpen: false,
      shortcutsDialogOpen: false,
      desktopNotificationsEnabled: true,
      notificationSoundEnabled: true,
      setSelectedAccount: (accountId) => set({ selectedAccountId: accountId }),
      setSelectedFolder: (folder) => set({ selectedFolder: folder }),
      setSelectedUid: (uid) => set({ selectedUid: uid }),
      openCompose: (mode = "new", replyTo = null) =>
        set({ composeOpen: true, composeMode: mode, composeReplyTo: replyTo }),
      closeCompose: () => set({ composeOpen: false, composeReplyTo: null }),
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
