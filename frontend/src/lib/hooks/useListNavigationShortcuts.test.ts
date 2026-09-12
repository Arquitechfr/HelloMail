import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useListNavigationShortcuts } from "./useListNavigationShortcuts";
import { useUIStore } from "@/lib/stores/uiStore";

describe("useListNavigationShortcuts", () => {
  const dummyItems = [{ uid: 101 }, { uid: 102 }, { uid: 103 }, { uid: 104 }];
  const onSelectUid = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useUIStore.setState({
      selectedUid: null,
      selectedUids: [],
      lastSelectedUid: null,
    });
  });

  it("navigue vers le message suivant avec 'j'", () => {
    renderHook(() =>
      useListNavigationShortcuts({
        items: dummyItems,
        selectedUid: 102,
        onSelectUid,
      }),
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "j" }));
    expect(onSelectUid).toHaveBeenCalledWith(103);
  });

  it("navigue vers le message précédent avec 'k'", () => {
    renderHook(() =>
      useListNavigationShortcuts({
        items: dummyItems,
        selectedUid: 103,
        onSelectUid,
      }),
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k" }));
    expect(onSelectUid).toHaveBeenCalledWith(102);
  });

  it("bascule la sélection du message courant avec 'x'", () => {
    renderHook(() =>
      useListNavigationShortcuts({
        items: dummyItems,
        selectedUid: 102,
        onSelectUid,
      }),
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "x" }));
    expect(useUIStore.getState().selectedUids).toEqual([102]);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "x" }));
    expect(useUIStore.getState().selectedUids).toEqual([]);
  });

  it("étend la sélection vers le bas avec Shift + 'j'", () => {
    renderHook(() =>
      useListNavigationShortcuts({
        items: dummyItems,
        selectedUid: 102,
        onSelectUid,
      }),
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "j", shiftKey: true }));
    expect(useUIStore.getState().selectedUids).toContain(103);
    expect(onSelectUid).toHaveBeenCalledWith(103);
  });

  it("sélectionne tout avec Cmd+A et vide la sélection avec Escape", () => {
    renderHook(() =>
      useListNavigationShortcuts({
        items: dummyItems,
        selectedUid: 102,
        onSelectUid,
      }),
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", metaKey: true }));
    expect(useUIStore.getState().selectedUids).toEqual([101, 102, 103, 104]);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(useUIStore.getState().selectedUids).toEqual([]);
  });
});
