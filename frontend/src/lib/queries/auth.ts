import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { AuthResponse, User, LoginResponse, TwoFAStatus, TOTPSetupResponse, EnableTOTPResponse, UserPreferences } from "@/lib/api-types";
import { useAuthStore } from "@/lib/stores/authStore";

export const authKeys = {
  me: ["auth", "me"] as const,
  twoFAStatus: ["auth", "2fa", "status"] as const,
};

/** GET /api/auth/me — profil utilisateur courant. */
export function useMe() {
  const { accessToken } = useAuthStore();
  return useQuery({
    queryKey: authKeys.me,
    queryFn: () => apiFetch<{ user: User }>("/api/auth/me"),
    enabled: !!accessToken,
  });
}

/** POST /api/auth/register */
export function useRegister() {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      apiFetch<AuthResponse>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => setAuth(data.accessToken, data.user),
  });
}

/** POST /api/auth/login — peut retourner un challenge 2FA. */
export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      apiFetch<LoginResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      if (data.accessToken && data.user) {
        setAuth(data.accessToken, data.user);
      }
    },
  });
}

/** POST /api/auth/verify-2fa — vérifie le code 2FA et obtient les tokens. */
export function useVerify2FA() {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: (body: { twoFactorTempToken: string; code: string }) =>
      apiFetch<AuthResponse>("/api/auth/verify-2fa", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => setAuth(data.accessToken, data.user),
  });
}

/** POST /api/auth/logout */
export function useLogout() {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ message: string }>("/api/auth/logout", { method: "POST" }),
    onSuccess: () => {
      clearAuth();
      qc.clear();
    },
  });
}

// --- 2FA management ---

/** GET /api/auth/2fa/status — état 2FA de l'utilisateur. */
export function use2FAStatus() {
  return useQuery({
    queryKey: authKeys.twoFAStatus,
    queryFn: () => apiFetch<TwoFAStatus>("/api/auth/2fa/status"),
  });
}

/** POST /api/auth/2fa/totp/setup — génère le QR code TOTP. */
export function useSetupTOTP() {
  return useMutation({
    mutationFn: () =>
      apiFetch<TOTPSetupResponse>("/api/auth/2fa/totp/setup", { method: "POST" }),
  });
}

/** POST /api/auth/2fa/totp/enable — vérifie le code et active la 2FA. */
export function useEnableTOTP() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { token: string }) =>
      apiFetch<EnableTOTPResponse>("/api/auth/2fa/totp/enable", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.twoFAStatus }),
  });
}

/** POST /api/auth/2fa/disable — désactive la 2FA. */
export function useDisable2FA() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { password: string }) =>
      apiFetch<{ message: string }>("/api/auth/disable", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.twoFAStatus }),
  });
}

/** PATCH /api/auth/preferences — met à jour les préférences de l'utilisateur (Phase 9 & 10 & Dossiers unifiés). */
export function useUpdatePreferences() {
  const qc = useQueryClient();
  const setAuth = useAuthStore((s) => s.setAuth);
  const { accessToken } = useAuthStore();
  return useMutation({
    mutationFn: (body: Partial<UserPreferences>) =>
      apiFetch<{ user: User }>("/api/auth/preferences", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      if (accessToken && data.user) {
        setAuth(accessToken, data.user);
      }
      qc.invalidateQueries({ queryKey: authKeys.me });
    },
  });
}

/** WebAuthn passkey registration */
export function useWebAuthnRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { startRegistration } = await import("@simplewebauthn/browser");
      type OptionsType = Parameters<typeof startRegistration>[0]["optionsJSON"];
      // 1. Récupère les options d'enregistrement
      const options = await apiFetch<OptionsType>("/api/auth/2fa/webauthn/register/start", {
        method: "POST",
      });
      // 2. Invocation de l'API Passkey dans le navigateur
      const response = await startRegistration({ optionsJSON: options });
      // 3. Finalisation auprès du backend
      return apiFetch<{ verified: boolean }>("/api/auth/2fa/webauthn/register/finish", {
        method: "POST",
        body: JSON.stringify({ response }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.twoFAStatus }),
  });
}

/** WebAuthn passkey login */
export function useWebAuthnLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: async (email: string) => {
      const { startAuthentication } = await import("@simplewebauthn/browser");
      type OptionsType = Parameters<typeof startAuthentication>[0]["optionsJSON"];
      // 1. Récupère les options de login pour cet email
      const options = await apiFetch<OptionsType>("/api/auth/2fa/webauthn/login/start", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      // 2. Invocation de l'authentification Passkey dans le navigateur
      const response = await startAuthentication({ optionsJSON: options });
      // 3. Finalisation auprès du backend et obtention des tokens
      return apiFetch<AuthResponse>("/api/auth/2fa/webauthn/login/finish", {
        method: "POST",
        body: JSON.stringify({ email, response }),
      });
    },
    onSuccess: (data) => setAuth(data.accessToken, data.user),
  });
}


