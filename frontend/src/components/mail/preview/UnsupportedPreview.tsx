"use client";

import { Download } from "lucide-react";
import { formatSize } from "@/lib/utils";
import {
  getAttachmentCategory,
  getAttachmentIcon,
  getCategoryBadgeClasses,
} from "@/lib/attachment-utils";

interface UnsupportedPreviewProps {
  filename: string;
  contentType: string;
  size: number;
  onDownload: () => void;
  isDownloading?: boolean;
}

export function UnsupportedPreview({
  filename,
  contentType,
  size,
  onDownload,
  isDownloading = false,
}: UnsupportedPreviewProps) {
  const category = getAttachmentCategory(contentType, filename);
  const Icon = getAttachmentIcon(category);
  const badgeClasses = getCategoryBadgeClasses(category);

  return (
    <div className="flex h-full w-full items-center justify-center p-6 select-none">
      <div className="flex flex-col items-center gap-5 rounded-2xl border border-border/50 bg-background/85 p-8 text-center shadow-xl backdrop-blur-md max-w-md w-full">
        <div className={`rounded-2xl border p-5 ${badgeClasses}`}>
          <Icon className="size-12" />
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <h3 className="max-w-[320px] truncate font-semibold text-base text-foreground" title={filename}>
            {filename}
          </h3>
          <p className="text-xs text-muted-foreground">
            {formatSize(size)} · {contentType}
          </p>
        </div>

        <div className="rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Aucun aperçu interactif n&apos;est disponible pour ce type de fichier.
        </div>

        <button
          type="button"
          onClick={onDownload}
          disabled={isDownloading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
        >
          <Download className="size-4" />
          {isDownloading ? "Téléchargement..." : "Télécharger le fichier"}
        </button>
      </div>
    </div>
  );
}
