"use client";

import { useMemo } from "react";
import type { CalendarEventInfo } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin, User, Download, ExternalLink, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface CalendarInviteBannerProps {
  calendarEvent: CalendarEventInfo;
}

/**
 * Formate une plage de dates pour affichage lisible en français.
 */
function formatEventDates(dtStart?: string, dtEnd?: string): string {
  if (!dtStart) return "Date non précisée";

  const start = new Date(dtStart);
  if (isNaN(start.getTime())) return dtStart;

  const dateStr = start.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const startTime = start.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (!dtEnd) {
    return `${dateStr} à ${startTime}`;
  }

  const end = new Date(dtEnd);
  if (isNaN(end.getTime())) {
    return `${dateStr} à ${startTime}`;
  }

  const endTime = end.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Si même jour
  if (start.toDateString() === end.toDateString()) {
    return `${dateStr}, de ${startTime} à ${endTime}`;
  }

  const endDateStr = end.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
  });

  return `Du ${dateStr} (${startTime}) au ${endDateStr} (${endTime})`;
}

/**
 * Génère une URL pour ajouter l'événement dans Google Calendar.
 */
function buildGoogleCalendarUrl(event: CalendarEventInfo): string {
  const base = "https://calendar.google.com/calendar/render?action=TEMPLATE";
  const params = new URLSearchParams();
  params.set("text", event.summary || "Événement");

  if (event.dtStart) {
    const toGCalDate = (d: string) =>
      new Date(d).toISOString().replace(/-|:|\.\d+/g, "");
    const startIso = toGCalDate(event.dtStart);
    const endIso = event.dtEnd ? toGCalDate(event.dtEnd) : startIso;
    params.set("dates", `${startIso}/${endIso}`);
  }

  if (event.location) params.set("location", event.location);
  if (event.description) params.set("details", event.description);

  return `${base}&${params.toString()}`;
}

export function CalendarInviteBanner({ calendarEvent }: CalendarInviteBannerProps) {
  const isCancelled =
    calendarEvent.method === "CANCEL" || calendarEvent.status === "CANCELLED";

  const formattedDate = useMemo(
    () => formatEventDates(calendarEvent.dtStart, calendarEvent.dtEnd),
    [calendarEvent.dtStart, calendarEvent.dtEnd]
  );

  const googleCalUrl = useMemo(
    () => buildGoogleCalendarUrl(calendarEvent),
    [calendarEvent]
  );

  const handleDownloadIcs = () => {
    if (!calendarEvent.rawIcs) {
      toast.error("Données de l'invitation indisponibles");
      return;
    }

    const blob = new Blob([calendarEvent.rawIcs], {
      type: "text/calendar;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${calendarEvent.summary || "invitation"}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Fichier .ics téléchargé");
  };

  return (
    <div
      className={`mx-6 mt-4 rounded-xl border p-4 shadow-xs transition-colors no-print ${
        isCancelled
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-border bg-card/60 backdrop-blur-xs"
      }`}
    >
      <div className="flex flex-col gap-3">
        {/* En-tête statut */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className={`flex size-8 items-center justify-center rounded-lg ${
                isCancelled
                  ? "bg-destructive/15 text-destructive"
                  : "bg-primary/10 text-primary"
              }`}
            >
              {isCancelled ? (
                <AlertTriangle className="size-4" />
              ) : (
                <Calendar className="size-4" />
              )}
            </div>
            <div>
              <span
                className={`text-xs font-semibold uppercase tracking-wider ${
                  isCancelled ? "text-destructive" : "text-primary"
                }`}
              >
                {isCancelled ? "Événement annulé" : "Invitation d'agenda"}
              </span>
              <h4 className="text-sm font-semibold text-foreground leading-tight">
                {calendarEvent.summary}
              </h4>
            </div>
          </div>

          {/* Boutons d'action rapide */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadIcs}
              title="Télécharger le fichier .ics"
              className="text-xs h-8"
            >
              <Download className="size-3.5 mr-1.5" />
              Exporter (.ics)
            </Button>
            {!isCancelled && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(googleCalUrl, "_blank", "noopener,noreferrer")}
                title="Ajouter dans Google Agenda"
                className="text-xs h-8 hidden sm:inline-flex"
              >
                <ExternalLink className="size-3.5 mr-1.5" />
                Google Agenda
              </Button>
            )}

          </div>
        </div>

        {/* Détails de l'événement */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs text-muted-foreground border-t border-border/50">
          <div className="flex items-center gap-2">
            <Clock className="size-3.5 shrink-0 text-foreground/70" />
            <span className="capitalize">{formattedDate}</span>
          </div>

          {calendarEvent.location && (
            <div className="flex items-center gap-2">
              <MapPin className="size-3.5 shrink-0 text-foreground/70" />
              <span className="truncate">{calendarEvent.location}</span>
            </div>
          )}

          {calendarEvent.organizer && (
            <div className="flex items-center gap-2">
              <User className="size-3.5 shrink-0 text-foreground/70" />
              <span className="truncate">
                Organisateur :{" "}
                {calendarEvent.organizer.name
                  ? `${calendarEvent.organizer.name} (${calendarEvent.organizer.email})`
                  : calendarEvent.organizer.email}
              </span>
            </div>
          )}

          {calendarEvent.attendees && calendarEvent.attendees.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium text-[11px]">
                {calendarEvent.attendees.length} participant
                {calendarEvent.attendees.length > 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>

        {calendarEvent.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 italic border-l-2 border-primary/30 pl-2">
            {calendarEvent.description}
          </p>
        )}
      </div>
    </div>
  );
}
