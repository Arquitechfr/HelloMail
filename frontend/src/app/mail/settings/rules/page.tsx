"use client";

import { AccountSidebar } from "@/components/mail/AccountSidebar";
import { SettingsNav } from "@/components/mail/SettingsNav";
import { RulesList } from "@/components/mail/rules/RulesList";

export default function RulesSettingsPage() {
  return (
    <>
      <AccountSidebar />
      <div className="flex flex-1 flex-col overflow-hidden bg-background">
        <SettingsNav
          title="Règles & Filtres de tri"
          description="Automatisez le tri, le classement et le traitement de vos emails entrants dès leur réception."
        />

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto flex max-w-4xl flex-col gap-6">
            <RulesList />
          </div>
        </div>
      </div>
    </>
  );
}
