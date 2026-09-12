"use client";

import { useState } from "react";
import { downloadAttachment } from "@/lib/queries/messages";
import { formatSize } from "@/lib/utils";
import type { AttachmentInfo } from "@/lib/api-types";
import {
  Paperclip,
  Download,
  Eye,
  Loader2,
  FolderDown,
} from "lucide-react";
import {
  getAttachmentCategory,
  isAttachmentPreviewable,
  getAttachmentIcon,
  getCategoryBadgeClasses,
} from "@/lib/attachment-utils";
import { AttachmentPreviewModal } from "./preview/AttachmentPreviewModal";
import { toast } from "sonner";

interface AttachmentListProps {
  accountId: string;
  folder: string;
  uid: number;
  attachments: AttachmentInfo[];
}

export function AttachmentList({ accountId, folder, uid, attachments }: AttachmentListProps) {
  const [downloadingPart, setDownloadingPart] = useState<string | null>(null);
  const [isDownloadingAll, setIsDownloadingAll] = useState<boolean>(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  if (attachments.length === 0) return null;

  const handleDownload = async (att: AttachmentInfo) => {
    setDownloadingPart(att.part);
    try {
      await downloadAttachment(accountId, folder, uid, att.part, att.filename);
      toast.success(`Téléchargement de ${att.filename} terminé`);
    } catch {
      toast.error(`Erreur lors du téléchargement de ${att.filename}`);
    } finally {
      setDownloadingPart(null);
    }
  };

  const handleDownloadAll = async () => {
    if (isDownloadingAll) return;
    setIsDownloadingAll(true);
    toast.info(`Téléchargement de ${attachments.length} pièces jointes en cours...`);

    let successCount = 0;
    for (const att of attachments) {
      try {
        await downloadAttachment(accountId, folder, uid, att.part, att.filename);
        successCount++;
      } catch (err) {
        console.warn(`[AttachmentList] Erreur sur ${att.filename}:`, err);
      }
    }

    setIsDownloadingAll(false);
    if (successCount === attachments.length) {
      toast.success("Toutes les pièces jointes ont été téléchargées");
    } else {
      toast.warning(`${successCount} sur ${attachments.length} pièces jointes téléchargées`);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-2.5">
        {/* En-tête de section avec actions globales */}
        <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
          <div className="flex items-center gap-1.5">
            <Paperclip className="size-3.5" />
            <span>
              Pièces jointes ({attachments.length})
            </span>
          </div>

          {attachments.length > 1 && (
            <button
              type="button"
              onClick={handleDownloadAll}
              disabled={isDownloadingAll}
              className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline disabled:opacity-50 transition-colors"
            >
              {isDownloadingAll ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <FolderDown className="size-3" />
              )}
              <span>Tout télécharger</span>
            </button>
          )}
        </div>

        {/* Grille de cartes de pièces jointes */}
        <div className="flex flex-wrap gap-2">
          {attachments.map((att, index) => {
            const category = getAttachmentCategory(att.contentType, att.filename);
            const previewable = isAttachmentPreviewable(att.contentType, att.filename);
            const Icon = getAttachmentIcon(category);
            const badgeClasses = getCategoryBadgeClasses(category);
            const isDownloading = downloadingPart === att.part;

            return (
              <div
                key={att.part}
                className="group relative flex items-center gap-2.5 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 p-2 pr-2.5 transition-all text-xs max-w-xs"
              >
                {/* Icône de catégorie avec pastille colorée */}
                <div
                  className={`flex items-center justify-center rounded-lg border p-2 shrink-0 ${badgeClasses}`}
                >
                  <Icon className="size-4" />
                </div>

                {/* Métadonnées & zone cliquable pour aperçu si supporté */}
                <button
                  type="button"
                  onClick={() => setPreviewIndex(index)}
                  className="flex flex-col items-start min-w-0 text-left hover:opacity-80 transition-opacity"
                  title={previewable ? `Cliquer pour prévisualiser ${att.filename}` : att.filename}
                >
                  <span className="max-w-[140px] truncate font-medium text-foreground">
                    {att.filename}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatSize(att.size)}
                  </span>
                </button>

                {/* Boutons d'actions rapides */}
                <div className="flex items-center gap-1 ml-auto shrink-0">
                  {previewable && (
                    <button
                      type="button"
                      onClick={() => setPreviewIndex(index)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      title="Aperçu"
                      aria-label={`Aperçu de ${att.filename}`}
                    >
                      <Eye className="size-3.5" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDownload(att)}
                    disabled={isDownloading}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
                    title="Télécharger"
                    aria-label={`Télécharger ${att.filename}`}
                  >
                    {isDownloading ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Download className="size-3.5" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lightbox / Modal d'aperçu universel */}
      {previewIndex !== null && (
        <AttachmentPreviewModal
          accountId={accountId}
          folder={folder}
          uid={uid}
          attachments={attachments}
          currentIndex={previewIndex}
          onClose={() => setPreviewIndex(null)}
          onNavigate={(idx) => setPreviewIndex(idx)}
        />
      )}
    </>
  );
}
