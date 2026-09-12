"use client";

import { useState, useEffect } from "react";
import { Copy, Check, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { getLanguageFromFilename } from "@/lib/attachment-utils";

interface TextViewerProps {
  blob: Blob;
  filename: string;
}

const MAX_TEXT_PREVIEW_BYTES = 2 * 1024 * 1024; // 2 Mo

async function readBlobAsText(blob: Blob): Promise<string> {
  if (typeof blob.text === "function") {
    try {
      const res = await blob.text();
      if (res && res !== "[object Blob]") {
        return res;
      }
    } catch {
      // Fallback
    }
  }

  if (typeof blob.arrayBuffer === "function") {
    try {
      const buffer = await blob.arrayBuffer();
      return new TextDecoder().decode(buffer);
    } catch {
      // Fallback
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) || "");
    reader.onerror = reject;
    reader.readAsText(blob);
  });
}

export function TextViewer({ blob, filename }: TextViewerProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTruncated, setIsTruncated] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function loadText() {
      try {
        const truncated = blob.size > MAX_TEXT_PREVIEW_BYTES;
        const target = truncated ? blob.slice(0, MAX_TEXT_PREVIEW_BYTES) : blob;
        const text = await readBlobAsText(target);

        if (!cancelled) {
          setContent(text);
          setIsTruncated(truncated);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn("[TextViewer] Erreur lors de la lecture du texte:", err);
          setContent("Erreur : Impossible de lire le contenu texte.");
          setLoading(false);
        }
      }
    }

    void loadText();

    return () => {
      cancelled = true;
    };
  }, [blob]);

  const handleCopy = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("Contenu copié dans le presse-papier");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erreur lors de la copie");
    }
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const lines = (content ?? "").split("\n");
  const lang = getLanguageFromFilename(filename);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-border/50 bg-background/90 backdrop-blur-sm">
      {/* Barre d'actions du visualiseur de texte */}
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-2 bg-muted/20 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="font-mono uppercase">{lang}</span>
          <span>·</span>
          <span>{lines.length} lignes</span>
          {isTruncated && (
            <span className="flex items-center gap-1 text-amber-500 font-medium">
              <AlertTriangle className="size-3" />
              Tronqué à 2 Mo
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="Copier le contenu"
        >
          {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
          <span>{copied ? "Copié" : "Copier"}</span>
        </button>
      </div>

      {/* Contenu textuel avec numérotation de lignes */}
      <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, idx) => (
              <tr key={idx} className="hover:bg-muted/30">
                <td className="w-10 pr-3 text-right select-none text-muted-foreground/50 align-top">
                  {idx + 1}
                </td>
                <td className="whitespace-pre-wrap break-all text-foreground align-top">
                  {line || "\n"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
