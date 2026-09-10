"use client";

import { useEffect } from "react";
import { useMessageDetail, useUpdateFlags, useDeleteMessage, useMoveMessage, useMarkAsJunk } from "@/lib/queries/messages";
import { useUIStore } from "@/lib/stores/uiStore";
import { GlassPanel } from "@/components/mail/GlassPanel";
import { EmailIframe } from "@/components/mail/EmailIframe";
import { AttachmentList } from "@/components/mail/AttachmentList";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { Mail, Reply, Forward, Trash2, Star, Archive, Ban, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface MessageReaderProps {
  accountId: string;
  folder: string;
  uid: number | null;
}

export function MessageReader({ accountId, folder, uid }: MessageReaderProps) {
  const { data: message, isLoading } = useMessageDetail(accountId, folder, uid);
  const updateFlags = useUpdateFlags(accountId, folder);
  // `mutate` est stable en React Query v5 — ne change pas de référence entre les renders.
  const markAsSeen = updateFlags.mutate;
  const deleteMessage = useDeleteMessage(accountId, folder);
  const moveMessage = useMoveMessage(accountId, folder);
  const markAsJunk = useMarkAsJunk(accountId, folder);
  const openCompose = useUIStore((s) => s.openCompose);
  const setSelectedUid = useUIStore((s) => s.setSelectedUid);

  // Marquer comme lu à l'ouverture si non lu.
  useEffect(() => {
    if (message && !message.flags.seen && uid !== null) {
      markAsSeen({ uid, flags: { seen: true } });
    }
  }, [message, uid, markAsSeen]);

  if (uid === null) {
    return (
      <GlassPanel className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/30">
            <Mail className="size-6" />
          </div>
          <p className="text-sm">Sélectionnez un message</p>
        </div>
      </GlassPanel>
    );
  }

  if (isLoading) {
    return (
      <GlassPanel className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </GlassPanel>
    );
  }

  if (!message) {
    return (
      <GlassPanel className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Message introuvable</p>
      </GlassPanel>
    );
  }

  const handleDelete = () => {
    deleteMessage.mutate(
      { uid },
      {
        onSuccess: () => {
          toast.success("Message supprimé");
          setSelectedUid(null);
        },
        onError: () => toast.error("Erreur lors de la suppression"),
      },
    );
  };

  const handleToggleFlag = () => {
    updateFlags.mutate({ uid, flags: { flagged: !message.flags.flagged } });
  };

  const handleMarkJunk = () => {
    markAsJunk.mutate(uid, {
      onSuccess: () => {
        toast.success("Marqué comme spam");
        setSelectedUid(null);
      },
      onError: () => toast.error("Erreur"),
    });
  };

  const handleArchive = () => {
    moveMessage.mutate(
      { uid, destination: "Archive" },
      {
        onSuccess: () => {
          toast.success("Message archivé");
          setSelectedUid(null);
        },
        onError: () => toast.error("Erreur lors du déplacement"),
      },
    );
  };

  return (
    <GlassPanel className="flex flex-1 flex-col">
      {/* Barre d'actions */}
      <div className="flex items-center gap-1 border-b border-border px-4 py-2">
        <Button variant="ghost" size="icon-sm" onClick={() => openCompose("reply", { messageId: message.messageId, subject: message.subject, from: message.from.address, to: message.to.map((t) => t.address) })}>
          <Reply className="size-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => openCompose("forward", { subject: message.subject })}>
          <Forward className="size-4" />
        </Button>
        <div className="mx-1 h-5 w-px bg-border" />
        <Button variant="ghost" size="icon-sm" onClick={handleToggleFlag}>
          <Star className={message.flags.flagged ? "size-4 fill-amber-400 text-amber-400" : "size-4"} />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={handleArchive}>
          <Archive className="size-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={handleMarkJunk}>
          <Ban className="size-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={handleDelete}>
          <Trash2 className="size-4" />
        </Button>
      </div>

      {/* En-tête du message */}
      <div className="border-b border-border px-6 py-4">
        <h1 className="mb-3 text-lg font-semibold">{message.subject || "(Sans objet)"}</h1>
        <div className="flex flex-col gap-1 text-sm">
          <div className="flex gap-2">
            <span className="w-16 shrink-0 text-muted-foreground">De :</span>
            <span>{message.from.name ? `${message.from.name} <${message.from.address}>` : message.from.address}</span>
          </div>
          <div className="flex gap-2">
            <span className="w-16 shrink-0 text-muted-foreground">À :</span>
            <span>{message.to.map((t) => t.name ? `${t.name} <${t.address}>` : t.address).join(", ")}</span>
          </div>
          {message.cc && message.cc.length > 0 && (
            <div className="flex gap-2">
              <span className="w-16 shrink-0 text-muted-foreground">Cc :</span>
              <span>{message.cc.map((t) => t.name ? `${t.name} <${t.address}>` : t.address).join(", ")}</span>
            </div>
          )}
          <div className="flex gap-2">
            <span className="w-16 shrink-0 text-muted-foreground">Date :</span>
            <span>{formatDate(message.date)}</span>
          </div>
        </div>
      </div>

      {/* Corps + pièces jointes */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {message.attachments.length > 0 && (
          <div className="mb-4">
            <AttachmentList accountId={accountId} folder={folder} uid={uid} attachments={message.attachments} />
          </div>
        )}
        <EmailIframe html={message.html} text={message.text} />
      </div>
    </GlassPanel>
  );
}
