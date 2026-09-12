"use client";

import { useState, useTransition, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAccounts } from "@/lib/queries/accounts";
import { useTags } from "@/lib/queries/tags";
import { useRules } from "@/lib/queries/rules";
import { use2FAStatus } from "@/lib/queries/auth";
import { useContacts } from "@/lib/queries/contacts";
import { useTemplates } from "@/lib/queries/templates";
import { useScreenSize } from "@/hooks/useScreenSize";
import { SettingsSidebar } from "@/components/mail/settings/SettingsSidebar";
import { SettingsHeader } from "@/components/mail/settings/SettingsHeader";
import { SettingsAccountsSection } from "@/components/mail/settings/SettingsAccountsSection";
import { SettingsAppearanceSection } from "@/components/mail/settings/SettingsAppearanceSection";
import { AccountSignatureManager } from "@/components/accounts/AccountSignatureManager";
import { NotificationSettings } from "@/components/mail/NotificationSettings";
import { TagManager } from "@/components/mail/TagManager";
import { TemplateManager } from "@/components/mail/TemplateManager";
import { RulesList } from "@/components/mail/rules/RulesList";
import { TwoFactorSettings } from "@/components/auth/TwoFactorSettings";
import { ContactsManager } from "@/components/auth/ContactsManager";
import { PgpKeyManager } from "@/components/security/PgpKeyManager";
import { SenderListsSettings } from "@/components/settings/SenderListsSettings";
import type { SettingsSectionId } from "@/lib/types/settings";
import { PenLine, ShieldCheck, Lock, Users, Loader2 } from "lucide-react";

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}

function SettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const screenSize = useScreenSize();

  const sectionParam = searchParams.get("section") as SettingsSectionId | null;
  const [activeSection, setActiveSection] = useState<SettingsSectionId>(
    sectionParam || "accounts",
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Requêtes pour les badges dynamiques dans la barre latérale
  const { data: accounts } = useAccounts();
  const { data: tagsData } = useTags();
  const { data: rulesData } = useRules();
  const { data: twoFactorStatus } = use2FAStatus();
  const { data: contactsData } = useContacts();
  const { data: templatesData } = useTemplates();

  const badges = {
    accounts: accounts?.length,
    tags: tagsData?.data?.length,
    rules: rulesData?.data?.length,
    twoFactor: twoFactorStatus?.twoFactorEnabled,
    contacts: contactsData?.contacts?.length,
    templates: templatesData?.data?.length,
  };

  const handleSelectSection = (id: SettingsSectionId) => {
    setActiveSection(id);
    startTransition(() => {
      router.replace(`/mail/settings?section=${id}`, { scroll: false });
    });
  };

  const renderSectionContent = () => {
    switch (activeSection) {
      case "accounts":
        return <SettingsAccountsSection />;

      case "signatures":
        return (
          <div className="rounded-lg border border-border bg-card/60 p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/50">
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
        );

      case "templates":
        return <TemplateManager />;

      case "rules":
        return <RulesList />;

      case "tags":
        return <TagManager />;

      case "security":
        return (
          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-card/60 p-6 shadow-xs">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/60">
                <ShieldCheck className="size-4 text-primary" />
                <h2 className="text-sm font-bold font-display text-foreground">
                  Authentification à deux facteurs (2FA) & Passkeys
                </h2>
              </div>
              <TwoFactorSettings />
            </div>

            <PgpKeyManager />

            <SenderListsSettings />

            <div className="rounded-lg border border-border bg-card/60 p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-3">
                <Lock className="size-4 text-muted-foreground" />
                <h3 className="text-xs font-semibold font-display text-foreground">
                  Chiffrement et Sécurité du stockage
                </h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Vos mots de passe et jetons d&apos;accès OAuth sont chiffrés avec l&apos;algorithme AES-256-GCM. L&apos;activation de la 2FA (via TOTP ou clés WebAuthn) bloque tout accès non autorisé à votre boîte.
              </p>
            </div>
          </div>
        );

      case "contacts":
        return (
          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-card/60 p-6 shadow-xs">
              <ContactsManager />
            </div>
            <div className="rounded-lg border border-border bg-card/60 p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-3">
                <Users className="size-4 text-muted-foreground" />
                <h3 className="text-xs font-semibold font-display text-foreground">
                  Autocomplétion intelligente
                </h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Les correspondants enregistrés dans votre carnet d&apos;adresses sont immédiatement suggérés lors de la saisie d&apos;adresses dans le composeur d&apos;emails.
              </p>
            </div>
          </div>
        );

      case "notifications":
        return <NotificationSettings />;

      case "appearance":
        return <SettingsAppearanceSection />;

      case "all":
        return (
          <div className="space-y-8">
            <section id="sec-accounts" className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground font-mono">1. Profil & Comptes</h3>
              <SettingsAccountsSection />
            </section>
            <section id="sec-signatures" className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground font-mono">2. Signatures</h3>
              <div className="rounded-lg border border-border bg-card/60 p-5 shadow-xs">
                <AccountSignatureManager />
              </div>
            </section>
            <section id="sec-templates" className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground font-mono">3. Modèles d&apos;emails</h3>
              <TemplateManager />
            </section>
            <section id="sec-rules" className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground font-mono">4. Règles & Filtres</h3>
              <RulesList />
            </section>
            <section id="sec-tags" className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground font-mono">5. Libellés & Étiquettes</h3>
              <TagManager />
            </section>
            <section id="sec-security" className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground font-mono">6. Sécurité & 2FA</h3>
              <div className="rounded-lg border border-border bg-card/60 p-6 shadow-xs">
                <TwoFactorSettings />
              </div>
            </section>
            <section id="sec-notifications" className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground font-mono">7. Notifications & Son</h3>
              <NotificationSettings />
            </section>
            <section id="sec-appearance" className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground font-mono">8. Affichage & Envoi</h3>
              <SettingsAppearanceSection />
            </section>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-1 overflow-hidden bg-background">
      {/* Barre latérale Master-Detail (Desktop / Tablette) */}
      {!screenSize.isMobile && (
        <SettingsSidebar
          activeSection={activeSection}
          onSelectSection={handleSelectSection}
          badges={badges}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      )}

      {/* Contenu principal des paramètres */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <SettingsHeader
          activeSection={activeSection}
          onSelectSection={handleSelectSection}
          isMobile={screenSize.isMobile}
        />

        {/* Zone de contenu défilante adaptative */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-5xl xl:max-w-6xl">
            {renderSectionContent()}
          </div>
        </div>
      </main>
    </div>
  );
}
