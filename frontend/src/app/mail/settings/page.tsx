"use client";

import { useState } from "react";
import { useAuthStore } from "@/lib/stores/authStore";
import { useAccounts } from "@/lib/queries/accounts";
import { AccountSidebar } from "@/components/mail/AccountSidebar";
import { SettingsNav } from "@/components/mail/SettingsNav";
import { AddAccountDialog } from "@/components/accounts/AddAccountDialog";
import { AccountItem } from "@/components/accounts/AccountItem";
import { AccountSignatureManager } from "@/components/accounts/AccountSignatureManager";
import { NotificationSettings } from "@/components/mail/NotificationSettings";
import { TagManager } from "@/components/mail/TagManager";
import { UndoSendSettings } from "@/components/mail/UndoSendSettings";
import { TemplateManager } from "@/components/mail/TemplateManager";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/mail/ThemeToggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials, cn } from "@/lib/utils";
import {
  User,
  Mail,
  Plus,
  Sliders,
  CheckCircle2,
  Loader2,
  PenLine,
  Bell,
  Layers,
  Tag as TagIcon,
  Sparkles,
} from "lucide-react";

type SettingsTab = "accounts" | "signatures" | "templates" | "tags" | "notifications" | "appearance" | "all";

const TABS: { id: SettingsTab; label: string; icon: typeof Mail }[] = [
  { id: "accounts", label: "Comptes & Profil", icon: Mail },
  { id: "signatures", label: "Signatures", icon: PenLine },
  { id: "templates", label: "Modèles d'emails", icon: Sparkles },
  { id: "tags", label: "Libellés & Étiquettes", icon: TagIcon },
  { id: "notifications", label: "Notifications & Son", icon: Bell },
  { id: "appearance", label: "Affichage & Système", icon: Sliders },
  { id: "all", label: "Tout afficher", icon: Layers },
];

export default function GeneralSettingsPage() {
  const user = useAuthStore((s) => s.user);
  const { data: accounts, isLoading: accountsLoading } = useAccounts();
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>("accounts");
  const initials = getInitials(user?.email || "User");

  const showAccounts = activeTab === "accounts" || activeTab === "all";
  const showSignatures = activeTab === "signatures" || activeTab === "all";
  const showTemplates = activeTab === "templates" || activeTab === "all";
  const showTags = activeTab === "tags" || activeTab === "all";
  const showNotifications = activeTab === "notifications" || activeTab === "all";
  const showAppearance = activeTab === "appearance" || activeTab === "all";

  return (
    <>
      <AccountSidebar />
      <div className="flex flex-1 flex-col overflow-hidden bg-background">
        <SettingsNav
          title="Réglages Généraux"
          description="Gérez votre profil utilisateur, vos comptes de messagerie et vos préférences d'affichage."
        />

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto flex max-w-4xl xl:max-w-5xl flex-col gap-6">
            {/* Barre d'onglets de réglages */}
            <div className="flex items-center gap-1.5 overflow-x-auto p-1 rounded-lg bg-muted/40 border border-border/60 shadow-2xs">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap cursor-pointer select-none",
                      active
                        ? "bg-background text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                    )}
                  >
                    <Icon className={cn("size-3.5", active ? "text-primary" : "text-muted-foreground")} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* 1. Carte Profil Utilisateur */}
            {showAccounts && (
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
            )}

            {/* 2. Carte Comptes IMAP / OAuth Connectés */}
            {showAccounts && (
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
            )}

            {/* 3. Carte Signatures de Messagerie */}
            {showSignatures && (
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
            )}

            {/* 3. Carte Modèles & Réponses types */}
            {showTemplates && <TemplateManager />}

            {/* 4. Carte Libellés & Étiquettes */}
            {showTags && <TagManager />}

            {/* 4. Carte Notifications & Son */}
            {showNotifications && <NotificationSettings />}

            {/* 5. Carte Préférences & Thème */}
            {showAppearance && (
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

                  <UndoSendSettings />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <AddAccountDialog open={addAccountOpen} onOpenChange={setAddAccountOpen} />
    </>
  );
}
