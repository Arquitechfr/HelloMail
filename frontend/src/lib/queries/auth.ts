import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { AuthResponse, User, LoginResponse, TwoFAStatus, TOTPSetupResponse, EnableTOTPResponse } from "@/lib/api-types";
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
      apiFetch<{ message: string }>("/api/auth/2fa/disable", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: authKeys.twoFAStatus }),
  });
}
