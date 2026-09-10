"use client";

import { AccountSidebar } from "@/components/mail/AccountSidebar";
import { SettingsNav } from "@/components/mail/SettingsNav";
import { TwoFactorSettings } from "@/components/auth/TwoFactorSettings";
import { ShieldCheck, Lock } from "lucide-react";

export function SecuritySettingsPage() {
  return (
    <>
      <AccountSidebar />
      <div className="flex flex-1 flex-col overflow-hidden bg-background">
        <SettingsNav
          title="Sécurité & Authentification"
          description="Protégez votre compte HelloMail avec l'authentification à deux facteurs et vos clés de sécurité."
        />

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto flex max-w-4xl flex-col gap-6">
            <div className="rounded-md border border-border bg-card/60 p-6 shadow-xs">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/60">
                <ShieldCheck className="size-4 text-primary" />
                <h2 className="text-sm font-bold font-display text-foreground">
                  Authentification à deux facteurs (2FA)
                </h2>
              </div>
              <TwoFactorSettings />
            </div>

            <div className="rounded-md border border-border bg-card/60 p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-3">
                <Lock className="size-4 text-muted-foreground" />
                <h3 className="text-xs font-semibold font-display text-foreground">
                  Bonnes pratiques de sécurité
                </h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                HelloMail chiffre vos mots de passe IMAP/SMTP en base avec AES-256-GCM. L&apos;activation de la 2FA (via Google Authenticator, Bitwarden ou 1Password) empêche toute connexion non autorisée même si vos identifiants sont compromis.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default SecuritySettingsPage;
