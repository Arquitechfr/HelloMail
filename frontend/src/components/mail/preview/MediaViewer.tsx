"use client";

import { Volume2, Video } from "lucide-react";
import type { AttachmentCategory } from "@/lib/attachment-utils";

interface MediaViewerProps {
  url: string;
  filename: string;
  category: "audio" | "video" | AttachmentCategory;
}

export function MediaViewer({ url, filename, category }: MediaViewerProps) {
  const isVideo = category === "video";

  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-6 select-none">
      <div className="flex flex-col items-center gap-6 rounded-2xl border border-border/40 bg-background/80 p-8 shadow-2xl backdrop-blur-md max-w-xl w-full">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-primary/10 p-3 text-primary">
            {isVideo ? <Video className="size-6" /> : <Volume2 className="size-6" />}
          </div>
          <div className="flex flex-col text-left">
            <h4 className="max-w-[320px] truncate font-medium text-sm text-foreground">
              {filename}
            </h4>
            <span className="text-xs text-muted-foreground">
              Lecture multimédia en direct
            </span>
          </div>
        </div>

        {isVideo ? (
          <video
            src={url}
            controls
            autoPlay={false}
            className="max-h-[60vh] w-full rounded-lg shadow-md bg-black"
          >
            Votre navigateur ne supporte pas la lecture de cette vidéo.
          </video>
        ) : (
          <audio
            src={url}
            controls
            autoPlay={false}
            className="w-full"
          >
            Votre navigateur ne supporte pas la lecture de ce fichier audio.
          </audio>
        )}
      </div>
    </div>
  );
}
