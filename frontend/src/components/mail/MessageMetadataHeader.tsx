"use client";

import { useMemo } from "react";
import { formatDate } from "@/lib/utils";
import type { MessageDetail } from "@/lib/api-types";
import { useTags, useSetMessageTags } from "@/lib/queries/tags";
import { TagBadge } from "./TagBadge";
import { TagSelectPopover } from "./TagSelectPopover";
import { toast } from "sonner";

interface MessageMetadataHeaderProps {
  message: MessageDetail;
  accountId: string;
  folder: string;
  uid: number;
}

export function MessageMetadataHeader({
  message,
  accountId,
  folder,
  uid,
}: MessageMetadataHeaderProps) {
  const { data: tagsData } = useTags();
  const setTagsMutation = useSetMessageTags();

  const tagColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    tagsData?.data?.forEach((t) => {
      map[t.name] = t.color;
    });
    return map;
  }, [tagsData]);

  const handleRemoveTag = async (tagName: string) => {
    const nextTags = (message.tags || []).filter((t) => t !== tagName);
    try {
      await setTagsMutation.mutateAsync({
        accountId,
        folder,
        uid,
        tags: nextTags,
      });
      toast.success(`Étiquette « ${tagName} » retirée`);
    } catch {
      toast.error("Impossible de retirer l'étiquette");
    }
  };

  return (
    <div className="border-b border-border px-6 py-4 shrink-0 bg-muted/10">
      <div className="flex items-start justify-between gap-4 mb-3">
        <h1 className="text-lg font-bold tracking-tight text-foreground font-display">
          {message.subject || "(Sans objet)"}
        </h1>
        <TagSelectPopover
          accountId={accountId}
          folder={folder}
          uid={uid}
          currentTags={message.tags || []}
        />
      </div>

      {message.tags && message.tags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          {message.tags.map((tag) => (
            <TagBadge
              key={tag}
              name={tag}
              color={tagColorMap[tag] || "#3b82f6"}
              size="sm"
              onRemove={() => handleRemoveTag(tag)}
            />
          ))}
        </div>
      )}

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
