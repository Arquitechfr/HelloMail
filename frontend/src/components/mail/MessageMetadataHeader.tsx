"use client";

import { useMemo, useState } from "react";
import { formatDate } from "@/lib/utils";
import type { MessageDetail } from "@/lib/api-types";
import { useTags, useSetMessageTags } from "@/lib/queries/tags";
import { TagBadge } from "./TagBadge";
import { TagSelectPopover } from "./TagSelectPopover";
import { EmailAvatar } from "./EmailAvatar";
import { UnsubscribeButton } from "./UnsubscribeButton";
import { BlockSenderDialog } from "./BlockSenderDialog";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
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
  const [blockSenderOpen, setBlockSenderOpen] = useState(false);
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

      <div className="flex items-start gap-3">
        <EmailAvatar
          email={message.from.address}
          name={message.from.name}
          className="size-9 shrink-0 mt-0.5"
          fallbackClassName="text-xs font-semibold"
        />
        <div className="flex flex-col gap-1 text-xs flex-1 min-w-0">
          <div className="flex gap-2 items-center justify-between">
            <div className="flex gap-2 min-w-0">
              <span className="w-12 shrink-0 font-medium text-muted-foreground">De :</span>
              <span className="text-foreground font-medium truncate">
                {message.from.name ? `${message.from.name} <${message.from.address}>` : message.from.address}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {message.unsubscribeInfo && (
                <UnsubscribeButton
                  accountId={accountId}
                  folder={folder}
                  uid={uid}
                  info={message.unsubscribeInfo}
                />
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setBlockSenderOpen(true)}
                className="h-6 px-2 text-[11px] font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md gap-1"
                title="Bloquer cet expéditeur et déplacer ses messages en spam"
              >
                <ShieldAlert className="size-3 text-muted-foreground hover:text-destructive" />
                <span className="hidden sm:inline">Bloquer</span>
              </Button>
            </div>
          </div>
          <div className="flex gap-2">
            <span className="w-12 shrink-0 font-medium text-muted-foreground">À :</span>
            <span className="text-foreground/90 truncate">
              {message.to.map((t) => (t.name ? `${t.name} <${t.address}>` : t.address)).join(", ")}
            </span>
          </div>
          {message.cc && message.cc.length > 0 && (
            <div className="flex gap-2">
              <span className="w-12 shrink-0 font-medium text-muted-foreground">Cc :</span>
              <span className="text-foreground/80 truncate">
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

      <BlockSenderDialog
        open={blockSenderOpen}
        onOpenChange={setBlockSenderOpen}
        accountId={accountId}
        folder={folder}
        uid={uid}
        senderEmail={message.from.address}
      />
    </div>
  );
}
