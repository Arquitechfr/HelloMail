"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, Trash2, Calendar, Mail, Loader2, Inbox } from "lucide-react";
import { useScheduledMessages, useCancelScheduledMessage } from "@/lib/queries/scheduled";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

interface ScheduledMessagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
}

export function ScheduledMessagesDialog({
  open,
  onOpenChange,
  accountId,
}: ScheduledMessagesDialogProps) {
  const { data: messages, isLoading } = useScheduledMessages(accountId);
  const cancelMutation = useCancelScheduledMessage(accountId);

  const handleCancel = (id: string, subject: string) => {
    cancelMutation.mutate(id, {
      onSuccess: () => {
        toast.success(`Envoi programmé "${subject || "Sans objet"}" annulé`);
      },
      onError: () => {
        toast.error("Impossible d'annuler l'envoi programmé");
      },
    });
  };

  const hasManyMessages = Boolean(messages && messages.length > 2);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`w-[96vw] max-h-[85vh] overflow-y-auto no-scrollbar ${
          hasManyMessages ? "sm:max-w-lg md:max-w-3xl lg:max-w-4xl" : "sm:max-w-lg"
        }`}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="size-4 text-primary" />
            Messages programmés
          </DialogTitle>
          <DialogDescription>
            Emails en attente d'envoi automatique pour ce compte.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 py-2 max-h-[60vh] overflow-y-auto no-scrollbar">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : !messages || messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted/50 border border-border mb-2">
                <Inbox className="size-5 opacity-60" />
              </div>
              <p className="text-xs font-medium text-foreground">Aucun message programmé</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Vous pouvez programmer un envoi via la flèche à côté du bouton "Envoyer".
              </p>
            </div>
          ) : (
            <div className={`grid gap-2.5 ${hasManyMessages ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
              {messages.map((msg) => {
                const scheduledDate = new Date(msg.scheduledAt);
                const toAddresses = msg.payload.to?.join(", ") || "Sans destinataire";
                return (
                  <div
                    key={msg.id || msg._id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs transition-colors hover:bg-accent/40"
                  >
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 font-medium text-foreground truncate">
                        <Mail className="size-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{msg.payload.subject || "(Sans objet)"}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        À : {toAddresses}
                      </p>
                      <div className="flex items-center gap-1 text-[11px] text-primary font-medium mt-0.5">
                        <Calendar className="size-3" />
                        <span>
                          Prévu le {format(scheduledDate, "d MMMM yyyy à HH:mm", { locale: fr })}
                        </span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      disabled={cancelMutation.isPending}
                      onClick={() => handleCancel(msg.id || msg._id!, msg.payload.subject)}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      title="Annuler l'envoi programmé"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
