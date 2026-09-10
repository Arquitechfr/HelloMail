"use client";

import { useState } from "react";
import { downloadAttachment } from "@/lib/queries/messages";
import { formatSize } from "@/lib/utils";
import type { AttachmentInfo } from "@/lib/api-types";
import { Paperclip, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AttachmentListProps {
  accountId: string;
  folder: string;
  uid: number;
  attachments: AttachmentInfo[];
}

export function AttachmentList({ accountId, folder, uid, attachments }: AttachmentListProps) {
  const [downloading, setDownloading] = useState<string | null>(null);

  if (attachments.length === 0) return null;

  const handleDownload = async (att: AttachmentInfo) => {
    setDownloading(att.part);
    try {
      await downloadAttachment(accountId, folder, uid, att.part, att.filename);
      toast.success("Téléchargement terminé");
    } catch {
      toast.error("Erreur lors du téléchargement");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <Paperclip className="size-4" />
        Pièces jointes ({attachments.length})
      </div>
      <div className="flex flex-wrap gap-2">
        {attachments.map((att) => (
          <button
            key={att.part}
            onClick={() => handleDownload(att)}
            className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm transition-colors hover:bg-muted/60"
          >
            {downloading === att.part ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4 text-muted-foreground" />
            )}
            <div className="flex flex-col items-start">
              <span className="max-w-[200px] truncate font-medium">{att.filename}</span>
              <span className="text-xs text-muted-foreground">
                {formatSize(att.size)} · {att.contentType}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
