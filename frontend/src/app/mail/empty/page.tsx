"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccounts } from "@/lib/queries/accounts";
import { AccountSidebar } from "@/components/mail/AccountSidebar";
import { GlassPanel } from "@/components/mail/GlassPanel";
import { Mail, Loader2 } from "lucide-react";

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
      <GlassPanel className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Mail className="size-8" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Bienvenue sur HelloMail</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ajoutez votre premier compte IMAP pour commencer à gérer vos emails.
            </p>
          </div>
        </div>
      </GlassPanel>
    </>
  );
}
