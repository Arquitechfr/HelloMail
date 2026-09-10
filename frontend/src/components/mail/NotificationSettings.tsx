"use client";

import { useState } from "react";
import { useUIStore } from "@/lib/stores/uiStore";
import {
  isDesktopNotificationSupported,
  getDesktopNotificationPermission,
  requestDesktopNotificationPermission,
  playNotificationSound,
  showDesktopNotification,
} from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { Bell, Volume2, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";

export function NotificationSettings() {
  const [supported] = useState(() => isDesktopNotificationSupported());
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    getDesktopNotificationPermission(),
  );

  const desktopEnabled = useUIStore((s) => s.desktopNotificationsEnabled);
  const soundEnabled = useUIStore((s) => s.notificationSoundEnabled);
  const setDesktopEnabled = useUIStore((s) => s.setDesktopNotificationsEnabled);
  const setSoundEnabled = useUIStore((s) => s.setNotificationSoundEnabled);

  const handleRequestPermission = async () => {
    const perm = await requestDesktopNotificationPermission();
    setPermission(perm);
    if (perm === "granted") {
      setDesktopEnabled(true);
      toast.success("Notifications de bureau autorisées !");
    } else {
      toast.error("L'autorisation de notification a été refusée.");
    }
  };

  const handleTestNotification = () => {
    if (soundEnabled) {
      playNotificationSound();
    }
    if (permission === "granted" && desktopEnabled) {
      showDesktopNotification({
        title: "HelloMail — Notification de test",
        body: "Votre système de notifications de bureau et carillon sonore fonctionne parfaitement !",
      });
      toast.success("Notification de test envoyée !");
    } else {
      toast.info("Carillon joué. Activez les notifications pour voir l'alerte native.");
    }
  };

  return (
    <div className="rounded-md border border-border bg-card/60 p-5 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="size-4 text-primary" />
          <h2 className="text-sm font-bold font-display text-foreground">
            Notifications de Bureau & Sons
          </h2>
        </div>
        {supported && permission === "granted" && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs h-8"
            onClick={handleTestNotification}
          >
            <Sparkles className="size-3.5 text-primary" />
            Tester la notification
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Recevez des alertes natives sur votre écran et un carillon sonore discret dès l&apos;arrivée d&apos;un nouveau message.
      </p>

      {!supported ? (
        <div className="flex items-center gap-2 p-3 rounded-md bg-muted/30 border border-border/50 text-xs text-muted-foreground">
          <AlertCircle className="size-4 text-amber-500 shrink-0" />
          <span>Votre navigateur ne prend pas en charge l&apos;API Web Notifications.</span>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-border/60">
          {/* Statut de permission */}
          <div className="flex items-center justify-between py-3">
            <div>
              <span className="text-xs font-medium text-foreground">Autorisation du navigateur</span>
              <p className="text-[11px] text-muted-foreground">
                {permission === "granted"
                  ? "HelloMail est autorisé à envoyer des alertes système."
                  : permission === "denied"
                    ? "Les notifications sont bloquées dans les paramètres de votre navigateur."
                    : "Autorisation requise pour afficher les notifications à l'écran."}
              </p>
            </div>
            {permission === "granted" ? (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-500 border border-emerald-500/20">
                <CheckCircle2 className="size-3" /> Accordée
              </span>
            ) : permission === "denied" ? (
              <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive border border-destructive/20">
                <AlertCircle className="size-3" /> Bloquée
              </span>
            ) : (
              <Button
                size="sm"
                className="gap-1 text-xs h-7 bg-primary text-primary-foreground"
                onClick={handleRequestPermission}
              >
                Autoriser
              </Button>
            )}
          </div>

          {/* Switch Activer Notifications */}
          <div className="flex items-center justify-between py-3">
            <div>
              <span className="text-xs font-medium text-foreground">Notifications de bureau</span>
              <p className="text-[11px] text-muted-foreground">
                Afficher une alerte native lors de la réception d&apos;un nouvel email.
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={desktopEnabled && permission === "granted"}
                disabled={permission !== "granted"}
                onChange={(e) => setDesktopEnabled(e.target.checked)}
              />
              <div className="h-5 w-9 rounded-full bg-muted peer-focus:outline-none peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full peer-disabled:opacity-50" />
            </label>
          </div>

          {/* Switch Carillon sonore */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2">
              <Volume2 className="size-4 text-muted-foreground" />
              <div>
                <span className="text-xs font-medium text-foreground">Carillon sonore discret</span>
                <p className="text-[11px] text-muted-foreground">
                  Joue une douce tonalité deux tons (C5-E5) sans chargement de fichier externe.
                </p>
              </div>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={soundEnabled}
                onChange={(e) => setSoundEnabled(e.target.checked)}
              />
              <div className="h-5 w-9 rounded-full bg-muted peer-focus:outline-none peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background after:rounded-full after:h-4 after:w-4 after:transition-all" />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
