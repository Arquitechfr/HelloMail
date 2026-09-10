"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthBootstrap } from "@/hooks/useAuth";
import { useSSE } from "@/hooks/useSSE";
import { Loader2 } from "lucide-react";

/**
 * Layout des routes authentifiées — guard client.
 * Si pas d'access token et refresh échoue → redirect /login.
 * Pendant le bootstrap (isRestoringSession), affiche un loader (anti-flash).
 */
export default function MailLayout({ children }: { children: React.ReactNode }) {
  const { isRestoringSession, isAuthenticated } = useAuthBootstrap();
  const router = useRouter();

  useEffect(() => {
    if (isRestoringSession) return;
    if (!isAuthenticated) router.replace("/login");
  }, [isRestoringSession, isAuthenticated, router]);

  if (isRestoringSession) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <SSEWrapper>
      <div className="flex h-screen overflow-hidden">
        {children}
      </div>
    </SSEWrapper>
  );
}

function SSEWrapper({ children }: { children: React.ReactNode }) {
  useSSE(true);
  return <>{children}</>;
}
