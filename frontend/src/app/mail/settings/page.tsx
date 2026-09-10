"use client";

import { useState } from "react";
import { useAuthStore } from "@/lib/stores/authStore";
import { useAccounts } from "@/lib/queries/accounts";
import { AccountSidebar } from "@/components/mail/AccountSidebar";
import { SettingsNav } from "@/components/mail/SettingsNav";
import { AddAccountDialog } from "@/components/accounts/AddAccountDialog";
import { AccountItem } from "@/components/accounts/AccountItem";
import { AccountSignatureManager } from "@/components/accounts/AccountSignatureManager";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/mail/ThemeToggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import {
  User,
  Mail,
  Plus,
  Sliders,
  CheckCircle2,
  Loader2,
  PenLine,
} from "lucide-react";

export default function GeneralSettingsPage() {
  const user = useAuthStore((s) => s.user);
  const { data: accounts, isLoading: accountsLoading } = useAccounts();
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const initials = getInitials(user?.email || "User");

  return (
    <>
      <AccountSidebar />
      <div className="flex flex-1 flex-col overflow-hidden bg-background">
        <SettingsNav
          title="Réglages Généraux"
          description="Gérez votre profil utilisateur, vos comptes de messagerie et vos préférences d'affichage."
        />

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto flex max-w-4xl flex-col gap-6">
            {/* 1. Carte Profil Utilisateur */}
            <div className="rounded-md border border-border bg-card/60 p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-4">
                <User className="size-4 text-primary" />
                <h2 className="text-sm font-bold font-display text-foreground">
                  Profil Utilisateur
                </h2>
              </div>

              <div className="flex items-center gap-4 p-3.5 rounded-md bg-muted/30 border border-border/50">
                <Avatar className="size-12 ring-2 ring-primary/20">
                  <AvatarFallback className="bg-primary text-primary-foreground font-bold text-base">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground truncate">
                      {user?.email}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-500 border border-emerald-500/20">
                      <CheckCircle2 className="size-3" /> Connecté
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono mt-0.5">
                    Identifiant : {user?.id}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Carte Comptes IMAP / OAuth Connectés */}
            <div className="rounded-md border border-border bg-card/60 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Mail className="size-4 text-primary" />
                  <h2 className="text-sm font-bold font-display text-foreground">
                    Comptes de Messagerie
                  </h2>
                </div>
                <Button
                  size="sm"
                  className="gap-1.5 text-xs h-8 bg-primary text-primary-foreground"
                  onClick={() => setAddAccountOpen(true)}
                >
                  <Plus className="size-3.5" />
                  Ajouter un compte
                </Button>
              </div>

              <p className="text-xs text-muted-foreground mb-3">
                Comptes IMAP et OAuth synchronisés avec HelloMail.
              </p>

              {accountsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : !accounts || accounts.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-6 text-center rounded-md bg-muted/20 border border-border/40">
                  <Mail className="size-8 text-muted-foreground/50 mb-2" />
                  <p className="text-xs font-medium text-foreground">Aucun compte de messagerie lié</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Ajoutez vos identifiants IMAP/SMTP pour commencer à recevoir et envoyer des emails.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {accounts.map((acc) => (
                    <AccountItem
                      key={acc._id}
                      account={acc}
                      isSelected={false}
                      onSelect={() => {}}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* 3. Carte Signatures de Messagerie */}
            <div className="rounded-md border border-border bg-card/60 p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-4">
                <PenLine className="size-4 text-primary" />
                <h2 className="text-sm font-bold font-display text-foreground">
                  Signatures de Messagerie
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Définissez une signature personnalisée pour chacun de vos comptes connectés. Elle sera automatiquement insérée lors de la rédaction d&apos;un nouvel email ou d&apos;une réponse.
              </p>
              <AccountSignatureManager />
            </div>

            {/* 4. Carte Préférences & Thème */}
            <div className="rounded-md border border-border bg-card/60 p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-4">
                <Sliders className="size-4 text-primary" />
                <h2 className="text-sm font-bold font-display text-foreground">
                  Préférences d&apos;Interface
                </h2>
              </div>

              <div className="flex flex-col divide-y divide-border/60">
                <div className="flex items-center justify-between py-3">
                  <div>
                    <span className="text-xs font-medium text-foreground">Thème de l&apos;application</span>
                    <p className="text-[11px] text-muted-foreground">
                      Basculez entre le mode clair et le mode sombre Obsidian.
                    </p>
                  </div>
                  <ThemeToggle />
                </div>

                <div className="flex items-center justify-between py-3">
                  <div>
                    <span className="text-xs font-medium text-foreground">Flux temps réel (SSE)</span>
                    <p className="text-[11px] text-muted-foreground">
                      Synchronisation immédiate des nouveaux messages sans rechargement.
                    </p>
                  </div>
                  <span className="text-[11px] font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Activé
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AddAccountDialog open={addAccountOpen} onOpenChange={setAddAccountOpen} />
    </>
  );
}
