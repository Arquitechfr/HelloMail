"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccounts } from "@/lib/queries/accounts";
import { useTags } from "@/lib/queries/tags";
import { useUIStore } from "@/lib/stores/uiStore";
import { AccountItem } from "@/components/accounts/AccountItem";
import { AddAccountDialog } from "@/components/accounts/AddAccountDialog";
import { FolderTree } from "@/components/mail/FolderTree";
import { UnifiedFolderList } from "@/components/mail/unified/UnifiedFolderList";
import { SmartFolderList } from "@/components/mail/smart/SmartFolderList";
import { Button } from "@/components/ui/button";
import { Plus, Mail, Loader2, X, FolderKanban, Tag as TagIcon, Clock, BellRing } from "lucide-react";
import { cn } from "@/lib/utils";

export function AccountSidebar() {
  const router = useRouter();
  const { data: accounts, isLoading } = useAccounts();
  const { data: tagsData } = useTags();
  const {
    selectedAccountId,
    selectedFolder,
    selectedTag,
    setSelectedAccount,
    setSelectedFolder,
    setSelectedTag,
    setSelectedUid,
    mobileSidebarOpen,
    setMobileSidebarOpen,
  } = useUIStore();
  const [addOpen, setAddOpen] = useState(false);

  const tags = tagsData?.data ?? [];

  const handleSelectTag = (tagName: string) => {
    if (selectedTag === tagName) {
      setSelectedTag(null);
    } else {
      setSelectedTag(tagName);
    }
    setMobileSidebarOpen(false);
  };

  const handleSelectAccount = (accountId: string) => {
    setSelectedAccount(accountId);
    setSelectedFolder("INBOX");
    setSelectedUid(null);
    setMobileSidebarOpen(false);
    router.push(`/mail/${accountId}/INBOX`);
  };

  const handleSelectFolder = (path: string, targetAccountId?: string) => {
    const accId = targetAccountId || selectedAccountId;
    if (!accId) return;
    setSelectedAccount(accId);
    setSelectedFolder(path);
    setSelectedUid(null);
    setMobileSidebarOpen(false);
    router.push(`/mail/${accId}/${encodeURIComponent(path)}`);
  };

  const content = (
    <div className="flex h-full flex-col">
      {/* En-tête de la barre latérale */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <FolderKanban className="size-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Boîtes & Dossiers
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setAddOpen(true)}
            title="Ajouter un compte IMAP"
            aria-label="Ajouter un compte"
          >
            <Plus className="size-4 text-muted-foreground hover:text-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Fermer"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Liste des comptes et arborescence des dossiers */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {/* Section Boîtes et Dossiers unifiés */}
        <UnifiedFolderList />

        {/* Section Dossiers Virtuels Intelligents */}
        <SmartFolderList />

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : !accounts || accounts.length === 0 ? (
          <div className="flex flex-col items-center gap-2.5 py-8 px-3 text-center">
            <div className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Mail className="size-5" />
            </div>
            <p className="text-xs text-muted-foreground">Aucun compte configuré</p>
            <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => setAddOpen(true)}>
              <Plus className="size-3.5 mr-1" />
              Ajouter un compte
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {accounts.map((account) => (
              <div key={account._id} className="flex flex-col">
                <AccountItem
                  account={account}
                  isSelected={selectedAccountId === account._id}
                  onSelect={() => handleSelectAccount(account._id)}
                />
                {selectedAccountId === account._id && account.isActive && (
                  <div className="mt-1 mb-1.5 ml-2 border-l border-border/60 pl-1">
                    <FolderTree
                      accountId={account._id}
                      accountColor={account.color}
                      selectedFolder={selectedFolder}
                      onSelectFolder={(path) => handleSelectFolder(path, account._id)}
                    />
                    {/* Dossier virtuel En sommeil (Snoozed) */}
                    <div
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition-colors cursor-pointer mt-0.5",
                        selectedFolder === "__snoozed__"
                          ? "bg-primary/15 text-primary font-medium"
                          : "hover:bg-muted/50 text-foreground/80",
                      )}
                      onClick={() => handleSelectFolder("__snoozed__", account._id)}
                    >
                      <Clock className={cn("size-4 shrink-0", selectedFolder === "__snoozed__" ? "text-primary" : "text-muted-foreground")} />
                      <span className="flex-1 truncate">En sommeil</span>
                    </div>
                    {/* Dossier virtuel À relancer (Follow-up Reminders) */}
                    <div
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition-colors cursor-pointer mt-0.5",
                        selectedFolder === "__reminders__"
                          ? "bg-primary/15 text-primary font-medium"
                          : "hover:bg-muted/50 text-foreground/80",
                      )}
                      onClick={() => handleSelectFolder("__reminders__", account._id)}
                    >
                      <BellRing className={cn("size-4 shrink-0", selectedFolder === "__reminders__" ? "text-primary" : "text-muted-foreground")} />
                      <span className="flex-1 truncate">À relancer</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Section Étiquettes */}
        {tags && tags.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border/60 px-1">
            <div className="flex items-center gap-1.5 px-2 mb-1.5">
              <TagIcon className="size-3.5 text-muted-foreground" />
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Étiquettes
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              {tags.map((tag) => {
                const isTagSelected = selectedTag === tag.name;
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleSelectTag(tag.name)}
                    className={cn(
                      "flex items-center justify-between w-full px-2.5 py-1.5 rounded-md text-xs transition-colors",
                      isTagSelected
                        ? "bg-accent text-accent-foreground font-medium"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="truncate">{tag.name}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Pied : bouton ajouter un compte */}
      <div className="border-t border-border p-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start text-xs border-border bg-background/50 hover:bg-muted"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="size-3.5 mr-1.5" />
          Ajouter un compte IMAP
        </Button>
      </div>

      <AddAccountDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );

  return (
    <>
      {/* Sidebar Desktop Dockée Edge-to-Edge */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-sidebar/50 backdrop-blur-xs select-none h-full">
        {content}
      </aside>

      {/* Tiroir Mobile Slide-Over */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-xs transition-opacity duration-200 lg:hidden",
          mobileSidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        onClick={() => setMobileSidebarOpen(false)}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 flex-col border-r border-border bg-background pt-13 shadow-2xl transition-transform duration-200 ease-in-out flex lg:hidden",
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {content}
      </aside>
    </>
  );
}
