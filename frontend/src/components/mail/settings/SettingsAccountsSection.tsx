"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/authStore";
import { useAccounts } from "@/lib/queries/accounts";
import { use2FAStatus, useMe } from "@/lib/queries/auth";
import { AddAccountDialog } from "@/components/accounts/AddAccountDialog";
import { AccountItem } from "@/components/accounts/AccountItem";
import { EmailAvatar } from "@/components/mail/EmailAvatar";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import {
  Mail,
  Plus,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  KeyRound,
  ArrowRight,
} from "lucide-react";

export function SettingsAccountsSection() {
  const router = useRouter();
  const storeUser = useAuthStore((s) => s.user);
  const { data: meData, isLoading: meLoading } = useMe();
  const user = meData?.user ?? storeUser;

  // Synchronise le store si useMe a résolu l'utilisateur
  useEffect(() => {
    if (meData?.user && !storeUser) {
      useAuthStore.setState({ user: meData.user });
    }
  }, [meData?.user, storeUser]);

  const { data: accounts, isLoading: accountsLoading } = useAccounts();
  const { data: twoFactorStatus } = use2FAStatus();
  const [addAccountOpen, setAddAccountOpen] = useState(false);

  const is2FA = twoFactorStatus?.twoFactorEnabled ?? false;

  return (
    <div className="space-y-6">
      {/* 1. Carte Fiche d'Identité & Sécurité du Compte Principal */}
      <div className="rounded-xl border border-border bg-card/60 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/50">
          <div className="flex items-center gap-3.5">
            <EmailAvatar
              email={user?.email}
              name={user?.email}
              className="size-12 ring-2 ring-primary/20 shrink-0"
              fallbackClassName="bg-primary text-primary-foreground font-bold text-base"
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold font-display text-foreground">
                  {user?.email || (meLoading ? "Chargement du compte..." : "Compte HelloMail")}
                </h2>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-semibold">
                  Compte Maître
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Identifiant système : <span className="font-mono text-[11px]">{user?.id || (meLoading ? "Chargement..." : "—")}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/mail/settings?section=security")}
              className="text-xs gap-1.5 h-8 cursor-pointer"
            >
              <KeyRound className="size-3.5" />
              <span>Gérer la sécurité 2FA</span>
              <ArrowRight className="size-3 text-muted-foreground" />
            </Button>
          </div>
        </div>

        {/* Grille de métriques de sécurité et du profil */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-4">
          <div className="p-3.5 rounded-lg bg-muted/20 border border-border/40">
            <span className="text-[11px] text-muted-foreground font-medium block">
              Double authentification (2FA)
            </span>
            <div className="flex items-center gap-1.5 mt-1.5">
              {is2FA ? (
                <>
                  <ShieldCheck className="size-4 text-emerald-500 shrink-0" />
                  <span className="text-xs font-semibold text-emerald-500">Activée (TOTP / Passkey)</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="size-4 text-amber-500 shrink-0" />
                  <span className="text-xs font-semibold text-amber-500">Non configurée</span>
                </>
              )}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-muted/20 border border-border/40">
            <span className="text-[11px] text-muted-foreground font-medium block">
              Chiffrement des mots de passe
            </span>
            <div className="flex items-center gap-1.5 mt-1.5">
              <ShieldCheck className="size-4 text-emerald-500 shrink-0" />
              <span className="text-xs font-semibold text-foreground">AES-256-GCM matériel</span>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-muted/20 border border-border/40">
            <span className="text-[11px] text-muted-foreground font-medium block">
              Boîtes synchronisées
            </span>
            <div className="flex items-center gap-1.5 mt-1.5">
              <Mail className="size-4 text-primary shrink-0" />
              <span className="text-xs font-semibold text-foreground">
                {accounts?.length ?? 0} compte{(accounts?.length ?? 0) > 1 ? "s" : ""} relié{(accounts?.length ?? 0) > 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Carte Comptes IMAP / OAuth Connectés */}
      <div className="rounded-xl border border-border bg-card/60 p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Mail className="size-4 text-primary" />
            <h2 className="text-sm sm:text-base font-bold font-display text-foreground">
              Comptes de Messagerie Synchronisés
            </h2>
          </div>
          <Button
            size="sm"
            className="gap-1.5 text-xs h-8 bg-primary text-primary-foreground cursor-pointer shadow-xs"
            onClick={() => setAddAccountOpen(true)}
          >
            <Plus className="size-3.5" />
            Ajouter un compte
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          Comptes synchronisés en continu via IMAP IDLE et protocoles OAuth XOAUTH2 (Google & Microsoft).
        </p>

        {accountsLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : !accounts || accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center rounded-lg bg-muted/20 border border-border/40">
            <Mail className="size-10 text-muted-foreground/40 mb-3" />
            <p className="text-xs font-semibold text-foreground">Aucun compte de messagerie lié</p>
            <p className="text-[11px] text-muted-foreground mt-1 max-w-sm">
              Ajoutez vos identifiants IMAP/SMTP ou connectez votre compte Google / Microsoft pour commencer à recevoir et envoyer vos emails.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-4 gap-1.5 text-xs cursor-pointer"
              onClick={() => setAddAccountOpen(true)}
            >
              <Plus className="size-3.5" />
              Configurer un premier compte
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

      <AddAccountDialog open={addAccountOpen} onOpenChange={setAddAccountOpen} />
    </div>
  );
}
