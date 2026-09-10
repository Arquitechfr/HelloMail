"use client";

import { Button } from "@/components/ui/button";
import { Reply, ReplyAll } from "lucide-react";
import { TemplateInsertDropdown } from "@/components/mail/TemplateInsertDropdown";
import type { EmailTemplate } from "@/lib/types/templates";

interface QuickReplyBarProps {
  senderLabel: string;
  hasMultipleRecipients: boolean;
  onReply: () => void;
  onReplyAll: () => void;
  accountId?: string;
  onSelectTemplate?: (template: EmailTemplate) => void;
}

export function QuickReplyBar({
  senderLabel,
  hasMultipleRecipients,
  onReply,
  onReplyAll,
  accountId,
  onSelectTemplate,
}: QuickReplyBarProps) {
  return (
    <div className="border-t border-border bg-background/60 p-3 shrink-0 flex items-center justify-between gap-2 no-print">
      <button
        type="button"
        onClick={onReply}
        className="flex-1 flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground bg-muted/30 hover:bg-muted/60 rounded-md border border-border/70 transition-colors text-left cursor-pointer"
      >
        <Reply className="size-3.5" />
        <span className="truncate">Répondre à {senderLabel}...</span>
      </button>

      {onSelectTemplate && (
        <TemplateInsertDropdown
          accountId={accountId}
          onSelectTemplate={onSelectTemplate}
          variant="button"
        />
      )}

      {hasMultipleRecipients && (
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-7 gap-1"
          onClick={onReplyAll}
        >
          <ReplyAll className="size-3.5" />
          <span>Tous</span>
        </Button>
      )}
    </div>
  );
}
