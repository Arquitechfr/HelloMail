import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "./authStore";
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
});
