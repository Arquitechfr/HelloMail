"use client";

import React, { useState, useRef, useEffect } from "react";
import { Clock, Calendar, Sun, Sunset, CalendarDays, ArrowUpRight, RotateCcw } from "lucide-react";
import { useSnoozeMessage } from "@/lib/queries/messages";
import { getSnoozePresets, type SnoozePreset } from "@/lib/types/snooze";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SnoozeDropdownProps {
  accountId: string;
  folder: string;
  uid: number;
  isSnoozed?: boolean;
  onSnoozed?: () => void;
  className?: string;
}

export function SnoozeDropdown({
  accountId,
  folder,
  uid,
  isSnoozed = false,
  onSnoozed,
  className,
}: SnoozeDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customDateTime, setCustomDateTime] = useState("");
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [presets, setPresets] = useState<SnoozePreset[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const snoozeMutation = useSnoozeMessage(accountId, folder);

  const handleOpen = () => {
    if (!isOpen) {
      setPresets(getSnoozePresets());
      setShowCustomPicker(false);
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const applySnooze = async (date: Date | null) => {
    setIsOpen(false);
    const isoString = date ? date.toISOString() : null;

    try {
      await snoozeMutation.mutateAsync({ uid, snoozedUntil: isoString });

      if (date) {
        toast.success("Email mis en sommeil", {
          description: `Réveil prévu le ${date.toLocaleString("fr-FR", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}`,
          action: {
            label: "Annuler",
            onClick: () => {
              snoozeMutation.mutate({ uid, snoozedUntil: null });
              toast.info("Mise en sommeil annulée");
            },
          },
        });
      } else {
        toast.success("Email réveillé et replacé dans votre boîte de réception");
      }

      onSnoozed?.();
    } catch {
      toast.error("Échec de la mise en sommeil");
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDateTime) return;
    const date = new Date(customDateTime);
    if (isNaN(date.getTime()) || date <= new Date()) {
      toast.error("Veuillez sélectionner une date et heure future");
      return;
    }
    applySnooze(date);
  };

  const getPresetIcon = (id: string) => {
    switch (id) {
      case "later_today":
        return <Sunset className="size-3.5 text-amber-500" />;
      case "tomorrow":
        return <Sun className="size-3.5 text-yellow-500" />;
      case "weekend":
        return <Calendar className="size-3.5 text-emerald-500" />;
      case "next_week":
        return <CalendarDays className="size-3.5 text-blue-500" />;
      default:
        return <Clock className="size-3.5 text-muted-foreground" />;
    }
  };

  return (
    <div className={cn("relative inline-block", className)} ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleOpen}
        title={isSnoozed ? "Modifier la mise en sommeil" : "Mettre en sommeil (Snooze)"}
        className={cn(
          "cursor-pointer",
          isSnoozed && "text-primary hover:text-primary bg-primary/10",
        )}
      >
        <Clock className={cn("size-4", isSnoozed && "fill-primary/20 text-primary")} />
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-64 rounded-lg border border-border bg-popover/95 p-1.5 shadow-xl backdrop-blur-md z-50 animate-in fade-in-0 zoom-in-95 select-none">
          <div className="flex items-center gap-1.5 px-2 py-1.5 mb-1 border-b border-border/60">
            <Clock className="size-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground">
              Mettre en sommeil jusqu&apos;à...
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            {isSnoozed && (
              <button
                type="button"
                onClick={() => applySnooze(null)}
                className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors text-left cursor-pointer font-medium mb-1 border-b border-border/40 pb-2"
              >
                <RotateCcw className="size-3.5" />
                <span>Réveiller maintenant (Annuler)</span>
              </button>
            )}

            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applySnooze(preset.getDate())}
                className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-md text-xs hover:bg-muted/80 transition-colors text-left cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  {getPresetIcon(preset.id)}
                  <span className="text-foreground group-hover:text-primary font-medium">
                    {preset.label}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {preset.timeLabel}
                </span>
              </button>
            ))}

            {!showCustomPicker ? (
              <button
                type="button"
                onClick={() => setShowCustomPicker(true)}
                className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-md text-xs hover:bg-muted/80 transition-colors text-left cursor-pointer text-muted-foreground hover:text-foreground mt-0.5 pt-1.5 border-t border-border/40"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="size-3.5" />
                  <span>Choisir date & heure...</span>
                </div>
                <ArrowUpRight className="size-3" />
              </button>
            ) : (
              <form onSubmit={handleCustomSubmit} className="flex flex-col gap-2 p-1.5 mt-1 border-t border-border/50">
                <input
                  type="datetime-local"
                  value={customDateTime}
                  onChange={(e) => setCustomDateTime(e.target.value)}
                  className="w-full rounded border border-border bg-muted/40 px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
                <div className="flex items-center justify-end gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => setShowCustomPicker(false)}
                    className="text-xs h-6 px-2"
                  >
                    Retour
                  </Button>
                  <Button type="submit" size="xs" className="text-xs h-6 px-2.5">
                    Confirmer
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
