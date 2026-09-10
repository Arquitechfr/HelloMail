import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface AutoconfigResult {
  detected: boolean;
  source: 'ispdb' | 'mx' | 'heuristic' | 'none';
  providerSuggestion?: 'google_oauth' | 'microsoft_oauth' | 'imap';
  imap?: {
    host: string;
    port: number;
    secure: boolean;
    usernameRule: 'email' | 'localpart';
  };
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    usernameRule: 'email' | 'localpart';
  };
}

export function useAutoconfig(email: string) {
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return useQuery({
    queryKey: ["autoconfig", email.trim().toLowerCase()],
    queryFn: () => apiFetch<AutoconfigResult>(`/accounts/autoconfig?email=${encodeURIComponent(email.trim())}`),
    enabled: isValidEmail,
    staleTime: 1000 * 60 * 30, // 30 minutes de cache
    retry: false,
  });
}
