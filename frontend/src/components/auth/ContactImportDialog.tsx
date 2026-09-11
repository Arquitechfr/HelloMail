"use client";

import { useState, useRef } from "react";
import { useImportContacts } from "@/lib/queries/contacts";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Upload, FileText } from "lucide-react";
import { toast } from "sonner";

interface ContactImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContactImportDialog({ open, onOpenChange }: ContactImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importContacts = useImportContacts();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      const ext = selected.name.split(".").pop()?.toLowerCase();
      if (ext !== "vcf" && ext !== "csv") {
        toast.error("Format non supporté. Utilisez un fichier .vcf ou .csv");
        return;
      }
      setFile(selected);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    const format = ext === "vcf" ? "vcf" : "csv";

    try {
      const content = await file.text();
      if (!content.trim()) {
        toast.error("Le fichier sélectionné est vide");
        return;
      }

      importContacts.mutate(
        { format, content },
        {
          onSuccess: (result) => {
            const { imported, skipped, total } = result;
            if (imported === 0 && skipped > 0) {
              toast.info(`Tous les contacts (${skipped}) existaient déjà.`);
            } else {
              toast.success(
                `${imported} contact${imported > 1 ? "s" : ""} importé${imported > 1 ? "s" : ""}${
                  skipped > 0 ? ` (${skipped} ignoré${skipped > 1 ? "s" : ""})` : ""
                } sur ${total}.`
              );
            }
            setFile(null);
            onOpenChange(false);
          },
          onError: (err) => {
            toast.error(err instanceof ApiError ? err.message : "Erreur lors de l'import");
          },
        }
      );
    } catch {
      toast.error("Impossible de lire le fichier");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-border bg-card max-w-md p-6 shadow-2xl rounded-xl">
        <DialogHeader>
          <DialogTitle>Importer des contacts</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <p className="text-xs text-muted-foreground">
            Sélectionnez un fichier vCard (<code>.vcf</code> RFC 6350) ou CSV (<code>.csv</code> RFC 4180).
            Les contacts déjà existants (même email) seront automatiquement ignorés.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".vcf,.csv,text/vcard,text/csv"
            className="hidden"
            onChange={handleFileChange}
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-6 cursor-pointer hover:border-primary/50 hover:bg-muted/40 transition-colors"
          >
            {file ? (
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <FileText className="size-5 text-primary" />
                <span>{file.name}</span>
                <span className="text-xs text-muted-foreground">({(file.size / 1024).toFixed(1)} Ko)</span>
              </div>
            ) : (
              <>
                <Upload className="size-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Cliquez pour choisir un fichier (.vcf ou .csv)
                </span>
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setFile(null);
              onOpenChange(false);
            }}
          >
            Annuler
          </Button>
          <Button
            type="button"
            disabled={!file || importContacts.isPending}
            onClick={handleImport}
          >
            {importContacts.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                Importation...
              </>
            ) : (
              "Importer"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
