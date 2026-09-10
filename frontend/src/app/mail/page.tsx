"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccounts } from "@/lib/queries/accounts";
import { useUIStore } from "@/lib/stores/uiStore";
import { Loader2 } from "lucide-react";

export default function MailPage() {
  const router = useRouter();
  const { data: accounts, isLoading } = useAccounts();
  const setSelectedAccount = useUIStore((s) => s.setSelectedAccount);

  useEffect(() => {
    if (isLoading || !accounts) return;
    if (accounts.length > 0) {
      const first = accounts[0];
      setSelectedAccount(first._id);
      router.replace(`/mail/${first._id}/INBOX`);
    } else {
      // Redirige vers le premier compte pour afficher l'état vide.
      router.replace("/mail/empty");
    }
  }, [accounts, isLoading, router, setSelectedAccount]);

  return (
    <div className="flex flex-1 items-center justify-center">
      <Loader2 className="size-8 animate-spin text-muted-foreground" />
    </div>
  );
}
