"use client";

import { AccountSidebar } from "@/components/mail/AccountSidebar";
import { SettingsNav } from "@/components/mail/SettingsNav";
import { ContactsManager } from "@/components/auth/ContactsManager";
import { BookUser } from "lucide-react";

export function ContactsPage() {
  return (
    <>
      <AccountSidebar />
      <div className="flex flex-1 flex-col overflow-hidden bg-background">
        <SettingsNav
          title="Carnet d'Adresses & Contacts"
          description="Gérez votre carnet de contacts, enregistrez de nouveaux correspondants et écrivez-leur en un clic."
        />

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto flex max-w-4xl flex-col gap-6">
            <div className="rounded-md border border-border bg-card/60 p-6 shadow-xs">
              <ContactsManager />
            </div>

            <div className="rounded-md border border-border bg-card/60 p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-3">
                <BookUser className="size-4 text-muted-foreground" />
                <h3 className="text-xs font-semibold font-display text-foreground">
                  Autocomplétion intelligente
                </h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Les contacts enregistrés dans votre carnet d&apos;adresses sont automatiquement suggérés lors de la rédaction d&apos;un email dans les champs Destinataires, Cc et Cci.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default ContactsPage;
