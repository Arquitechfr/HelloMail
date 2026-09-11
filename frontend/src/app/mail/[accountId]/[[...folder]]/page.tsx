"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useAccounts } from "@/lib/queries/accounts";
import { useUIStore } from "@/lib/stores/uiStore";
import { AccountSidebar } from "@/components/mail/AccountSidebar";
import { MessageList } from "@/components/mail/MessageList";
import { MessageReader } from "@/components/mail/MessageReader";
import { Loader2 } from "lucide-react";

export default function FolderPage() {
  const params = useParams<{ accountId: string; folder?: string[] }>();
  const accountId = params.accountId;
  const folder = params.folder ? decodeURIComponent(params.folder.join("/")) : "INBOX";

  const { data: accounts, isLoading: accountsLoading } = useAccounts();
  const { setSelectedAccount, setSelectedFolder, setSelectedUid, selectedUid } = useUIStore();

  useEffect(() => {
    setSelectedAccount(accountId);
    setSelectedFolder(folder);
    setSelectedUid(null);
  }, [accountId, folder, setSelectedAccount, setSelectedFolder, setSelectedUid]);

  const account = accounts?.find((a) => a._id === accountId);

  // Comptes encore en cours de chargement → loader (évite le faux "introuvable").
  if (accountsLoading || !accounts) {
    return (
      <>
        <AccountSidebar />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  if (!account) {
    return (
      <>
        <AccountSidebar />
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <p className="text-sm">Compte introuvable</p>
        </div>
      </>
    );
  }

  if (!account.isActive) {
    return (
      <>
        <AccountSidebar />
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <p className="text-sm">Ce compte est désactivé. Activez-le pour consulter les messages.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <AccountSidebar />
      <MessageList accountId={accountId} folder={folder} />
      <MessageReader accountId={accountId} folder={folder} uid={selectedUid} />
    </>
  );
}
