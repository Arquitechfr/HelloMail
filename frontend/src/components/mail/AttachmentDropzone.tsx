"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, X, FileText, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export interface AttachmentItem {
  filename: string;
  contentType: string;
  content: string; // base64
  sizeBytes: number;
}

interface AttachmentDropzoneProps {
  attachments: AttachmentItem[];
  onChange: (attachments: AttachmentItem[]) => void;
  maxTotalBytes?: number; // Défaut 25 Mo
}

export function AttachmentDropzone({
  attachments,
  onChange,
  maxTotalBytes = 25 * 1024 * 1024,
}: AttachmentDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const totalBytes = attachments.reduce((acc, a) => acc + a.sizeBytes, 0);
  const totalMb = (totalBytes / (1024 * 1024)).toFixed(1);
  const maxMb = (maxTotalBytes / (1024 * 1024)).toFixed(0);
  const isNearLimit = totalBytes > maxTotalBytes * 0.8;
  const isOverLimit = totalBytes > maxTotalBytes;

  const processFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newItems: AttachmentItem[] = [];
    let runningTotal = totalBytes;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (runningTotal + file.size > maxTotalBytes) {
        toast.error(`Le fichier "${file.name}" dépasse la limite totale de ${maxMb} Mo`);
        continue;
      }

      runningTotal += file.size;

      // Lecture en base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const res = reader.result as string;
          // Retirer le préfixe data:*/*;base64,
          const pureBase64 = res.split(",")[1] || "";
          resolve(pureBase64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      newItems.push({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        content: base64,
        sizeBytes: file.size,
      });
    }

    if (newItems.length > 0) {
      onChange([...attachments, ...newItems]);
      toast.success(`${newItems.length} pièce(s) jointe(s) ajoutée(s)`);
    }
  };

  const handleRemove = (index: number) => {
    onChange(attachments.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-2">
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
          processFiles(e.dataTransfer.files);
        }}
        className={`flex items-center justify-between p-3 rounded-md border border-dashed transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground/50 bg-muted/10"
        }`}
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Paperclip className="size-4 text-primary" />
          <span>Glissez vos fichiers ici ou</span>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-primary underline p-0 h-auto font-normal hover:bg-transparent"
          >
            parcourez votre ordinateur
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            processFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {attachments.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs">
            {isOverLimit && <AlertTriangle className="size-3.5 text-destructive" />}
            <span
              className={`font-mono text-[11px] ${
                isOverLimit
                  ? "text-destructive font-semibold"
                  : isNearLimit
                  ? "text-amber-500"
                  : "text-muted-foreground"
              }`}
            >
              {totalMb} Mo / {maxMb} Mo
            </span>
          </div>
        )}
      </div>

      {/* Liste des pièces jointes */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 rounded border border-border bg-card px-2.5 py-1 text-xs shadow-xs"
            >
              <FileText className="size-3.5 text-primary shrink-0" />
              <span className="max-w-40 truncate font-medium text-foreground">
                {item.filename}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                ({(item.sizeBytes / 1024).toFixed(0)} Ko)
              </span>
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                title="Supprimer"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
