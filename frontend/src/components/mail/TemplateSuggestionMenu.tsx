"use client";

import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { EmailTemplate } from "@/lib/types/templates";
import { Sparkles, FileText, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface TemplateSuggestionMenuProps {
  templates: EmailTemplate[];
  selectedIndex: number;
  query: string;
  coords: { top: number; left: number; bottom: number } | null;
  onSelect: (template: EmailTemplate) => void;
  onClose: () => void;
}

export function TemplateSuggestionMenu({
  templates,
  selectedIndex,
  query,
  coords,
  onSelect,
  onClose,
}: TemplateSuggestionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Fermeture si clic à l'extérieur
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);

  // Défilement automatique de l'élément sélectionné
  useEffect(() => {
    if (!menuRef.current) return;
    const activeItem = menuRef.current.querySelector<HTMLElement>("[data-active='true']");
    if (activeItem && typeof activeItem.scrollIntoView === "function") {
      activeItem.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (!coords || typeof document === "undefined") return null;

  const menuWidth = 320;
  const menuHeight = 240;

  // Calcul du positionnement pour éviter de sortir de l'écran
  const left = Math.max(10, Math.min(coords.left, window.innerWidth - menuWidth - 16));
  const spaceBelow = window.innerHeight - coords.bottom;
  const showAbove = spaceBelow < menuHeight && coords.top > menuHeight;
  const top = showAbove ? Math.max(10, coords.top - menuHeight - 8) : coords.bottom + 6;

  const content = (
    <div
      ref={menuRef}
      style={{ top: `${top}px`, left: `${left}px` }}
      className="fixed z-50 w-72 sm:w-80 rounded-xl border border-border bg-popover/95 p-1 text-popover-foreground shadow-2xl backdrop-blur-md animate-in fade-in-0 zoom-in-95 select-none"
    >
      {/* En-tête contextuel */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border/50 text-[11px] font-medium text-muted-foreground">
        <div className="flex items-center gap-1.5 text-foreground font-semibold">
          <Sparkles className="size-3 text-primary" />
          <span>Modèles d&apos;emails</span>
        </div>
        {query ? (
          <span className="font-mono text-[10px] px-1 rounded bg-muted text-foreground">
            !{query}
          </span>
        ) : (
          <span>Tapez pour filtrer</span>
        )}
      </div>

      {/* Liste des modèles */}
      <div className="max-h-52 overflow-y-auto p-1 flex flex-col gap-0.5">
        {templates.length === 0 ? (
          <div className="p-3 text-center text-xs text-muted-foreground">
            Aucun modèle ne correspond à « !{query} »
            <div className="mt-1 text-[10px] opacity-70">
              Appuyez sur Échap ou Espace pour continuer
            </div>
          </div>
        ) : (
          templates.map((tpl, index) => {
            const isSelected = index === selectedIndex;
            return (
              <button
                key={tpl.id}
                type="button"
                data-active={isSelected ? "true" : "false"}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelect(tpl);
                }}
                className={cn(
                  "flex flex-col items-start gap-0.5 w-full rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors cursor-pointer",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-foreground",
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-1.5 truncate">
                    <FileText className={cn("size-3.5 shrink-0", isSelected ? "text-primary-foreground" : "text-muted-foreground")} />
                    <span className="font-semibold truncate">{tpl.title}</span>
                  </div>
                  {tpl.shortcut && (
                    <span
                      className={cn(
                        "text-[10px] font-mono px-1.5 py-0.5 rounded border font-medium shrink-0 ml-1.5",
                        isSelected
                          ? "bg-primary-foreground/20 text-primary-foreground border-primary-foreground/30"
                          : "bg-muted text-primary border-border",
                      )}
                    >
                      {tpl.shortcut.startsWith("!") ? tpl.shortcut : `!${tpl.shortcut}`}
                    </span>
                  )}
                </div>

                {tpl.subject && (
                  <span
                    className={cn(
                      "text-[10px] truncate w-full",
                      isSelected ? "text-primary-foreground/80" : "text-muted-foreground",
                    )}
                  >
                    Objet : {tpl.subject}
                  </span>
                )}

                <span
                  className={cn(
                    "text-[10px] line-clamp-1 w-full opacity-90",
                    isSelected ? "text-primary-foreground/90" : "text-muted-foreground",
                  )}
                >
                  {tpl.bodyText}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Raccourcis d'aide en bas */}
      <div className="flex items-center justify-between px-2.5 py-1 border-t border-border/40 text-[10px] text-muted-foreground">
        <span>↑↓ naviguer · Échap / Espace annuler</span>
        <span className="flex items-center gap-0.5 font-medium">
          <CornerDownLeft className="size-2.5" />
          <span>insérer</span>
        </span>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
