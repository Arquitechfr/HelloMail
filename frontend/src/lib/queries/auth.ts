import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { AuthResponse, User } from "@/lib/api-types";
import { useAuthStore } from "@/lib/stores/authStore";

export const authKeys = {
  me: ["auth", "me"] as const,
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

/** POST /api/auth/login */
export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      apiFetch<AuthResponse>("/api/auth/login", {
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
