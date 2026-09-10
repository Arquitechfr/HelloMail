/**
 * Module d'aide pour les notifications de bureau (Web Notifications API)
 * et alertes sonores synthétisées via Web Audio API.
 */

export function isDesktopNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getDesktopNotificationPermission(): NotificationPermission {
  if (!isDesktopNotificationSupported()) return "denied";
  return Notification.permission;
}

export async function requestDesktopNotificationPermission(): Promise<NotificationPermission> {
  if (!isDesktopNotificationSupported()) return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

/**
 * Joue un carillon discret à deux tons (C5 -> E5) avec la Web Audio API.
 * Zéro dépendance audio externe, évite les erreurs 404 et politiques CORS.
 */
export function playNotificationSound(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Note 1: 523.25 Hz (Do / C5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0.06, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);

    // Note 2: 659.25 Hz (Mi / E5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(659.25, now + 0.1);
    gain2.gain.setValueAtTime(0.07, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.4);
  } catch {
    // Silencieux si l'autoplay est restreint par le navigateur
  }
}

interface NotificationOptionsParam {
  title: string;
  body: string;
  icon?: string;
  onClick?: () => void;
}

/**
 * Affiche une notification de bureau native si la permission est accordée.
 */
export function showDesktopNotification({
  title,
  body,
  icon = "/favicon.ico",
  onClick,
}: NotificationOptionsParam): Notification | null {
  if (!isDesktopNotificationSupported()) return null;
  if (Notification.permission !== "granted") return null;

  try {
    const notification = new Notification(title, {
      body,
      icon,
      silent: true, // Le son est géré séparément par Web Audio API
    });

    if (onClick) {
      notification.onclick = () => {
        window.focus();
        onClick();
        notification.close();
      };
    }

    return notification;
  } catch {
    return null;
  }
}
