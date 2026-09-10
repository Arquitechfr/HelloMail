"use client";

import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { SETTINGS_GROUPS, type SettingsSectionId } from "@/lib/types/settings";
import { cn } from "@/lib/utils";

interface SettingsHeaderProps {
  activeSection: SettingsSectionId;
  onSelectSection: (id: SettingsSectionId) => void;
  isMobile: boolean;
}

export function SettingsHeader({
  activeSection,
  onSelectSection,
  isMobile,
}: SettingsHeaderProps) {
  // Trouver l'item actif
  let activeItem = SETTINGS_GROUPS.flatMap((g) => g.items).find(
    (i) => i.id === activeSection,
  );
  if (!activeItem) {
    activeItem = {
      id: "accounts",
      label: "Profil & Comptes",
      description: "Gérez vos comptes de messagerie et vos identifiants",
      icon: SETTINGS_GROUPS[0].items[0].icon,
    };
  }

  const ActiveIcon = activeItem.icon;

  return (
    <header className="shrink-0 border-b border-border bg-background/80 backdrop-blur-xs px-4 sm:px-6 py-3 select-none">
      <div className="flex flex-col gap-2">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link
              href="/mail"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              <span>Messagerie</span>
            </Link>
            <ChevronRight className="size-3 text-muted-foreground/60" />
            <span className="text-muted-foreground font-medium">Réglages</span>
            <ChevronRight className="size-3 text-muted-foreground/60" />
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <ActiveIcon className="size-3.5 text-primary" />
              {activeItem.label}
            </span>
          </div>
        </div>

        {/* Sélecteur de catégorie adapté sur écran mobile */}
        {isMobile && (
          <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 no-scrollbar">
            {SETTINGS_GROUPS.flatMap((g) => g.items).map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectSection(item.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0",
                    isActive
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="size-3" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Titre & Description contextuelle */}
        <div>
          <h1 className="text-base sm:text-lg font-bold font-display text-foreground tracking-tight flex items-center gap-2">
            <span>{activeItem.label}</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {activeItem.description}
          </p>
        </div>
      </div>
    </header>
  );
}
