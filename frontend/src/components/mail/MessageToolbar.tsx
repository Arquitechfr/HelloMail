"use client";

import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Reply,
  Forward,
  Star,
  Archive,
  Ban,
  Trash2,
  Printer,
  Download,
} from "lucide-react";
import { SnoozeDropdown } from "@/components/mail/SnoozeDropdown";

interface MessageToolbarProps {
  accountId: string;
  folder: string;
  uid: number;
  isFlagged: boolean;
  isSnoozed?: boolean;
  onBack: () => void;
  onReply: () => void;
  onForward: () => void;
  onToggleFlag: () => void;
  onArchive: () => void;
  onMarkJunk: () => void;
  onDelete: () => void;
  onPrint: () => void;
  onDownloadEml: () => void;
  onSnoozed?: () => void;
  children?: React.ReactNode;
}

export function MessageToolbar({
  accountId,
  folder,
  uid,
  isFlagged,
  isSnoozed = false,
  onBack,
  onReply,
  onForward,
  onToggleFlag,
  onArchive,
  onMarkJunk,
  onDelete,
  onPrint,
  onDownloadEml,
  onSnoozed,
  children,
}: MessageToolbarProps) {
  return (
    <div className="flex items-center justify-between border-b border-border bg-background/80 px-4 py-2 shrink-0 no-print">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          className="md:hidden mr-1"
          onClick={onBack}
          title="Retour aux messages"
          aria-label="Retour aux messages"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onReply} title="Répondre (R)">
          <Reply className="size-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onForward} title="Transférer (F)">
          <Forward className="size-4" />
        </Button>
        <div className="mx-1 h-4 w-px bg-border" />
        <Button variant="ghost" size="icon-sm" onClick={onToggleFlag} title="Marquer comme important (S)">
          <Star
            className={isFlagged ? "size-4 fill-amber-400 text-amber-400" : "size-4"}
          />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onArchive} title="Archiver (E)">
          <Archive className="size-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onMarkJunk} title="Marquer comme spam (!)">
          <Ban className="size-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onDelete} title="Supprimer (Suppr)">
          <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
        </Button>
        <SnoozeDropdown
          accountId={accountId}
          folder={folder}
          uid={uid}
          isSnoozed={isSnoozed}
          onSnoozed={onSnoozed}
        />

        {children}

        <div className="mx-1 h-4 w-px bg-border" />
        <Button variant="ghost" size="icon-sm" onClick={onPrint} title="Imprimer (Ctrl+P)">
          <Printer className="size-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onDownloadEml} title="Télécharger (.eml)">
          <Download className="size-4" />
        </Button>
      </div>

      <div className="text-xs text-muted-foreground font-mono">
        UID: #{uid}
      </div>
    </div>
  );
}
