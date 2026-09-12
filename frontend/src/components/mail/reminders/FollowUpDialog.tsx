"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BellRing, Calendar, Clock, Trash2, Loader2, CalendarDays } from "lucide-react";
import { format, addDays, setHours, setMinutes } from "date-fns";
import { fr } from "date-fns/locale";
import {
  useMessageReminder,
  useCreateReminder,
  useCancelReminder,
} from "@/lib/queries/reminders";
import { toast } from "sonner";

interface FollowUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  folder: string;
  uid: number;
  onSelect?: (remindAt: string, note?: string) => void;
  onClear?: () => void;
  initialRemindAt?: string;
  initialNote?: string;
}

export function FollowUpDialog({
  open,
  onOpenChange,
  accountId,
  folder,
  uid,
  onSelect,
  onClear,
  initialRemindAt,
  initialNote,
}: FollowUpDialogProps) {
  const isDirectMode = !onSelect;
  const { data: existingReminder, isLoading: loadingExisting } = useMessageReminder(
    isDirectMode && open ? accountId : null,
    folder,
    uid,
  );

  const createMutation = useCreateReminder(accountId, folder, uid);
  const cancelMutation = useCancelReminder(accountId);

  const now = new Date();
  const in2Days = setMinutes(setHours(addDays(now, 2), 9), 0);
  const in4Days = setMinutes(setHours(addDays(now, 4), 9), 0);
  const in1Week = setMinutes(setHours(addDays(now, 7), 9), 0);
  const in2Weeks = setMinutes(setHours(addDays(now, 14), 9), 0);

  const presets = [
    {
      label: "Dans 2 jours",
      detail: `${format(in2Days, "EEEE d MMMM", { locale: fr })} à 09:00`,
      date: in2Days,
      icon: Clock,
    },
    {
      label: "Dans 4 jours",
      detail: `${format(in4Days, "EEEE d MMMM", { locale: fr })} à 09:00`,
      date: in4Days,
      icon: Calendar,
    },
    {
      label: "Dans 1 semaine",
      detail: `${format(in1Week, "EEEE d MMMM", { locale: fr })} à 09:00`,
      date: in1Week,
      icon: CalendarDays,
    },
    {
      label: "Dans 2 semaines",
      detail: `${format(in2Weeks, "EEEE d MMMM", { locale: fr })} à 09:00`,
      date: in2Weeks,
      icon: CalendarDays,
    },
  ];

  const [note, setNote] = useState("");
  const [customDate, setCustomDate] = useState(format(addDays(now, 2), "yyyy-MM-dd"));
  const [customTime, setCustomTime] = useState("09:00");
  const [customError, setCustomError] = useState<string | null>(null);

  useEffect(() => {
    if (existingReminder) {
      setNote(existingReminder.note || "");
      const d = new Date(existingReminder.remindAt);
      setCustomDate(format(d, "yyyy-MM-dd"));
      setCustomTime(format(d, "HH:mm"));
    } else if (initialRemindAt) {
      setNote(initialNote || "");
      const d = new Date(initialRemindAt);
      setCustomDate(format(d, "yyyy-MM-dd"));
      setCustomTime(format(d, "HH:mm"));
    } else {
      setNote("");
    }
  }, [existingReminder, initialRemindAt, initialNote]);

  const handleApply = async (targetDate: Date) => {
    setCustomError(null);
    if (targetDate.getTime() <= Date.now() + 60000) {
      setCustomError("La date de relance doit être située dans le futur");
      return;
    }

    const isoDate = targetDate.toISOString();
    if (onSelect) {
      onSelect(isoDate, note.trim() || undefined);
      onOpenChange(false);
      return;
    }

    try {
      await createMutation.mutateAsync({
        remindAt: isoDate,
        note: note.trim() || undefined,
      });
      toast.success("Rappel de relance enregistré");
      onOpenChange(false);
    } catch {
      toast.error("Erreur lors de l'enregistrement du rappel");
    }
  };

  const handleCustomSubmit = () => {
    if (!customDate || !customTime) {
      setCustomError("Date et heure requises");
      return;
    }
    const [hours, minutes] = customTime.split(":").map(Number);
    const selected = new Date(customDate);
    selected.setHours(hours, minutes, 0, 0);
    handleApply(selected);
  };

  const handleCancelReminder = async () => {
    if (!existingReminder) return;
    try {
      await cancelMutation.mutateAsync(existingReminder.id);
      toast.info("Rappel de relance supprimé");
      onOpenChange(false);
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  const isPending = createMutation.isPending || cancelMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="size-4 text-primary" />
            Rappel de suivi & relance
          </DialogTitle>
          <DialogDescription>
            Recevez une notification si aucune réponse n&apos;a été reçue avant cette échéance.
          </DialogDescription>
        </DialogHeader>

        {loadingExisting ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col gap-4 py-2">
            {existingReminder && existingReminder.status === "pending" && (
              <div className="rounded-lg bg-primary/10 border border-primary/20 px-3 py-2 text-xs flex items-center justify-between">
                <span>
                  Rappel actif programmé pour le{" "}
                  <strong>
                    {format(new Date(existingReminder.remindAt), "d MMMM à HH:mm", { locale: fr })}
                  </strong>
                </span>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={handleCancelReminder}
                  disabled={isPending}
                  className="text-destructive hover:text-destructive h-6 px-1.5"
                >
                  <Trash2 className="size-3 mr-1" />
                  Supprimer
                </Button>
              </div>
            )}
            {!existingReminder && initialRemindAt && onClear && (
              <div className="rounded-lg bg-primary/10 border border-primary/20 px-3 py-2 text-xs flex items-center justify-between">
                <span>
                  Rappel prévu pour le{" "}
                  <strong>
                    {format(new Date(initialRemindAt), "d MMMM à HH:mm", { locale: fr })}
                  </strong>
                </span>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    onClear();
                    onOpenChange(false);
                  }}
                  className="text-destructive hover:text-destructive h-6 px-1.5"
                >
                  <Trash2 className="size-3 mr-1" />
                  Supprimer
                </Button>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Note de rappel (optionnel)</Label>
              <Input
                placeholder="Ex : Relancer le client pour la signature du devis..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                className="text-xs"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Délais recommandés</span>
              <div className="grid grid-cols-1 gap-1.5">
                {presets.map((preset, idx) => {
                  const Icon = preset.icon;
                  return (
                    <Button
                      key={idx}
                      variant="outline"
                      disabled={isPending}
                      className="justify-between h-9 px-3 text-xs"
                      onClick={() => handleApply(preset.date)}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="size-3.5 text-primary" />
                        <span className="font-medium">{preset.label}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">{preset.detail}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-border pt-3 flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">Date et heure personnalisées</span>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  min={format(now, "yyyy-MM-dd")}
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="text-xs h-8"
                />
                <Input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  className="text-xs h-8"
                />
              </div>
              {customError && <p className="text-xs text-destructive">{customError}</p>}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={isPending}>
            Annuler
          </Button>
          <Button size="sm" onClick={handleCustomSubmit} disabled={isPending || loadingExisting}>
            {isPending ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <BellRing className="size-3.5 mr-1" />}
            Définir ce rappel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
