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
    title: "Navigation & Sélection Power User",
    items: [
      { key: "J / ↓", description: "Email suivant dans la liste" },
      { key: "K / ↑", description: "Email précédent dans la liste" },
      { key: "X", description: "Cocher / décocher pour action groupée" },
      { key: "Shift + J / K", description: "Étendre la sélection vers le bas / haut" },
      { key: "Shift + Clic", description: "Sélectionner une plage continue d'emails" },
      { key: "Cmd + A", description: "Sélectionner tous les emails affichés" },
      { key: "Esc", description: "Vider la sélection ou fermer le lecteur" },
    ],
  },
  {
    title: "Actions de rédaction",
    items: [
      { key: "C", description: "Rédiger un nouvel email" },
      { key: "R", description: "Répondre à l'email affiché" },
      { key: "Shift + R", description: "Répondre à tous les destinataires" },
      { key: "F", description: "Transférer l'email affiché" },
      { key: "Z", description: "Annuler l'envoi en cours (Undo Send)" },
      { key: "P", description: "Imprimer l'email affiché" },
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
    title: "Recherche & Aide",
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

  const leftGroups = SHORTCUT_GROUPS.slice(0, 2);
  const rightGroups = SHORTCUT_GROUPS.slice(2);

  const renderGroup = (group: ShortcutGroup) => (
    <div key={group.title} className="flex flex-col gap-2 rounded-lg border border-border/50 bg-muted/20 p-3.5">
      <h4 className="text-xs font-semibold text-foreground tracking-wide flex items-center justify-between">
        <span>{group.title}</span>
        <span className="text-[10px] text-muted-foreground font-normal">
          {group.items.length} raccourci{group.items.length > 1 ? "s" : ""}
        </span>
      </h4>
      <div className="flex flex-col gap-1">
        {group.items.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between text-xs py-1 px-1.5 rounded-sm hover:bg-background/80 transition-colors"
          >
            <span className="text-muted-foreground hover:text-foreground transition-colors">{item.description}</span>
            <kbd className="inline-flex h-5 items-center gap-1 rounded border border-border bg-background px-1.5 font-mono text-[11px] font-medium text-foreground shadow-2xs shrink-0 ml-2">
              {item.key.includes("Cmd") ? (
                <>
                  <Command className="size-3" /> {item.key.replace("Cmd + ", "")}
                </>
              ) : (
                item.key
              )}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Dialog open={shortcutsDialogOpen} onOpenChange={setShortcutsDialogOpen}>
      <DialogContent className="w-[96vw] sm:max-w-xl md:max-w-3xl lg:max-w-4xl max-h-[88vh] overflow-y-auto no-scrollbar border-border bg-card p-6 shadow-2xl rounded-xl">
        <DialogHeader className="mb-2">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
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

        {/* Agencement en deux sections sur écrans md+ et une section sur mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div className="flex flex-col gap-4">
            {leftGroups.map(renderGroup)}
          </div>
          <div className="flex flex-col gap-4">
            {rightGroups.map(renderGroup)}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
