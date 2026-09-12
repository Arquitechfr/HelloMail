import { describe, it, expect, beforeEach } from "vitest";
import { useUIStore } from "./uiStore";

describe("uiStore", () => {
  beforeEach(() => {
    useUIStore.setState({
      selectedAccountId: null,
      selectedFolder: "INBOX",
      selectedUid: null,
      selectedUids: [],
      mobileSidebarOpen: false,
    });
  });

  it("setSelectedAccount réinitialise selectedUid à null", () => {
    useUIStore.setState({ selectedUid: 42 });
    expect(useUIStore.getState().selectedUid).toBe(42);

    useUIStore.getState().setSelectedAccount("acc-123");
    expect(useUIStore.getState().selectedAccountId).toBe("acc-123");
    expect(useUIStore.getState().selectedUid).toBeNull();
  });

  it("setSelectedFolder réinitialise selectedUid à null", () => {
    useUIStore.setState({ selectedUid: 99 });
    expect(useUIStore.getState().selectedUid).toBe(99);

    useUIStore.getState().setSelectedFolder("Sent");
    expect(useUIStore.getState().selectedFolder).toBe("Sent");
    expect(useUIStore.getState().selectedUid).toBeNull();
  });

  it("setSelectedUid met à jour selectedUid", () => {
    useUIStore.getState().setSelectedUid(101);
    expect(useUIStore.getState().selectedUid).toBe(101);

    useUIStore.getState().setSelectedUid(null);
    expect(useUIStore.getState().selectedUid).toBeNull();
  });

  it("toggleMobileSidebar et setMobileSidebarOpen manipulent la sidebar mobile", () => {
    expect(useUIStore.getState().mobileSidebarOpen).toBe(false);
    useUIStore.getState().toggleMobileSidebar();
    expect(useUIStore.getState().mobileSidebarOpen).toBe(true);
    useUIStore.getState().setMobileSidebarOpen(false);
    expect(useUIStore.getState().mobileSidebarOpen).toBe(false);
  });

  it("toggleSelectUid ajoute ou retire un UID et met à jour lastSelectedUid", () => {
    useUIStore.getState().toggleSelectUid(10);
    expect(useUIStore.getState().selectedUids).toEqual([10]);
    expect(useUIStore.getState().lastSelectedUid).toBe(10);

    useUIStore.getState().toggleSelectUid(20);
    expect(useUIStore.getState().selectedUids).toEqual([10, 20]);
    expect(useUIStore.getState().lastSelectedUid).toBe(20);

    useUIStore.getState().toggleSelectUid(10);
    expect(useUIStore.getState().selectedUids).toEqual([20]);
    expect(useUIStore.getState().lastSelectedUid).toBe(10);
  });

  it("selectRangeUids sélectionne une plage continue descendante et ascendante", () => {
    const allUids = [100, 200, 300, 400, 500];

    // Premier clic sur 200
    useUIStore.getState().toggleSelectUid(200);
    expect(useUIStore.getState().selectedUids).toEqual([200]);

    // Shift+clic sur 400 (plage descendante : 200, 300, 400)
    useUIStore.getState().selectRangeUids(allUids, 400);
    expect(useUIStore.getState().selectedUids).toEqual([200, 300, 400]);
    expect(useUIStore.getState().lastSelectedUid).toBe(400);

    // Shift+clic vers le haut sur 100 (plage ascendante depuis 400 : 100, 200, 300, 400)
    useUIStore.getState().selectRangeUids(allUids, 100);
    expect(useUIStore.getState().selectedUids).toEqual([200, 300, 400, 100]);

    // clearSelectedUids réinitialise tout
    useUIStore.getState().clearSelectedUids();
    expect(useUIStore.getState().selectedUids).toEqual([]);
    expect(useUIStore.getState().lastSelectedUid).toBeNull();
  });
});
