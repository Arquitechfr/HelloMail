"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccounts } from "@/lib/queries/accounts";
import { useUIStore } from "@/lib/stores/uiStore";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function MailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: accounts, isLoading } = useAccounts();
  const setSelectedAccount = useUIStore((s) => s.setSelectedAccount);

  // Gestion du retour OAuth Google (redirect depuis le backend).
  useEffect(() => {
    const oauthSuccess = searchParams.get("oauth_success");
    const oauthError = searchParams.get("oauth_error");
    if (oauthSuccess) {
      toast.success("Compte Google lié avec succès");
      router.replace("/mail");
    } else if (oauthError) {
      toast.error(`Erreur OAuth : ${oauthError}`);
      router.replace("/mail");
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (isLoading || !accounts) return;
    // Attend que les paramètres OAuth soient traités avant de rediriger.
    if (searchParams.get("oauth_success") || searchParams.get("oauth_error")) return;
    if (accounts.length > 0) {
      const first = accounts[0];
      setSelectedAccount(first._id);
      router.replace(`/mail/${first._id}/INBOX`);
    } else {
      // Redirige vers le premier compte pour afficher l'état vide.
      router.replace("/mail/empty");
    }
  }, [accounts, isLoading, router, setSelectedAccount, searchParams]);

  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
    </div>
  );
}
