"use client";

import { formatDate } from "@/lib/utils";
import type { MessageDetail } from "@/lib/api-types";

interface MessageMetadataHeaderProps {
  message: MessageDetail;
}

export function MessageMetadataHeader({ message }: MessageMetadataHeaderProps) {
  return (
    <div className="border-b border-border px-6 py-4 shrink-0 bg-muted/10">
      <h1 className="mb-3 text-lg font-bold tracking-tight text-foreground font-display">
        {message.subject || "(Sans objet)"}
      </h1>
      <div className="flex flex-col gap-1 text-xs">
        <div className="flex gap-2">
          <span className="w-12 shrink-0 font-medium text-muted-foreground">De :</span>
          <span className="text-foreground font-medium">
            {message.from.name ? `${message.from.name} <${message.from.address}>` : message.from.address}
          </span>
        </div>
        <div className="flex gap-2">
          <span className="w-12 shrink-0 font-medium text-muted-foreground">À :</span>
          <span className="text-foreground/90">
            {message.to.map((t) => (t.name ? `${t.name} <${t.address}>` : t.address)).join(", ")}
          </span>
        </div>
        {message.cc && message.cc.length > 0 && (
          <div className="flex gap-2">
            <span className="w-12 shrink-0 font-medium text-muted-foreground">Cc :</span>
            <span className="text-foreground/80">
              {message.cc.map((t) => (t.name ? `${t.name} <${t.address}>` : t.address)).join(", ")}
            </span>
          </div>
        )}
        <div className="flex gap-2">
          <span className="w-12 shrink-0 font-medium text-muted-foreground">Date :</span>
          <span className="text-muted-foreground font-mono">{formatDate(message.date)}</span>
        </div>
      </div>
    </div>
  );
}
