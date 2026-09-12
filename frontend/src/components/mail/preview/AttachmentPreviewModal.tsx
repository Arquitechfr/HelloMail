"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Download, ChevronLeft, ChevronRight, Loader2, AlertCircle } from "lucide-react";
import { formatSize } from "@/lib/utils";
import { apiFetchBlob } from "@/lib/api";
import { downloadAttachment } from "@/lib/queries/messages";
import {
  getAttachmentCategory,
  isAttachmentPreviewable,
  getAttachmentIcon,
  getCategoryBadgeClasses,
} from "@/lib/attachment-utils";
import { ImageViewer } from "./ImageViewer";
import { PdfViewer } from "./PdfViewer";
import { TextViewer } from "./TextViewer";
import { MediaViewer } from "./MediaViewer";
import { UnsupportedPreview } from "./UnsupportedPreview";
import type { AttachmentInfo } from "@/lib/api-types";
import { toast } from "sonner";

interface AttachmentPreviewModalProps {
  accountId: string;
  folder: string;
  uid: number;
  attachments: AttachmentInfo[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function AttachmentPreviewModal({
  accountId,
  folder,
  uid,
  attachments,
  currentIndex,
  onClose,
  onNavigate,
}: AttachmentPreviewModalProps) {
  const currentAtt = attachments[currentIndex];
  const total = attachments.length;

  const [blob, setBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  const category = currentAtt
    ? getAttachmentCategory(currentAtt.contentType, currentAtt.filename)
    : "other";
  const previewable = currentAtt
    ? isAttachmentPreviewable(currentAtt.contentType, currentAtt.filename)
    : false;

  // Chargement asynchrone du blob avec gestion stricte du cycle de vie URL.createObjectURL
  useEffect(() => {
    if (!currentAtt || !previewable) {
      setBlob(null);
      setBlobUrl(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    let createdUrl: string | null = null;

    setLoading(true);
    setError(null);

    async function load() {
      try {
        const encodedFolder = encodeURIComponent(folder);
        const path = `/api/accounts/${accountId}/messages/${encodedFolder}/${uid}/attachments/${currentAtt.part}?disposition=inline`;
        const fetchedBlob = await apiFetchBlob(path);

        if (cancelled) return;

        createdUrl = URL.createObjectURL(fetchedBlob);
        setBlob(fetchedBlob);
        setBlobUrl(createdUrl);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.warn("[AttachmentPreviewModal] Échec chargement pièce jointe:", err);
          setError("Impossible de charger la pièce jointe pour prévisualisation.");
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [accountId, folder, uid, currentAtt, previewable]);

  // Navigation clavier
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft" && currentIndex > 0) {
        e.preventDefault();
        onNavigate(currentIndex - 1);
      } else if (e.key === "ArrowRight" && currentIndex < total - 1) {
        e.preventDefault();
        onNavigate(currentIndex + 1);
      }
    },
    [currentIndex, total, onClose, onNavigate],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleDownload = async () => {
    if (!currentAtt || isDownloading) return;
    setIsDownloading(true);
    try {
      await downloadAttachment(accountId, folder, uid, currentAtt.part, currentAtt.filename);
      toast.success("Téléchargement terminé");
    } catch {
      toast.error("Erreur lors du téléchargement");
    } finally {
      setIsDownloading(false);
    }
  };

  if (!currentAtt) return null;

  const Icon = getAttachmentIcon(category);
  const badgeClasses = getCategoryBadgeClasses(category);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Prévisualisation : ${currentAtt.filename}`}
      className="fixed inset-0 z-50 flex flex-col bg-background/90 backdrop-blur-md animate-in fade-in-0 duration-200"
    >
      {/* Header du visualiseur */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/40 px-4">
        {/* Métadonnées du fichier */}
        <div className="flex items-center gap-3 min-w-0">
          <div className={`flex items-center justify-center rounded-lg border p-1.5 ${badgeClasses}`}>
            <Icon className="size-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="truncate font-medium text-sm text-foreground max-w-[280px] sm:max-w-md">
              {currentAtt.filename}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {formatSize(currentAtt.size)} · {currentAtt.contentType}
            </span>
          </div>
        </div>

        {/* Contrôles de navigation et actions */}
        <div className="flex items-center gap-2">
          {total > 1 && (
            <div className="flex items-center gap-1 mr-2 bg-muted/40 rounded-lg p-0.5 text-xs font-mono">
              <button
                type="button"
                onClick={() => onNavigate(currentIndex - 1)}
                disabled={currentIndex === 0}
                className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors"
                title="Pièce jointe précédente (Flèche Gauche)"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="px-1.5 text-muted-foreground select-none">
                {currentIndex + 1} / {total}
              </span>
              <button
                type="button"
                onClick={() => onNavigate(currentIndex + 1)}
                disabled={currentIndex === total - 1}
                className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors"
                title="Pièce jointe suivante (Flèche Droite)"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            title="Télécharger"
          >
            {isDownloading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            <span className="hidden sm:inline">Télécharger</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Fermer (Échap)"
          >
            <X className="size-5" />
          </button>
        </div>
      </header>

      {/* Corps du visualiseur */}
      <main className="relative flex-1 overflow-hidden p-2 sm:p-4">
        {loading ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-8 animate-spin text-primary" />
            <span className="text-xs">Chargement de l&apos;aperçu...</span>
          </div>
        ) : error ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
            <AlertCircle className="size-10 text-rose-500/80" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow transition hover:bg-primary/90"
            >
              <Download className="size-4" />
              Télécharger à la place
            </button>
          </div>
        ) : !previewable ? (
          <UnsupportedPreview
            filename={currentAtt.filename}
            contentType={currentAtt.contentType}
            size={currentAtt.size}
            onDownload={handleDownload}
            isDownloading={isDownloading}
          />
        ) : category === "image" && blobUrl ? (
          <ImageViewer url={blobUrl} filename={currentAtt.filename} />
        ) : category === "pdf" && blobUrl ? (
          <PdfViewer url={blobUrl} filename={currentAtt.filename} />
        ) : category === "text" && blob ? (
          <TextViewer blob={blob} filename={currentAtt.filename} />
        ) : (category === "audio" || category === "video") && blobUrl ? (
          <MediaViewer url={blobUrl} filename={currentAtt.filename} category={category} />
        ) : (
          <UnsupportedPreview
            filename={currentAtt.filename}
            contentType={currentAtt.contentType}
            size={currentAtt.size}
            onDownload={handleDownload}
            isDownloading={isDownloading}
          />
        )}
      </main>
    </div>
  );
}
