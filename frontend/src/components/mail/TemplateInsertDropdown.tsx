"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { FileText, Search, Plus, Sparkles, Settings } from "lucide-react";
import { useTemplates } from "@/lib/queries/templates";
import type { EmailTemplate } from "@/lib/types/templates";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface TemplateInsertDropdownProps {
  accountId?: string;
  onSelectTemplate: (template: EmailTemplate) => void;
  variant?: "button" | "icon";
  className?: string;
}

export function TemplateInsertDropdown({
  accountId,
  onSelectTemplate,
  variant = "button",
  className,
}: TemplateInsertDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: templatesData, isLoading } = useTemplates(accountId);

  const filteredTemplates = useMemo(() => {
    const list = templatesData?.data ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase().trim();
    return list.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.shortcut && t.shortcut.toLowerCase().includes(q)) ||
        (t.subject && t.subject.toLowerCase().includes(q)) ||
        t.bodyText.toLowerCase().includes(q),
    );
  }, [templatesData?.data, search]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (template: EmailTemplate) => {
    onSelectTemplate(template);
    setIsOpen(false);
  };

  return (
    <div className={cn("relative inline-block", className)} ref={dropdownRef}>
      {variant === "button" ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs h-8 gap-1.5 border-border/80 hover:bg-muted cursor-pointer"
          title="Insérer un modèle ou réponse type"
        >
          <Sparkles className="size-3.5 text-primary" />
          <span>Modèles</span>
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setIsOpen(!isOpen)}
          className="cursor-pointer"
          title="Insérer un modèle ou réponse type"
        >
          <Sparkles className="size-4 text-muted-foreground hover:text-primary" />
        </Button>
      )}

      {isOpen && (
        <div className="absolute right-0 bottom-full mb-1.5 w-72 sm:w-80 rounded-lg border border-border bg-popover/95 p-2 shadow-xl backdrop-blur-md z-50 animate-in fade-in-0 zoom-in-95">
          <div className="flex items-center justify-between pb-1.5 border-b border-border/60 px-1 mb-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <FileText className="size-3.5 text-primary" />
              <span>Réponses types & Modèles</span>
            </div>
            <Link
              href="/mail/settings"
              className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-0.5"
              title="Gérer les modèles dans les réglages"
              onClick={() => setIsOpen(false)}
            >
              <Settings className="size-3" />
              <span>Gérer</span>
            </Link>
          </div>

          <div className="relative mb-2 px-1">
            <Search className="absolute left-2.5 top-2 size-3 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher (ex: !merci, Devis...)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-border bg-muted/40 pl-7 pr-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
          </div>

          <div className="max-h-56 overflow-y-auto flex flex-col gap-0.5 px-0.5">
            {isLoading ? (
              <div className="p-3 text-center text-xs text-muted-foreground">
                Chargement des modèles...
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="p-3 text-center text-xs text-muted-foreground flex flex-col items-center gap-1.5">
                <span>{search ? "Aucun modèle correspondant" : "Aucun modèle enregistré"}</span>
                <Link
                  href="/mail/settings"
                  className="text-primary hover:underline text-[11px] font-medium flex items-center gap-1"
                  onClick={() => setIsOpen(false)}
                >
                  <Plus className="size-3" />
                  <span>Créer un modèle</span>
                </Link>
              </div>
            ) : (
              filteredTemplates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleSelect(tpl)}
                  className="flex flex-col items-start gap-0.5 w-full p-2 rounded-md text-left text-xs transition-colors hover:bg-muted/70 cursor-pointer group"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-semibold text-foreground truncate group-hover:text-primary">
                      {tpl.title}
                    </span>
                    {tpl.shortcut && (
                      <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20 shrink-0">
                        {tpl.shortcut}
                      </span>
                    )}
                  </div>
                  {tpl.subject && (
                    <span className="text-[11px] text-muted-foreground truncate w-full">
                      Objet : {tpl.subject}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground line-clamp-1 opacity-80">
                    {tpl.bodyText}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
