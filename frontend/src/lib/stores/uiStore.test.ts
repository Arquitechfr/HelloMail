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
});
