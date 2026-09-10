"use client";

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/authStore";
import { useUIStore } from "@/lib/stores/uiStore";
import { useAccounts } from "@/lib/queries/accounts";
import { useLogout } from "@/lib/queries/auth";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import {
  Settings,
  ShieldCheck,
  Users,
  Filter,
  Keyboard,
  LogOut,
  ChevronDown,
  Loader2,
  CheckCircle2,
} from "lucide-react";

export function UserDropdown() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: accounts } = useAccounts();
  const logout = useLogout();
  const setShortcutsDialogOpen = useUIStore((s) => s.setShortcutsDialogOpen);

  const initials = getInitials(user?.email || "User");
  const accountsCount = accounts?.length ?? 0;

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
          <Avatar className="size-7 ring-1 ring-border">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="absolute bottom-0 right-0 size-2 rounded-full bg-emerald-500 ring-2 ring-background" />
        </div>
        <ChevronDown className="size-3 text-muted-foreground group-hover:text-foreground transition-transform duration-150 group-data-open:rotate-180" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-72 min-w-72 p-2 border-border bg-popover/98 backdrop-blur-md shadow-xl"
      >
        {/* En-tête profil enrichi */}
        <div className="flex items-center gap-3 p-2.5 rounded-md bg-muted/40 border border-border/50 mb-1">
          <Avatar className="size-10 ring-2 ring-primary/20">
            <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-sm">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="truncate text-xs font-medium text-foreground">
              {user?.email ?? "Utilisateur"}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-emerald-500">
              <CheckCircle2 className="size-3 shrink-0" />
              <span>Session active</span>
            </div>
            <span className="text-[10px] text-muted-foreground mt-0.5 truncate">
              {accountsCount} compte{accountsCount > 1 ? "s" : ""} synchronisé{accountsCount > 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-1 text-[11px] font-medium text-muted-foreground">
            Navigation & Réglages
          </DropdownMenuLabel>

          <DropdownMenuItem
            className="cursor-pointer gap-2.5 py-2 px-2.5 text-xs rounded-md"
            onClick={() => router.push("/mail/settings")}
          >
            <Settings className="size-4 text-muted-foreground" />
            <span>Paramètres généraux</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            className="cursor-pointer gap-2.5 py-2 px-2.5 text-xs rounded-md"
            onClick={() => router.push("/mail/settings/rules")}
          >
            <Filter className="size-4 text-muted-foreground" />
            <span>Règles & Filtres de tri</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            className="cursor-pointer gap-2.5 py-2 px-2.5 text-xs rounded-md"
            onClick={() => router.push("/mail/settings/security")}
          >
            <ShieldCheck className="size-4 text-muted-foreground" />
            <span>Sécurité & 2FA</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            className="cursor-pointer gap-2.5 py-2 px-2.5 text-xs rounded-md"
            onClick={() => router.push("/mail/contacts")}
          >
            <Users className="size-4 text-muted-foreground" />
            <span>Carnet d&apos;adresses</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            className="cursor-pointer gap-2.5 py-2 px-2.5 text-xs rounded-md"
            onClick={() => setShortcutsDialogOpen(true)}
          >
            <Keyboard className="size-4 text-muted-foreground" />
            <span>Raccourcis clavier</span>
            <kbd className="ml-auto inline-flex h-4 items-center rounded border border-border bg-muted px-1 font-mono text-[10px] text-muted-foreground">
              ?
            </kbd>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="my-1" />

        <DropdownMenuItem
          variant="destructive"
          className="cursor-pointer gap-2.5 py-2 px-2.5 text-xs rounded-md text-destructive focus:bg-destructive/10"
          onClick={handleLogout}
          disabled={logout.isPending}
        >
          {logout.isPending ? (
            <Loader2 className="size-4 animate-spin text-destructive" />
          ) : (
            <LogOut className="size-4" />
          )}
          <span>Se déconnecter</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
