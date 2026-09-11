"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Clock, Calendar, Sun, Moon, CalendarDays } from "lucide-react";
import { format, addDays, nextMonday, setHours, setMinutes, isBefore } from "date-fns";
import { fr } from "date-fns/locale";

interface ScheduleSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSchedule: (date: Date) => void;
  loading?: boolean;
}

export function ScheduleSendDialog({
  open,
  onOpenChange,
  onSchedule,
  loading,
}: ScheduleSendDialogProps) {
  const now = new Date();

  // Presets intelligents calculés
  const tonight = setMinutes(setHours(now, 18), 0);
  const tomorrowMorning = setMinutes(setHours(addDays(now, 1), 8), 0);
  const tomorrowAfternoon = setMinutes(setHours(addDays(now, 1), 14), 0);
  const nextMon = setMinutes(setHours(nextMonday(now), 8), 0);

  const presets = [
    ...(isBefore(now, tonight)
      ? [{ label: "Ce soir", detail: "18:00", date: tonight, icon: Moon }]
      : []),
    {
      label: "Demain matin",
      detail: `${format(tomorrowMorning, "EEEE d MMM", { locale: fr })} à 08:00`,
      date: tomorrowMorning,
      icon: Sun,
    },
    {
      label: "Demain après-midi",
      detail: `${format(tomorrowAfternoon, "EEEE d MMM", { locale: fr })} à 14:00`,
      date: tomorrowAfternoon,
      icon: Clock,
    },
    {
      label: "Lundi prochain",
      detail: `${format(nextMon, "d MMMM", { locale: fr })} à 08:00`,
      date: nextMon,
      icon: CalendarDays,
    },
  ];

  const minDateStr = format(now, "yyyy-MM-dd");
  const [customDate, setCustomDate] = useState(format(addDays(now, 1), "yyyy-MM-dd"));
  const [customTime, setCustomTime] = useState("08:00");
  const [customError, setCustomError] = useState<string | null>(null);

  const handleApplyCustom = () => {
    setCustomError(null);
    if (!customDate || !customTime) {
      setCustomError("Veuillez sélectionner une date et une heure valides");
      return;
    }
    const [hours, minutes] = customTime.split(":").map(Number);
    const selected = new Date(customDate);
    selected.setHours(hours, minutes, 0, 0);

    if (selected.getTime() <= Date.now() + 60000) {
      setCustomError("L'heure programmée doit être située dans le futur (au moins 1 minute)");
      return;
    }

    onSchedule(selected);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="size-4 text-primary" />
            Programmer l'envoi
          </DialogTitle>
          <DialogDescription>
            Choisissez quand vous souhaitez que cet email soit envoyé automatiquement.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Options de presets */}
          <div className="grid grid-cols-1 gap-1.5">
            {presets.map((preset) => {
              const Icon = preset.icon;
              return (
                <button
                  key={preset.label}
                  type="button"
                  disabled={loading}
                  onClick={() => onSchedule(preset.date)}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3.5 py-2.5 text-left text-sm transition-colors hover:bg-accent/60 hover:text-accent-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="size-4 text-primary shrink-0" />
                    <span className="font-medium text-foreground">{preset.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground capitalize">{preset.detail}</span>
                </button>
              );
            })}
          </div>

          <div className="relative my-1 flex items-center justify-center">
            <span className="absolute inset-x-0 h-px bg-border/60" />
            <span className="relative bg-background px-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
              Ou date personnalisée
            </span>
          </div>

          {/* Date et Heure personnalisées */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="schedule-date" className="text-xs">
                Date
              </Label>
              <Input
                id="schedule-date"
                type="date"
                min={minDateStr}
                value={customDate}
                onChange={(e) => {
                  setCustomDate(e.target.value);
                  setCustomError(null);
                }}
                className="h-9 text-xs"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="schedule-time" className="text-xs">
                Heure
              </Label>
              <Input
                id="schedule-time"
                type="time"
                value={customTime}
                onChange={(e) => {
                  setCustomTime(e.target.value);
                  setCustomError(null);
                }}
                className="h-9 text-xs"
              />
            </div>
          </div>

          {customError && (
            <p className="text-xs text-destructive mt-1 font-medium">{customError}</p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Annuler
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleApplyCustom}
            disabled={loading}
          >
            <Calendar className="size-3.5 mr-1.5" />
            Confirmer la date
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
