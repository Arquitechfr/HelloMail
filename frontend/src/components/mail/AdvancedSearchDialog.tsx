"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccounts } from "@/lib/queries/accounts";
import { SlidersHorizontal, Search, RotateCcw, Sparkles } from "lucide-react";
import { SmartFolderDialog } from "./smart/SmartFolderDialog";
import {
  type AdvancedSearchParams,
  buildSearchQueryString,
} from "@/lib/search-utils";

interface AdvancedSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSearch: (queryString: string, params: AdvancedSearchParams) => void;
  initialAccountId?: string;
}

export function AdvancedSearchDialog({
  open,
  onOpenChange,
  onSearch,
  initialAccountId,
}: AdvancedSearchDialogProps) {
  const { data: accounts } = useAccounts();
  const [accountId, setAccountId] = useState<string>(initialAccountId || "all");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [folder, setFolder] = useState("");
  const [since, setSince] = useState("");
  const [before, setBefore] = useState("");
  const [sizeOption, setSizeOption] = useState<"any" | "larger1m" | "larger5m" | "larger10m">("any");
  const [hasAttachment, setHasAttachment] = useState(false);
  const [isUnread, setIsUnread] = useState(false);
  const [isFlagged, setIsFlagged] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [includeTrashSpam, setIncludeTrashSpam] = useState(false);
  const [smartFolderOpen, setSmartFolderOpen] = useState(false);

  useEffect(() => {
    if (open && initialAccountId) {
      setAccountId(initialAccountId);
    }
  }, [open, initialAccountId]);

  const handleReset = () => {
    setAccountId(initialAccountId || "all");
    setQ("");
    setFrom("");
    setTo("");
    setSubject("");
    setFolder("");
    setSince("");
    setBefore("");
    setSizeOption("any");
    setHasAttachment(false);
    setIsUnread(false);
    setIsFlagged(false);
    setIsPinned(false);
    setIncludeTrashSpam(false);
  };

  const currentParams: AdvancedSearchParams = {
    q: q || undefined, from: from || undefined, to: to || undefined, subject: subject || undefined,
    folder: folder || undefined, accountId: accountId !== "all" ? accountId : undefined,
    hasAttachment: hasAttachment || undefined, isUnread: isUnread || undefined,
    isFlagged: isFlagged || undefined, isPinned: isPinned || undefined,
    since: since || undefined, before: before || undefined, sizeOption,
    includeTrashSpam: includeTrashSpam || undefined,
  };

  const handleExecute = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const queryStr = buildSearchQueryString(currentParams);
    onSearch(queryStr, currentParams);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto bg-card border-border p-5 rounded-xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
              <SlidersHorizontal className="size-4 text-primary" />
              Recherche avancée d&apos;emails
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleExecute} className="space-y-4 py-2 text-xs">
            {accounts && accounts.length > 1 && (
              <div className="space-y-1.5">
                <Label htmlFor="search-account-scope" className="text-xs font-medium text-foreground">
                  Portée de recherche
                </Label>
                <select
                  id="search-account-scope"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                >
                  <option value="all">Tous les comptes (Recherche unifiée)</option>
                  {accounts.map((acc) => (
                    <option key={acc._id} value={acc._id}>
                      {acc.displayName || acc.emailAddress} ({acc.emailAddress})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="search-from" className="text-xs font-medium text-foreground">De (Expéditeur)</Label>
                <Input
                  id="search-from"
                  placeholder="ex: client@entreprise.com"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-8 text-xs bg-muted/30"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="search-to" className="text-xs font-medium text-foreground">À (Destinataire)</Label>
                <Input
                  id="search-to"
                  placeholder="ex: support@societe.fr"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-8 text-xs bg-muted/30"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="search-subject" className="text-xs font-medium text-foreground">Objet</Label>
                <Input
                  id="search-subject"
                  placeholder="ex: Facture, Compte-rendu"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="h-8 text-xs bg-muted/30"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="search-q" className="text-xs font-medium text-foreground">Contient les mots</Label>
                <Input
                  id="search-q"
                  placeholder="ex: urgent contrat"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="h-8 text-xs bg-muted/30"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="search-folder" className="text-xs font-medium text-foreground">Dossier</Label>
                <Input
                  id="search-folder"
                  placeholder="Tous dossiers (ex: INBOX)"
                  value={folder}
                  onChange={(e) => setFolder(e.target.value)}
                  className="h-8 text-xs bg-muted/30"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="search-size" className="text-xs font-medium text-foreground">Taille de l&apos;email</Label>
                <select
                  id="search-size"
                  value={sizeOption}
                  onChange={(e) => setSizeOption(e.target.value as "any" | "larger1m" | "larger5m" | "larger10m")}
                  className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                >
                  <option value="any">Peu importe la taille</option>
                  <option value="larger1m">Supérieure à 1 Mo (&gt; 1 Mo)</option>
                  <option value="larger5m">Supérieure à 5 Mo (&gt; 5 Mo)</option>
                  <option value="larger10m">Supérieure à 10 Mo (&gt; 10 Mo)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="search-since" className="text-xs font-medium text-foreground">Depuis le</Label>
                <Input
                  id="search-since"
                  type="date"
                  value={since}
                  onChange={(e) => setSince(e.target.value)}
                  className="h-8 text-xs bg-muted/30"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="search-before" className="text-xs font-medium text-foreground">Jusqu&apos;au</Label>
                <Input
                  id="search-before"
                  type="date"
                  value={before}
                  onChange={(e) => setBefore(e.target.value)}
                  className="h-8 text-xs bg-muted/30"
                />
              </div>
            </div>

            <div className="space-y-2 pt-1 border-t border-border/60">
              <span className="text-[11px] font-medium text-muted-foreground">Filtres d&apos;état rapides</span>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "attach", label: "Avec pièces jointes", checked: hasAttachment, set: setHasAttachment },
                  { id: "unread", label: "Non lus", checked: isUnread, set: setIsUnread },
                  { id: "flagged", label: "Importants", checked: isFlagged, set: setIsFlagged },
                  { id: "pinned", label: "Épinglés", checked: isPinned, set: setIsPinned },
                  { id: "trashspam", label: "Inclure Corbeille/Spams", checked: includeTrashSpam, set: setIncludeTrashSpam },
                ].map((item) => (
                  <label
                    key={item.id}
                    className="flex items-center gap-1.5 rounded border border-border/70 px-2 py-1 text-xs hover:bg-muted/40 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={(e) => item.set(e.target.checked)}
                      className="size-3.5 rounded text-primary border-border"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <DialogFooter className="flex flex-row items-center justify-between gap-2 pt-3 border-t border-border/70 sm:justify-between">
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="size-3.5 mr-1" />
                  Réinitialiser
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSmartFolderOpen(true)}
                  className="h-8 text-xs text-primary border-primary/20 hover:bg-primary/10"
                  title="Enregistrer comme dossier intelligent"
                >
                  <Sparkles className="size-3 mr-1 text-amber-500" />
                  Dossier intelligent
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs">
                  Annuler
                </Button>
                <Button type="submit" size="sm" className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs">
                  <Search className="size-3.5 mr-1.5" />
                  Rechercher
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <SmartFolderDialog
        open={smartFolderOpen}
        onOpenChange={setSmartFolderOpen}
        initialQuery={buildSearchQueryString(currentParams)}
      />
    </>
  );
}
