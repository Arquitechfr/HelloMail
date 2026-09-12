"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccounts } from "@/lib/queries/accounts";
import { AccountSidebar } from "@/components/mail/AccountSidebar";
import { Mail } from "lucide-react";

export default function EmptyStatePage() {
  const router = useRouter();
  const { data: accounts, isLoading } = useAccounts();

  // Redirige vers le premier compte dès qu'un compte est disponible.
  useEffect(() => {
    if (isLoading || !accounts) return;
    if (accounts.length > 0) {
      const first = accounts[0];
      router.replace(`/mail/${first._id}/INBOX`);
    }
  }, [accounts, isLoading, router]);

  return (
    <>
      <AccountSidebar />
      <div className="flex flex-1 items-center justify-center bg-card/10 p-8 select-none">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
            <Mail className="size-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-display tracking-tight text-foreground">Bienvenue sur Mailora</h2>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              Ajoutez votre premier compte IMAP depuis la barre latérale pour commencer à synchroniser et gérer vos emails.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
