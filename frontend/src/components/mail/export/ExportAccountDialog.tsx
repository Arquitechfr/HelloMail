"use client";

import { useState, useRef, useEffect } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useFolders } from "@/lib/queries/folders";
import { downloadExportFile } from "@/lib/export-utils";
import { Archive, FileText, Download, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ExportFormat } from "@/lib/types/export";

interface ExportAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  initialFolder?: string;
}

export function ExportAccountDialog({
  open,
  onOpenChange,
  accountId,
  initialFolder,
}: ExportAccountDialogProps) {
  const { data: folders, isLoading: loadingFolders } = useFolders(open ? accountId : null);
  const [format, setFormat] = useState<ExportFormat>(initialFolder ? "mbox" : "zip");
  const [selectedFolder, setSelectedFolder] = useState<string>(initialFolder || "INBOX");
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (folders && folders.length > 0 && selectedFolders.length === 0) {
      setSelectedFolders(folders.map((f) => f.path));
      if (!initialFolder && !folders.some((f) => f.path === selectedFolder)) {
        setSelectedFolder(folders[0].path);
      }
    }
  }, [folders, selectedFolders.length, initialFolder, selectedFolder]);

  useEffect(() => {
    if (initialFolder) {
      setSelectedFolder(initialFolder);
      setFormat("mbox");
    }
  }, [initialFolder]);

  const toggleFolder = (path: string) => {
    setSelectedFolders((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path],
    );
  };

  const handleStartExport = async () => {
    if (format === "zip" && selectedFolders.length === 0) {
      toast.error("Veuillez sélectionner au moins un dossier");
      return;
    }

    setIsExporting(true);
    setProgress(15);
    setStatusMessage("Initialisation du streaming...");

    const abort = new AbortController();
    abortControllerRef.current = abort;

    try {
      setStatusMessage(
        format === "zip"
          ? `Compression de ${selectedFolders.length} dossier(s)...`
          : `Génération MBOX pour ${selectedFolder}...`,
      );
      setProgress(40);

      await downloadExportFile({
        accountId, format,
        folder: format === "mbox" ? selectedFolder : undefined,
        folders: format === "zip" ? selectedFolders : undefined,
        abortSignal: abort.signal,
      });

      setProgress(100);
      setStatusMessage("Téléchargement terminé !");
      toast.success("Exportation terminée");
      setTimeout(() => { setIsExporting(false); onOpenChange(false); }, 600);
    } catch (err) {
      if (abort.signal.aborted) toast.info("Exportation annulée");
      else toast.error(err instanceof Error ? err.message : "Échec de l'exportation");
      setIsExporting(false);
      setProgress(0);
      setStatusMessage("");
    } finally {
      abortControllerRef.current = null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!isExporting) onOpenChange(val); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary mb-2">
            <Archive className="size-5" />
          </div>
          <DialogTitle className="text-base font-semibold font-display">
            Exporter et archiver les courriels
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Sauvegardez vos messages en flux continu sans saturation mémoire.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          {/* Format selector */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button" disabled={isExporting} onClick={() => setFormat("zip")}
              className={cn(
                "flex flex-col gap-1 p-2.5 rounded-lg border text-left cursor-pointer transition-all",
                format === "zip" ? "border-primary bg-primary/5 shadow-xs" : "border-border hover:bg-muted/40",
              )}
            >
              <div className="flex items-center justify-between w-full">
                <span className="flex items-center gap-1.5 font-medium text-xs">
                  <Archive className="size-3.5 text-primary" /> Archive ZIP
                </span>
                {format === "zip" && <Check className="size-3.5 text-primary" />}
              </div>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Tous les dossiers en .mbox compressé.
              </p>
            </button>

            <button
              type="button" disabled={isExporting} onClick={() => setFormat("mbox")}
              className={cn(
                "flex flex-col gap-1 p-2.5 rounded-lg border text-left cursor-pointer transition-all",
                format === "mbox" ? "border-primary bg-primary/5 shadow-xs" : "border-border hover:bg-muted/40",
              )}
            >
              <div className="flex items-center justify-between w-full">
                <span className="flex items-center gap-1.5 font-medium text-xs">
                  <FileText className="size-3.5 text-primary" /> Dossier (.mbox)
                </span>
                {format === "mbox" && <Check className="size-3.5 text-primary" />}
              </div>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Export standard RFC 4155 d&apos;un dossier.
              </p>
            </button>
          </div>

          {format === "mbox" ? (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-foreground">Dossier à exporter :</label>
              <select
                disabled={isExporting || loadingFolders} value={selectedFolder}
                onChange={(e) => setSelectedFolder(e.target.value)}
                className="w-full text-xs rounded-md border border-border bg-background px-2.5 py-1.5 text-foreground"
              >
                {folders?.map((f) => (
                  <option key={f.path} value={f.path}>
                    {f.name} {f.status?.messages !== undefined ? `(${f.status.messages} msg)` : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-medium">
                <span>Dossiers inclus ({selectedFolders.length}/{folders?.length ?? 0}) :</span>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <button type="button" disabled={isExporting} onClick={() => folders && setSelectedFolders(folders.map((f) => f.path))} className="text-primary hover:underline cursor-pointer">Tout</button>
                  <span className="text-muted-foreground">|</span>
                  <button type="button" disabled={isExporting} onClick={() => setSelectedFolders([])} className="text-muted-foreground hover:underline cursor-pointer">Aucun</button>
                </div>
              </div>

              <div className="max-h-32 overflow-y-auto rounded-md border border-border/80 p-1.5 space-y-0.5 bg-muted/20 text-xs">
                {loadingFolders ? (
                  <div className="flex items-center justify-center p-3 text-muted-foreground gap-2">
                    <Loader2 className="size-3.5 animate-spin" /><span>Chargement...</span>
                  </div>
                ) : (
                  folders?.map((f) => (
                    <label key={f.path} className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-muted/50 cursor-pointer select-none">
                      <input
                        type="checkbox" disabled={isExporting} checked={selectedFolders.includes(f.path)}
                        onChange={() => toggleFolder(f.path)} className="rounded border-border text-primary size-3.5"
                      />
                      <span className="truncate flex-1">{f.name}</span>
                      {f.status?.messages !== undefined && <span className="text-[10px] text-muted-foreground">{f.status.messages} msg</span>}
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          {isExporting && (
            <div className="flex flex-col gap-1 p-2.5 rounded-md bg-muted/40 border border-border/50 text-xs">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <Loader2 className="size-3 animate-spin text-primary" />
                  {statusMessage || "Exportation..."}
                </span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 mt-1">
          {isExporting ? (
            <Button type="button" variant="destructive" size="sm" onClick={() => abortControllerRef.current?.abort()} className="text-xs gap-1.5">
              <X className="size-3.5" /><span>Annuler l&apos;exportation</span>
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">Fermer</Button>
              <Button type="button" size="sm" onClick={handleStartExport} className="text-xs gap-1.5">
                <Download className="size-3.5" /><span>Démarrer l&apos;exportation</span>
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
