import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "./authStore";
import { tabSyncHub } from "@/lib/sync/tabSyncHub";
import type { User } from "@/lib/api-types";

const fakeUser: User = { id: "u1", email: "a@test.com" };

describe("authStore", () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: null, user: null, isRestoringSession: true });
  });

  it("démarre sans token, en cours de restauration", () => {
    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.isRestoringSession).toBe(true);
  });

  it("setAuth stocke le token en mémoire et termine la restauration", () => {
    useAuthStore.getState().setAuth("token-123", fakeUser);
    const state = useAuthStore.getState();
    expect(state.accessToken).toBe("token-123");
    expect(state.user?.email).toBe("a@test.com");
    expect(state.isRestoringSession).toBe(false);
  });

  it("ne persiste jamais le token dans localStorage (anti-XSS)", () => {
    useAuthStore.getState().setAuth("token-123", fakeUser);
    for (let i = 0; i < localStorage.length; i++) {
      expect(localStorage.getItem(localStorage.key(i)!)).not.toContain("token-123");
    }
  });

  it("clearAuth réinitialise la session", () => {
    useAuthStore.getState().setAuth("token-123", fakeUser);
    useAuthStore.getState().clearAuth();
    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.user).toBeNull();
  });

  it("se synchronise lors de la réception d'un événement auth:login d'un autre onglet", () => {
    tabSyncHub.dispatchEnvelope({
      type: "auth:login",
      senderTabId: "other-tab",
      timestamp: Date.now(),
      payload: { accessToken: "new-token-999", user: fakeUser },
    });

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe("new-token-999");
    expect(state.user?.id).toBe("u1");
    expect(state.isRestoringSession).toBe(false);
  });

  it("se synchronise lors de la réception d'un événement auth:token_refreshed d'un autre onglet", () => {
    useAuthStore.setState({ accessToken: "old-token", user: fakeUser, isRestoringSession: false });

    tabSyncHub.dispatchEnvelope({
      type: "auth:token_refreshed",
      senderTabId: "other-tab",
      timestamp: Date.now(),
      payload: { accessToken: "refreshed-token-xyz" },
    });

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe("refreshed-token-xyz");
    expect(state.user?.id).toBe("u1");
  });

  it("se déconnecte lors de la réception d'un événement auth:logout d'un autre onglet", () => {
    useAuthStore.setState({ accessToken: "active-token", user: fakeUser, isRestoringSession: false });

    tabSyncHub.dispatchEnvelope({
      type: "auth:logout",
      senderTabId: "other-tab",
      timestamp: Date.now(),
      payload: {},
    });

    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.user).toBeNull();
  });
});
