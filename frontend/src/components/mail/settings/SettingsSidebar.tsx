"use client";

import Link from "next/link";
import { ArrowLeft, Monitor, Smartphone, Tablet, Search } from "lucide-react";
import { SETTINGS_GROUPS, type SettingsSectionId } from "@/lib/types/settings";
import { useScreenSize } from "@/hooks/useScreenSize";
import { cn } from "@/lib/utils";

interface SettingsSidebarProps {
  activeSection: SettingsSectionId;
  onSelectSection: (id: SettingsSectionId) => void;
  badges: Record<string, number | boolean | undefined>;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function SettingsSidebar({
  activeSection,
  onSelectSection,
  badges,
  searchQuery,
  onSearchChange,
}: SettingsSidebarProps) {
  const screenSize = useScreenSize();

  const getBadgeContent = (key?: string) => {
    if (!key) return null;
    const val = badges[key];
    if (typeof val === "number" && val > 0) {
      return (
        <span className="ml-auto text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-muted text-muted-foreground border border-border/60">
          {val}
        </span>
      );
    }
    if (typeof val === "boolean" && val) {
      return (
        <span className="ml-auto text-[9px] font-semibold uppercase px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
          Actif
        </span>
      );
    }
    return null;
  };

  return (
    <aside className="flex flex-col w-64 xl:w-72 shrink-0 border-r border-border bg-card/40 backdrop-blur-xs select-none">
      {/* En-tête : Bouton retour et Titre */}
      <div className="p-3 border-b border-border/60 flex items-center justify-between">
        <Link
          href="/mail"
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          title="Retourner à la boîte de réception"
        >
          <ArrowLeft className="size-3.5" />
          <span>Boîte de réception</span>
        </Link>

        {/* Indicateur de détection de taille d'écran */}
        <div
          className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono text-muted-foreground bg-muted/40 border border-border/40"
          title={`Résolution détectée : ${screenSize.width}×${screenSize.height}px (${screenSize.breakpoint})`}
        >
          {screenSize.isWide ? (
            <Monitor className="size-3 text-primary" />
          ) : screenSize.isTablet ? (
            <Tablet className="size-3 text-amber-500" />
          ) : (
            <Smartphone className="size-3 text-blue-500" />
          )}
          <span>{screenSize.breakpoint.toUpperCase()}</span>
        </div>
      </div>

      {/* Barre de recherche dans les paramètres */}
      <div className="px-3 pt-2.5 pb-1.5">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher un réglage..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-7 pl-7 pr-2 text-xs rounded-md bg-muted/30 border border-border/60 placeholder:text-muted-foreground/60 focus:outline-hidden focus:border-primary/60 focus:bg-background transition-colors"
          />
        </div>
      </div>

      {/* Groupes de navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
        {SETTINGS_GROUPS.map((group) => {
          const filteredItems = group.items.filter((item) => {
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (
              item.label.toLowerCase().includes(q) ||
              item.description.toLowerCase().includes(q)
            );
          });

          if (filteredItems.length === 0) return null;

          return (
            <div key={group.title} className="space-y-1">
              <h3 className="px-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 font-mono">
                {group.title}
              </h3>
              <div className="space-y-0.5">
                {filteredItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  const badge = getBadgeContent(item.badgeKey);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectSection(item.id)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all text-left cursor-pointer",
                        isActive
                          ? "bg-primary/10 text-primary font-semibold shadow-2xs border border-primary/20"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent",
                      )}
                    >
                      <Icon className={cn("size-3.5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                      <span className="truncate">{item.label}</span>
                      {badge}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Pied de page du menu réglages */}
      <div className="p-3 border-t border-border/60 bg-muted/10">
        <p className="text-[11px] text-muted-foreground text-center">
          Mailora v1.0 • Paramètres
        </p>
      </div>
    </aside>
  );
}
