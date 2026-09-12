"use client";

import { useState } from "react";
import {
  BellRing,
  CheckCircle2,
  Clock,
  Pencil,
  Reply,
  Check,
  Loader2,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useMessageReminder,
  useSnoozeReminder,
  useDismissReminder,
  useCancelReminder,
} from "@/lib/queries/reminders";
import { FollowUpDialog } from "@/components/mail/reminders/FollowUpDialog";
import { format, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

interface FollowUpBannerProps {
  accountId: string;
  folder: string;
  uid: number;
  subject: string;
  onReply?: () => void;
}

export function FollowUpBanner({
  accountId,
  folder,
  uid,
  onReply,
}: FollowUpBannerProps) {
  const { data: reminder, isLoading } = useMessageReminder(accountId, folder, uid);
  const snoozeMutation = useSnoozeReminder(accountId);
  const dismissMutation = useDismissReminder(accountId);
  const cancelMutation = useCancelReminder(accountId);
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading || !reminder) {
    return null;
  }

  // Statuts non affichés
  if (reminder.status === "cancelled" || reminder.status === "dismissed") {
    return null;
  }

  const handleSnooze = async (days: number) => {
    const newDate = addDays(new Date(), days);
    newDate.setHours(9, 0, 0, 0);
    try {
      await snoozeMutation.mutateAsync({
        reminderId: reminder.id,
        remindAt: newDate.toISOString(),
      });
      toast.success(`Rappel reporté de ${days} jour(s)`);
    } catch {
      toast.error("Échec du report");
    }
  };

  const handleDismiss = async () => {
    try {
      await dismissMutation.mutateAsync(reminder.id);
      toast.info("Rappel marqué comme traité");
    } catch {
      toast.error("Échec de l'acquittement");
    }
  };

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync(reminder.id);
      toast.info("Rappel annulé");
    } catch {
      toast.error("Échec de l'annulation");
    }
  };

  const isPending =
    snoozeMutation.isPending || dismissMutation.isPending || cancelMutation.isPending;

  // 1. Rappel échu (Triggered)
  if (reminder.status === "triggered") {
    return (
      <>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-3 bg-amber-500/10 border-b border-amber-500/20 text-foreground transition-all">
          <div className="flex items-start sm:items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
              <BellRing className="size-4 animate-pulse" />
            </div>
            <div className="flex flex-col text-xs">
              <span className="font-semibold text-amber-700 dark:text-amber-300">
                Rappel de suivi : aucune réponse reçue à ce message
              </span>
              {reminder.note && (
                <span className="text-muted-foreground mt-0.5 italic">
                  Note : &laquo; {reminder.note} &raquo;
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
            {onReply && (
              <Button
                size="xs"
                variant="default"
                onClick={onReply}
                disabled={isPending}
                className="text-xs gap-1.5 h-7 px-2.5 bg-amber-600 hover:bg-amber-700 text-white"
              >
                <Reply className="size-3" />
                Relancer
              </Button>
            )}
            <Button
              size="xs"
              variant="outline"
              onClick={() => handleSnooze(2)}
              disabled={isPending}
              className="text-xs gap-1 h-7 px-2"
              title="Reporter de 2 jours"
            >
              <Clock className="size-3" />
              +2j
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={() => handleSnooze(7)}
              disabled={isPending}
              className="text-xs gap-1 h-7 px-2"
              title="Reporter d'une semaine"
            >
              <CalendarDays className="size-3" />
              +1 sem
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={handleDismiss}
              disabled={isPending}
              className="text-xs gap-1 h-7 px-2 text-muted-foreground hover:text-foreground"
              title="Marquer ce suivi comme traité"
            >
              {dismissMutation.isPending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Check className="size-3" />
              )}
              Traiter
            </Button>
          </div>
        </div>

        <FollowUpDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          accountId={accountId}
          folder={folder}
          uid={uid}
        />
      </>
    );
  }

  // 2. Rappel en attente (Pending)
  if (reminder.status === "pending") {
    const remindDate = new Date(reminder.remindAt);
    return (
      <>
        <div className="flex items-center justify-between px-4 py-2 bg-primary/5 border-b border-primary/10 text-xs text-foreground">
          <div className="flex items-center gap-2">
            <BellRing className="size-3.5 text-primary shrink-0" />
            <span>
              Rappel de relance actif pour le{" "}
              <strong>{format(remindDate, "d MMMM à HH:mm", { locale: fr })}</strong>
              {reminder.note && (
                <span className="text-muted-foreground ml-2">
                  (&laquo; {reminder.note} &raquo;)
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              size="xs"
              variant="ghost"
              onClick={() => setEditOpen(true)}
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <Pencil className="size-3 mr-1" />
              Modifier
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={handleCancel}
              disabled={isPending}
              className="h-6 px-2 text-xs text-destructive hover:text-destructive"
            >
              Annuler
            </Button>
          </div>
        </div>

        <FollowUpDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          accountId={accountId}
          folder={folder}
          uid={uid}
        />
      </>
    );
  }

  // 3. Réponse reçue (Replied)
  if (reminder.status === "replied") {
    const repliedDate = reminder.repliedAt ? new Date(reminder.repliedAt) : null;
    return (
      <div className="flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border-b border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300">
        <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span>
          Réponse reçue
          {repliedDate && ` le ${format(repliedDate, "d MMMM à HH:mm", { locale: fr })}`}{" "}
          — Rappel de suivi désactivé.
        </span>
      </div>
    );
  }

  return null;
}
