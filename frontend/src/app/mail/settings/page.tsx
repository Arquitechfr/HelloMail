"use client";

import Link from "next/link";
import { TwoFactorSettings } from "@/components/auth/TwoFactorSettings";
import { ContactsManager } from "@/components/auth/ContactsManager";
import { AccountSidebar } from "@/components/mail/AccountSidebar";
import { GlassPanel } from "@/components/mail/GlassPanel";
import { ArrowLeft, Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <>
      <AccountSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-3 border-b border-border px-6 py-4">
          <Link
            href="/mail"
            className="flex size-8 items-center justify-center rounded-lg hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="flex items-center gap-2">
            <Settings className="size-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold">Réglages</h1>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-2">
            <GlassPanel variant="strong" className="p-6">
              <h2 className="mb-4 text-base font-semibold">Sécurité</h2>
              <TwoFactorSettings />
            </GlassPanel>

            <GlassPanel variant="strong" className="p-6">
              <h2 className="mb-4 text-base font-semibold">Contacts</h2>
              <ContactsManager />
            </GlassPanel>
          </div>
        </div>
      </div>
    </>
  );
}
