"use client";

import React, { useState, useRef } from "react";
import type { FolderInfo } from "@/lib/api-types";
import { apiFetch, ApiError } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Upload, FileText, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { formatSize } from "@/lib/utils";

export interface ImportEmlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  folder: FolderInfo | null;
  onSuccess?: () => void;
}

export function ImportEmlDialog({
  open,
  onOpenChange,
  accountId,
  folder,
  onSuccess,
}: ImportEmlDialogProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  if (!folder) return null;

  const handleFilesAdded = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const emlFiles: File[] = [];
    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i];
      if (file.name.toLowerCase().endsWith(".eml") || file.type === "message/rfc822") {
        emlFiles.push(file);
      } else {
        toast.warning(`Le fichier « ${file.name} » n'est pas au format .eml`);
      }
    }
    setFiles((prev) => [...prev, ...emlFiles]);
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // On retire le préfixe data:...;base64,
        const base64 = result.includes(",") ? result.split(",")[1] : result;
        resolve(base64);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  const handleImport = async () => {
    if (files.length === 0) return;
    setIsImporting(true);
    setImportedCount(0);

    let successCount = 0;
    for (const file of files) {
      try {
        const base64 = await fileToBase64(file);
        await apiFetch(
          `/api/accounts/${accountId}/messages/${encodeURIComponent(folder.path)}/import`,
          {
            method: "POST",
            body: JSON.stringify({
              emlContent: base64,
              isBase64: true,
            }),
          },
        );
        successCount++;
        setImportedCount(successCount);
      } catch (err) {
        toast.error(
          err instanceof ApiError
            ? err.message
            : `Échec de l'import pour le fichier ${file.name}`,
        );
      }
    }

    setIsImporting(false);

    if (successCount > 0) {
      toast.success(
        successCount === 1
          ? "1 message importé avec succès"
          : `${successCount} messages importés avec succès`,
      );
      queryClient.invalidateQueries({ queryKey: ["messages", accountId, folder.path] });
      queryClient.invalidateQueries({ queryKey: ["folders", accountId] });
      setFiles([]);
      onOpenChange(false);
      onSuccess?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-border bg-card max-w-lg p-6 shadow-2xl rounded-xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Upload className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Importer des messages (.eml)
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Dossier de destination : <strong className="text-foreground">{folder.name || folder.path}</strong>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Zone de glisser-déposer */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFilesAdded(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
            isDragging
              ? "border-primary bg-primary/10"
              : "border-border hover:border-muted-foreground/50 bg-muted/20"
          }`}
        >
          <Upload className="size-8 text-muted-foreground mb-2" />
          <p className="text-xs font-medium text-foreground text-center">
            Glissez-déposez vos fichiers <span className="font-mono text-primary">.eml</span> ici
          </p>
          <p className="text-[11px] text-muted-foreground mt-1 text-center">
            ou cliquez pour parcourir vos dossiers (25 Mo max par email)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".eml,message/rfc822"
            multiple
            className="hidden"
            onChange={(e) => handleFilesAdded(e.target.files)}
          />
        </div>

        {/* Liste des fichiers sélectionnés */}
        {files.length > 0 && (
          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 my-2">
            {files.map((f, index) => (
              <div
                key={`${f.name}-${index}`}
                className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-md bg-muted/40 text-xs border border-border/50"
              >
                <div className="flex items-center gap-2 truncate min-w-0">
                  <FileText className="size-3.5 text-primary shrink-0" />
                  <span className="truncate font-medium">{f.name}</span>
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                    ({formatSize(f.size)})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFile(index);
                  }}
                  disabled={isImporting}
                  className="text-muted-foreground hover:text-foreground p-0.5 rounded"
                  title="Retirer ce fichier"
                  aria-label={`Retirer ${f.name}`}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="flex gap-2 justify-end pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isImporting}
          >
            Annuler
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleImport}
            disabled={files.length === 0 || isImporting}
            className="gap-1.5"
          >
            {isImporting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Import en cours ({importedCount}/{files.length})...
              </>
            ) : (
              <>
                <CheckCircle2 className="size-3.5" />
                Importer {files.length > 0 ? `(${files.length})` : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
