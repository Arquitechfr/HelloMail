"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, ShieldCheck, Users, Filter, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsNavProps {
  title: string;
  description?: string;
}

export function SettingsNav({ title, description }: SettingsNavProps) {
  const pathname = usePathname();

  const tabs = [
    {
      label: "Général & Comptes",
      href: "/mail/settings",
      icon: Settings,
      active: pathname === "/mail/settings",
    },
    {
      label: "Règles & Filtres",
      href: "/mail/settings/rules",
      icon: Filter,
      active: pathname === "/mail/settings/rules",
    },
    {
      label: "Sécurité & 2FA",
      href: "/mail/settings/security",
      icon: ShieldCheck,
      active: pathname === "/mail/settings/security",
    },
    {
      label: "Carnet d'adresses",
      href: "/mail/contacts",
      icon: Users,
      active: pathname === "/mail/contacts",
    },
  ];

  return (
    <div className="shrink-0 border-b border-border bg-background/80 backdrop-blur-xs select-none">
      {/* Barre supérieure avec bouton retour et titre */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/50">
        <div className="flex items-center gap-3">
          <Link
            href="/mail"
            className="flex size-7 items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Retour à la boîte de réception"
            aria-label="Retour"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="text-sm font-bold font-display tracking-tight text-foreground">
              {title}
            </h1>
            {description && (
              <p className="text-[11px] text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Onglets de navigation entre pages */}
      <div className="flex items-center gap-1 px-6 pt-2 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 text-xs font-medium border-b-2 transition-colors -mb-px whitespace-nowrap",
                tab.active
                  ? "border-primary text-foreground font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
              )}
            >
              <Icon className={cn("size-3.5", tab.active ? "text-primary" : "text-muted-foreground")} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
