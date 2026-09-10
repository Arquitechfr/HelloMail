"use client";

import { useEffect, useRef, useState } from "react";

interface EmailIframeProps {
  html?: string;
  text?: string;
}

/**
 * Rend le corps HTML d'un email dans une iframe sandbox.
 * - sandbox="allow-same-origin" sans allow-scripts (sécurité maximale).
 * - Auto-resize via ResizeObserver sur contentDocument.body (possible car allow-same-origin).
 * - Fallback texte si pas de HTML.
 * - Fallback hauteur fixe si contentDocument inaccessible.
 */
export function EmailIframe({ html, text }: EmailIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(400);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc || !doc.body) return;

        // Nettoyage observer précédent.
        resizeObserverRef.current?.disconnect();

        // Observe les changements de taille du body.
        const observer = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const h = entry.contentRect.height;
            if (h > 0) setHeight(h + 20);
          }
        });
        observer.observe(doc.body);
        resizeObserverRef.current = observer;

        // Hauteur initiale.
        setHeight(doc.body.scrollHeight + 20);
      } catch {
        // contentDocument inaccessible (cross-origin) → hauteur fixe.
        setHeight(500);
      }
    };

    iframe.addEventListener("load", handleLoad);
    return () => {
      iframe.removeEventListener("load", handleLoad);
      resizeObserverRef.current?.disconnect();
    };
  }, [html]);

  // Fallback texte.
  if (!html && text) {
    return (
      <div className="whitespace-pre-wrap break-words rounded-lg bg-muted/30 p-4 text-sm">
        {text}
      </div>
    );
  }

  if (!html && !text) {
    return <div className="text-sm text-muted-foreground">Aucun contenu</div>;
  }

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-same-origin"
      srcDoc={html}
      className="w-full rounded-lg border border-border"
      style={{ height: `${height}px` }}
      title="Corps du message"
      scrolling="no"
    />
  );
}
