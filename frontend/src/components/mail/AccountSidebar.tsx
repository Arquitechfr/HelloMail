"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccounts } from "@/lib/queries/accounts";
import { useUIStore } from "@/lib/stores/uiStore";
import { AccountItem } from "@/components/accounts/AccountItem";
import { AddAccountDialog } from "@/components/accounts/AddAccountDialog";
import { FolderTree } from "@/components/mail/FolderTree";
import { GlassPanel } from "@/components/mail/GlassPanel";
import { Button } from "@/components/ui/button";
import { useLogout } from "@/lib/queries/auth";
import { Plus, LogOut, Mail, Loader2, Settings } from "lucide-react";
import { ThemeToggle } from "@/components/mail/ThemeToggle";

export function AccountSidebar() {
  const router = useRouter();
  const { data: accounts, isLoading } = useAccounts();
  const logout = useLogout();
  const { selectedAccountId, selectedFolder, setSelectedAccount, setSelectedFolder } =
    useUIStore();
  const [addOpen, setAddOpen] = useState(false);

  const handleSelectAccount = (accountId: string) => {
    setSelectedAccount(accountId);
    setSelectedFolder("INBOX");
    router.push(`/mail/${accountId}/INBOX`);
  };

  const handleSelectFolder = (path: string) => {
    if (!selectedAccountId) return;
    setSelectedFolder(path);
    router.push(`/mail/${selectedAccountId}/${encodeURIComponent(path)}`);
  };

  const handleLogout = () => {
    logout.mutate();
    router.replace("/login");
  };

  return (
    <GlassPanel className="flex h-full w-72 flex-col border-r">
      {/* En-tête */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Mail className="size-4" />
          </div>
          <span className="font-semibold tracking-tight">HelloMail</span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => router.push("/mail/settings")}
          >
            <Settings className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={handleLogout} disabled={logout.isPending}>
            {logout.isPending ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
          </Button>
        </div>
      </div>

      <div className="mx-3 border-t border-border" />

      {/* Liste comptes + dossiers */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : !accounts || accounts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-sm text-muted-foreground">Aucun compte configuré</p>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="size-4" />
              Ajouter un compte
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {accounts.map((account) => (
              <div key={account._id} className="flex flex-col">
                <AccountItem
                  account={account}
                  isSelected={selectedAccountId === account._id}
                  onSelect={() => handleSelectAccount(account._id)}
                />
                {selectedAccountId === account._id && account.isActive && (
                  <div className="mt-1 mb-2 ml-2">
                    <FolderTree
                      accountId={account._id}
                      selectedFolder={selectedFolder}
                      onSelectFolder={handleSelectFolder}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pied : bouton compose + ajouter */}
      <div className="border-t border-border p-2">
        <Button
          className="w-full justify-start mb-2"
          onClick={() => useUIStore.getState().openCompose("new")}
        >
          <Plus className="size-4" />
          Nouveau message
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="size-4" />
          Ajouter un compte
        </Button>
      </div>

      <AddAccountDialog open={addOpen} onOpenChange={setAddOpen} />
    </GlassPanel>
  );
}
