"use client";

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/authStore";
import { useUIStore } from "@/lib/stores/uiStore";
import { useAccounts } from "@/lib/queries/accounts";
import { useLogout, useMe } from "@/lib/queries/auth";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { EmailAvatar } from "@/components/mail/EmailAvatar";
import {
  Settings,
  ShieldCheck,
  Users,
  Filter,
  Keyboard,
  LogOut,
  ChevronDown,
  Loader2,
  Check,
  Mail,
} from "lucide-react";

export function UserDropdown() {
  const router = useRouter();
  const storeUser = useAuthStore((s) => s.user);
  const { data: meData } = useMe();
  const user = meData?.user ?? storeUser;
  const { data: accounts } = useAccounts();
  const logout = useLogout();
  const {
    selectedAccountId,
    setSelectedAccount,
    setSelectedFolder,
    setShortcutsDialogOpen,
  } = useUIStore();

  const activeAccount =
    accounts?.find((a) => a._id === selectedAccountId) || accounts?.[0];
  const displayName =
    activeAccount?.displayName || activeAccount?.emailAddress || user?.email || "Utilisateur";
  const displayEmail = activeAccount?.emailAddress || user?.email || "";

  const handleSelectAccount = (accountId: string) => {
    setSelectedAccount(accountId);
    setSelectedFolder("INBOX");
    router.push(`/mail/${accountId}/INBOX`);
  };

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => {
        router.replace("/login");
      },
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-slot="user-menu-trigger"
        className="group flex items-center gap-2 rounded-full p-0.5 pr-2 outline-none hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring transition-colors cursor-pointer border border-transparent hover:border-border"
        aria-label="Menu utilisateur"
      >
        <div className="relative">
          <EmailAvatar
            email={displayEmail}
            name={displayName}
            className="size-7 ring-1 ring-border"
            fallbackClassName="bg-primary/10 text-primary text-xs font-semibold"
          />
          <span className="absolute bottom-0 right-0 size-2 rounded-full bg-emerald-500 ring-2 ring-background z-10" />
        </div>
        <ChevronDown className="size-3 text-muted-foreground group-hover:text-foreground transition-transform duration-150 group-data-open:rotate-180" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-72 min-w-72 p-2 border-border bg-popover/98 backdrop-blur-md shadow-xl"
      >
        {/* En-tête : Boîte email active */}
        <div className="flex items-center gap-3 p-2.5 rounded-md bg-muted/40 border border-border/50 mb-1.5">
          <EmailAvatar
            email={displayEmail}
            name={displayName}
            className="size-9 ring-2 ring-primary/20 shrink-0"
            fallbackClassName="bg-primary text-primary-foreground font-semibold text-xs"
          />
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <span className="truncate text-xs font-semibold text-foreground">
                {displayName}
              </span>
              {activeAccount?.provider && activeAccount.provider !== "imap" && (
                <span className="text-[9px] font-medium px-1 rounded bg-primary/10 text-primary uppercase shrink-0">
                  {activeAccount.provider === "google_oauth" ? "Google" : "Outlook"}
                </span>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground truncate">
              {displayEmail}
            </span>
          </div>
        </div>

        {/* Sélecteur rapide de compte si plusieurs boîtes reliées */}
        {accounts && accounts.length > 1 && (
          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80 font-mono">
              Basculer de boîte
            </DropdownMenuLabel>
            <div className="max-h-32 overflow-y-auto space-y-0.5 mb-1">
              {accounts.map((acc) => {
                const isCurrent = acc._id === activeAccount?._id;
                return (
                  <DropdownMenuItem
                    key={acc._id}
                    className="cursor-pointer gap-2 py-1.5 px-2 text-xs rounded-md"
                    onClick={() => handleSelectAccount(acc._id)}
                  >
                    <Mail className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate flex-1 font-medium">
                      {acc.displayName ? `${acc.displayName} (${acc.emailAddress})` : acc.emailAddress}
                    </span>
                    {isCurrent && <Check className="size-3.5 text-primary shrink-0" />}
                  </DropdownMenuItem>
                );
              })}
            </div>
            <DropdownMenuSeparator className="my-1" />
          </DropdownMenuGroup>
        )}

        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80 font-mono">
            Navigation & Réglages
          </DropdownMenuLabel>

          <DropdownMenuItem
            className="cursor-pointer gap-2.5 py-1.5 px-2.5 text-xs rounded-md"
            onClick={() => router.push("/mail/settings")}
          >
            <Settings className="size-3.5 text-muted-foreground" />
            <span>Paramètres généraux</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            className="cursor-pointer gap-2.5 py-1.5 px-2.5 text-xs rounded-md"
            onClick={() => router.push("/mail/settings?section=rules")}
          >
            <Filter className="size-3.5 text-muted-foreground" />
            <span>Règles & Filtres de tri</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            className="cursor-pointer gap-2.5 py-1.5 px-2.5 text-xs rounded-md"
            onClick={() => router.push("/mail/settings?section=security")}
          >
            <ShieldCheck className="size-3.5 text-muted-foreground" />
            <span>Sécurité & 2FA</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            className="cursor-pointer gap-2.5 py-1.5 px-2.5 text-xs rounded-md"
            onClick={() => router.push("/mail/settings?section=contacts")}
          >
            <Users className="size-3.5 text-muted-foreground" />
            <span>Carnet d&apos;adresses</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            className="cursor-pointer gap-2.5 py-1.5 px-2.5 text-xs rounded-md"
            onClick={() => setShortcutsDialogOpen(true)}
          >
            <Keyboard className="size-3.5 text-muted-foreground" />
            <span>Raccourcis clavier</span>
            <kbd className="ml-auto inline-flex h-4 items-center rounded border border-border bg-muted px-1 font-mono text-[10px] text-muted-foreground">
              ?
            </kbd>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="my-1" />

        {/* Pied de page du menu : Compte principal */}
        <div className="px-2 py-1 text-[10px] text-muted-foreground/70 truncate">
          Connecté : <span className="font-mono text-muted-foreground">{user?.email}</span>
        </div>

        <DropdownMenuItem
          variant="destructive"
          className="cursor-pointer gap-2.5 py-1.5 px-2.5 text-xs rounded-md text-destructive focus:bg-destructive/10"
          onClick={handleLogout}
          disabled={logout.isPending}
        >
          {logout.isPending ? (
            <Loader2 className="size-3.5 animate-spin text-destructive" />
          ) : (
            <LogOut className="size-3.5" />
          )}
          <span>Se déconnecter</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
