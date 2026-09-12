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
  searchDialogOpen: boolean;
  selectedTag: string | null;
  selectedUids: number[];
  lastSelectedUid: number | null;
  desktopNotificationsEnabled: boolean;
  notificationSoundEnabled: boolean;
  setSelectedAccount: (accountId: string | null) => void;
  setSelectedFolder: (folder: string) => void;
  setSelectedTag: (tag: string | null) => void;
  setSelectedUid: (uid: number | null) => void;
  toggleSelectUid: (uid: number) => void;
  selectRangeUids: (allVisibleUids: number[], targetUid: number) => void;
  selectAllUids: (uids: number[]) => void;
  clearSelectedUids: () => void;
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
  setSearchDialogOpen: (open: boolean) => void;
  openSearch: () => void;
  closeSearch: () => void;
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
      selectedUids: [],
      lastSelectedUid: null,
      composeOpen: false,
      composeMode: "new",
      composeReplyTo: null,
      composeRestoredData: null,
      mobileSidebarOpen: false,
      shortcutsDialogOpen: false,
      searchDialogOpen: false,
      desktopNotificationsEnabled: true,
      notificationSoundEnabled: true,
      setSelectedAccount: (accountId) =>
        set({ selectedAccountId: accountId, selectedUid: null, selectedUids: [], lastSelectedUid: null }),
      setSelectedFolder: (folder) =>
        set({ selectedFolder: folder, selectedTag: null, selectedUid: null, selectedUids: [], lastSelectedUid: null }),
      setSelectedTag: (tag) =>
        set({ selectedTag: tag, selectedUid: null, selectedUids: [], lastSelectedUid: null }),
      setSelectedUid: (uid) => set({ selectedUid: uid }),
      toggleSelectUid: (uid) =>
        set((state) => ({
          selectedUids: state.selectedUids.includes(uid)
            ? state.selectedUids.filter((id) => id !== uid)
            : [...state.selectedUids, uid],
          lastSelectedUid: uid,
        })),
      selectRangeUids: (allVisibleUids, targetUid) =>
        set((state) => {
          const targetIndex = allVisibleUids.indexOf(targetUid);
          if (targetIndex === -1) return state;

          const lastIndex =
            state.lastSelectedUid !== null ? allVisibleUids.indexOf(state.lastSelectedUid) : -1;

          if (lastIndex === -1) {
            return {
              selectedUids: state.selectedUids.includes(targetUid)
                ? state.selectedUids
                : [...state.selectedUids, targetUid],
              lastSelectedUid: targetUid,
            };
          }

          const [start, end] =
            lastIndex < targetIndex ? [lastIndex, targetIndex] : [targetIndex, lastIndex];
          const rangeUids = allVisibleUids.slice(start, end + 1);
          const newSelectedUids = Array.from(new Set([...state.selectedUids, ...rangeUids]));

          return {
            selectedUids: newSelectedUids,
            lastSelectedUid: targetUid,
          };
        }),
      selectAllUids: (uids) =>
        set({ selectedUids: uids, lastSelectedUid: uids[uids.length - 1] ?? null }),
      clearSelectedUids: () => set({ selectedUids: [], lastSelectedUid: null }),
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
      setSearchDialogOpen: (open) => set({ searchDialogOpen: open }),
      openSearch: () => set({ searchDialogOpen: true }),
      closeSearch: () => set({ searchDialogOpen: false }),
      setDesktopNotificationsEnabled: (enabled) => set({ desktopNotificationsEnabled: enabled }),
      setNotificationSoundEnabled: (enabled) => set({ notificationSoundEnabled: enabled }),
    }),
    {
      name: "mailora-ui",
      partialize: (state) => ({
        selectedAccountId: state.selectedAccountId,
        selectedFolder: state.selectedFolder,
        desktopNotificationsEnabled: state.desktopNotificationsEnabled,
        notificationSoundEnabled: state.notificationSoundEnabled,
      }),
    },
  ),
);
