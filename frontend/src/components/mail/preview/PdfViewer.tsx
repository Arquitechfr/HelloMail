"use client";

import { useState } from "react";
import { Download, AlertCircle } from "lucide-react";

interface PdfViewerProps {
  url: string;
  filename: string;
}

export function PdfViewer({ url, filename }: PdfViewerProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertCircle className="size-10 text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">
          Impossible d&apos;afficher le document PDF directement dans le navigateur.
        </p>
        <a
          href={url}
          download={filename}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow transition hover:bg-primary/90"
        >
          <Download className="size-4" />
          Télécharger {filename}
        </a>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg bg-background/50">
      <iframe
        src={`${url}#toolbar=1&navpanes=0`}
        title={filename}
        className="h-full w-full border-0 rounded-lg shadow-sm"
        onError={() => setHasError(true)}
      />
    </div>
  );
}
