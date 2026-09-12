"use client";

import { useCallback, useMemo } from "react";
import { useUIStore } from "@/lib/stores/uiStore";
import { useEmailShortcuts } from "./useEmailShortcuts";

interface ListNavigationShortcutsOptions {
  items: Array<{ uid: number }>;
  selectedUid: number | null;
  onSelectUid: (uid: number | null) => void;
  enabled?: boolean;
}

/**
 * Hook de navigation et multi-sélection clavier pour les listes de messages (MessageList et UnifiedMessageList).
 * Gère J/K (navigation), X (bascule sélection), Shift+J/Shift+K (extension de plage), Cmd+A (tout) et Échap.
 */
export function useListNavigationShortcuts({
  items,
  selectedUid,
  onSelectUid,
  enabled = true,
}: ListNavigationShortcutsOptions) {
  const toggleSelectUid = useUIStore((s) => s.toggleSelectUid);
  const selectRangeUids = useUIStore((s) => s.selectRangeUids);
  const selectAllUids = useUIStore((s) => s.selectAllUids);
  const clearSelectedUids = useUIStore((s) => s.clearSelectedUids);

  const visibleUids = useMemo(() => items.map((m) => m.uid), [items]);

  const handleNavigateNext = useCallback(() => {
    if (items.length === 0) return;
    const currentIndex = selectedUid !== null ? items.findIndex((m) => m.uid === selectedUid) : -1;
    const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
    onSelectUid(items[nextIndex].uid);
  }, [items, selectedUid, onSelectUid]);

  const handleNavigatePrev = useCallback(() => {
    if (items.length === 0) return;
    const currentIndex = selectedUid !== null ? items.findIndex((m) => m.uid === selectedUid) : -1;
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
    onSelectUid(items[prevIndex].uid);
  }, [items, selectedUid, onSelectUid]);

  const handleToggleSelectCurrent = useCallback(() => {
    if (selectedUid !== null) {
      toggleSelectUid(selectedUid);
    }
  }, [selectedUid, toggleSelectUid]);

  const handleExtendSelectionDown = useCallback(() => {
    if (items.length === 0) return;
    const currentIndex = selectedUid !== null ? items.findIndex((m) => m.uid === selectedUid) : -1;
    if (currentIndex < items.length - 1) {
      const nextItem = items[currentIndex + 1];
      selectRangeUids(visibleUids, nextItem.uid);
      onSelectUid(nextItem.uid);
    }
  }, [items, selectedUid, selectRangeUids, visibleUids, onSelectUid]);

  const handleExtendSelectionUp = useCallback(() => {
    if (items.length === 0) return;
    const currentIndex = selectedUid !== null ? items.findIndex((m) => m.uid === selectedUid) : -1;
    if (currentIndex > 0) {
      const prevItem = items[currentIndex - 1];
      selectRangeUids(visibleUids, prevItem.uid);
      onSelectUid(prevItem.uid);
    }
  }, [items, selectedUid, selectRangeUids, visibleUids, onSelectUid]);

  const handleSelectAll = useCallback(() => {
    selectAllUids(visibleUids);
  }, [selectAllUids, visibleUids]);

  const handleClearSelection = useCallback(() => {
    const state = useUIStore.getState();
    if (state.selectedUids.length > 0) {
      clearSelectedUids();
    } else if (state.selectedUid !== null) {
      onSelectUid(null);
    }
  }, [clearSelectedUids, onSelectUid]);

  useEmailShortcuts({
    enabled,
    onNavigateNext: handleNavigateNext,
    onNavigatePrev: handleNavigatePrev,
    onToggleSelectCurrent: handleToggleSelectCurrent,
    onExtendSelectionDown: handleExtendSelectionDown,
    onExtendSelectionUp: handleExtendSelectionUp,
    onSelectAll: handleSelectAll,
    onClearSelection: handleClearSelection,
  });

  return {
    visibleUids,
    handleSelectAll,
  };
}
