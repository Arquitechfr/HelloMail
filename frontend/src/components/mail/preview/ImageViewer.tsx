"use client";

import { useState } from "react";
import { ZoomIn, ZoomOut, RotateCw, RefreshCw } from "lucide-react";

interface ImageViewerProps {
  url: string;
  filename: string;
}

export function ImageViewer({ url, filename }: ImageViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 4));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.25));
  const handleRotate = () => setRotation((r) => (r + 90) % 360);
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden select-none">
      {/* Zone d'affichage d'image avec défilement si zoomée */}
      <div className="flex h-full w-full items-center justify-center overflow-auto p-4">
        {/* Balise img native : immunise contre les scripts SVG et optimise le rendu */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={filename}
          className="max-h-[85vh] max-w-[85vw] object-contain transition-transform duration-200 ease-out shadow-2xl rounded"
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
          }}
          draggable={false}
        />
      </div>

      {/* Barre d'outils flottante de zoom et rotation */}
      <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border/40 bg-background/80 px-3 py-1.5 backdrop-blur-md shadow-lg">
        <button
          type="button"
          onClick={handleZoomOut}
          disabled={zoom <= 0.25}
          className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 transition-colors"
          title="Zoom arrière"
        >
          <ZoomOut className="size-4" />
        </button>

        <span className="min-w-[48px] text-center font-mono text-xs text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>

        <button
          type="button"
          onClick={handleZoomIn}
          disabled={zoom >= 4}
          className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 transition-colors"
          title="Zoom avant"
        >
          <ZoomIn className="size-4" />
        </button>

        <div className="mx-1 h-3.5 w-[1px] bg-border/60" />

        <button
          type="button"
          onClick={handleRotate}
          className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="Pivoter de 90°"
        >
          <RotateCw className="size-4" />
        </button>

        {(zoom !== 1 || rotation !== 0) && (
          <button
            type="button"
            onClick={handleReset}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Réinitialiser l'affichage"
          >
            <RefreshCw className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
