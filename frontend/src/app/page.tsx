"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthBootstrap } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { isRestoringSession, isAuthenticated } = useAuthBootstrap();
  const router = useRouter();

  useEffect(() => {
    if (isRestoringSession) return;
    router.replace(isAuthenticated ? "/mail" : "/login");
  }, [isRestoringSession, isAuthenticated, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
    </div>
  );
}
