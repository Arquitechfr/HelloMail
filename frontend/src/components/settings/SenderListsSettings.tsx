"use client";

import { useState, useMemo } from "react";
import {
  useSenderLists,
  useDeleteSenderEntry,
} from "@/lib/queries/senderLists";
import type { SenderListType } from "@/lib/api-types";
import { AddSenderDialog } from "./AddSenderDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Plus,
  Trash2,
  Loader2,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatDate } from "@/lib/utils";

export function SenderListsSettings() {
  const [activeTab, setActiveTab] = useState<SenderListType>("allow");
  const [searchQuery, setSearchQuery] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const { data, isLoading } = useSenderLists();
  const deleteMutation = useDeleteSenderEntry();

  const entries = data?.data ?? [];

  const allowEntries = useMemo(
    () => entries.filter((e) => e.type === "allow"),
    [entries],
  );
  const denyEntries = useMemo(
    () => entries.filter((e) => e.type === "deny"),
    [entries],
  );

  const activeEntries = activeTab === "allow" ? allowEntries : denyEntries;

  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return activeEntries;
    const q = searchQuery.toLowerCase().trim();
    return activeEntries.filter(
      (e) => e.target.toLowerCase().includes(q) || (e.note && e.note.toLowerCase().includes(q)),
    );
  }, [activeEntries, searchQuery]);

  const handleDelete = async (id: string, target: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success(`Règle pour « ${target} » supprimée`);
    } catch {
      toast.error("Impossible de supprimer cette règle");
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card/60 p-6 shadow-xs space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          {activeTab === "allow" ? (
            <ShieldCheck className="size-4 text-emerald-500" />
          ) : (
            <ShieldAlert className="size-4 text-destructive" />
          )}
          <h2 className="text-sm font-bold font-display text-foreground">
            Listes de Confiance & Anti-Spam (Allowlist / Denylist)
          </h2>
        </div>

        <Button
          size="sm"
          onClick={() => setAddDialogOpen(true)}
          className="gap-1.5 text-xs h-8 cursor-pointer"
        >
          <Plus className="size-3.5" />
          <span>Ajouter une règle</span>
        </Button>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Gérez précisément les correspondants et noms de domaines de confiance absolue (préservés en boîte de réception) ou indésirables (automatiquement envoyés vers les spams).
      </p>

      {/* Onglets et Barre de recherche */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex rounded-lg border border-border bg-muted/30 p-1 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab("allow")}
            className={cn(
              "flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer",
              activeTab === "allow"
                ? "bg-card text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ShieldCheck className="size-3.5 text-emerald-500" />
            <span>Liste blanche</span>
            <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-muted font-mono">
              {allowEntries.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("deny")}
            className={cn(
              "flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer",
              activeTab === "deny"
                ? "bg-card text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ShieldAlert className="size-3.5 text-destructive" />
            <span>Liste noire</span>
            <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-muted font-mono">
              {denyEntries.length}
            </span>
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Rechercher une adresse ou un domaine..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs bg-card/40"
          />
        </div>
      </div>

      {/* Liste des entrées */}
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 px-4 text-center rounded-lg border border-dashed border-border/80 bg-muted/10">
          <div className="flex size-10 items-center justify-center rounded-full bg-muted/40">
            <Inbox className="size-5 text-muted-foreground opacity-70" />
          </div>
          <p className="text-xs font-medium text-foreground">
            {searchQuery
              ? "Aucune règle ne correspond à votre recherche"
              : activeTab === "allow"
                ? "Aucun expéditeur dans votre liste blanche"
                : "Aucun expéditeur dans votre liste noire"}
          </p>
          <p className="text-[11px] text-muted-foreground max-w-sm">
            {activeTab === "allow"
              ? "Ajoutez des adresses ou des domaines importants pour garantir qu'ils ne soient jamais classés comme spams."
              : "Ajoutez les expéditeurs indésirables pour les acheminer directement vers votre dossier pourriels."}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/50 rounded-lg border border-border bg-card/40 overflow-hidden">
          {filteredEntries.map((entry) => (
            <div
              key={entry._id}
              className="flex items-center justify-between p-3 sm:px-4 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={cn(
                    "size-2 rounded-full shrink-0",
                    entry.type === "allow" ? "bg-emerald-500" : "bg-destructive",
                  )}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-medium text-foreground truncate">
                      {entry.target}
                    </span>
                    {entry.target.startsWith("@") || !entry.target.includes("@") ? (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-muted text-muted-foreground border border-border">
                        Domaine
                      </span>
                    ) : null}
                  </div>
                  {entry.note && (
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {entry.note}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[10px] text-muted-foreground font-mono hidden md:inline">
                  {formatDate(entry.createdAt)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(entry._id, entry.target)}
                  disabled={deleteMutation.isPending}
                  className="size-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded cursor-pointer"
                  title="Supprimer cette règle"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddSenderDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        defaultType={activeTab}
      />
    </div>
  );
}
