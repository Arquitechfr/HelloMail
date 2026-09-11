"use client";

import { useEffect } from "react";
import { useUIStore } from "@/lib/stores/uiStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Keyboard, Command } from "lucide-react";

interface ShortcutGroup {
  title: string;
  items: { key: string; description: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Actions de rédaction",
    items: [
      { key: "C", description: "Rédiger un nouvel email" },
      { key: "R", description: "Répondre à l'email affiché" },
      { key: "Shift + R", description: "Répondre à tous les destinataires" },
      { key: "F", description: "Transférer l'email affiché" },
      { key: "Z", description: "Annuler l'envoi en cours (Undo Send)" },
      { key: "P", description: "Imprimer l'email affiché" },
      { key: "Esc", description: "Fermer le panneau ou dialogue" },
    ],
  },
  {
    title: "Tri & Actions rapides sur les emails",
    items: [
      { key: "U", description: "Bascule lu / non lu" },
      { key: "S", description: "Marquer comme important (étoile)" },
      { key: "H", description: "Mettre en avant / épingler le message" },
      { key: "E", description: "Archiver le message" },
      { key: "!", description: "Signaler comme spam / indésirable" },
      { key: "Suppr / #", description: "Supprimer le message" },
    ],
  },
  {
    title: "Navigation & Recherche",
    items: [
      { key: "Cmd + K", description: "Recherche globale et filtres" },
      { key: "/", description: "Activer la barre de recherche" },
      { key: "?", description: "Afficher cette aide des raccourcis" },
    ],
  },
  {
    title: "Gestion des dossiers",
    items: [
      { key: "Shift + N", description: "Créer un sous-dossier dans le dossier actif" },
      { key: "F2", description: "Renommer le dossier actif" },
      { key: "Suppr", description: "Supprimer le dossier actif (si personnalisable)" },
    ],
  },
];


export function KeyboardShortcutsDialog() {
  const {
    shortcutsDialogOpen,
    setShortcutsDialogOpen,
    openCompose,
    composeOpen,
    openSearch,
  } = useUIStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable ||
        target?.closest(".tiptap");

      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        openSearch();
        return;
      }

      if (isInput) return;

      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShortcutsDialogOpen(!shortcutsDialogOpen);
      } else if ((e.key === "c" || e.key === "C") && !e.metaKey && !e.ctrlKey && !composeOpen) {
        e.preventDefault();
        openCompose("new");
      } else if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        openSearch();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcutsDialogOpen, setShortcutsDialogOpen, openCompose, composeOpen, openSearch]);

  return (
    <Dialog open={shortcutsDialogOpen} onOpenChange={setShortcutsDialogOpen}>
      <DialogContent className="sm:max-w-lg border-border bg-card p-6 shadow-2xl">
        <DialogHeader className="mb-4">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Keyboard className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold tracking-tight font-display">
                Raccourcis Clavier
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Naviguez et traitez vos emails à la vitesse de l&apos;éclair façon Superhuman.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-5 divide-y divide-border">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title} className="pt-3 first:pt-0">
              <h4 className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {group.title}
              </h4>
              <div className="flex flex-col gap-1.5">
                {group.items.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between text-xs py-1 px-1 rounded-sm hover:bg-muted/40 transition-colors"
                  >
                    <span className="text-foreground">{item.description}</span>
                    <kbd className="inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[11px] font-medium text-foreground shadow-xs">
                      {item.key.includes("Cmd") ? (
                        <>
                          <Command className="size-3" /> K
                        </>
                      ) : (
                        item.key
                      )}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
