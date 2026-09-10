/**
 * Types et helpers pour la mise en sommeil des emails ("Snooze").
 */

export interface SnoozePreset {
  id: string;
  label: string;
  timeLabel: string;
  getDate: () => Date;
}

/**
 * Calcule les dates suggérées de réveil pour les options prédéfinies.
 */
export function getSnoozePresets(): SnoozePreset[] {
  const now = new Date();

  // 1. Plus tard aujourd'hui (+4h, ou ce soir 18h si on est le matin)
  const laterToday = new Date(now);
  if (now.getHours() < 14) {
    laterToday.setHours(18, 0, 0, 0);
  } else {
    laterToday.setHours(now.getHours() + 4);
  }

  // 2. Demain matin à 09:00
  const tomorrowMorning = new Date(now);
  tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
  tomorrowMorning.setHours(9, 0, 0, 0);

  // 3. Ce week-end (samedi matin 09:00)
  const weekend = new Date(now);
  const dayOfWeek = now.getDay(); // 0 = dimanche, 6 = samedi
  const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7;
  weekend.setDate(weekend.getDate() + daysUntilSaturday);
  weekend.setHours(9, 0, 0, 0);

  // 4. Semaine prochaine (lundi matin 09:00)
  const nextWeek = new Date(now);
  const daysUntilMonday = (1 - dayOfWeek + 7) % 7 || 7;
  nextWeek.setDate(nextWeek.getDate() + daysUntilMonday);
  nextWeek.setHours(9, 0, 0, 0);

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  const formatDate = (d: Date) =>
    d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });

  return [
    {
      id: "later_today",
      label: "Plus tard aujourd'hui",
      timeLabel: `Aujourd'hui, ${formatTime(laterToday)}`,
      getDate: () => laterToday,
    },
    {
      id: "tomorrow",
      label: "Demain matin",
      timeLabel: `${formatDate(tomorrowMorning)}, 09:00`,
      getDate: () => tomorrowMorning,
    },
    {
      id: "weekend",
      label: "Ce week-end",
      timeLabel: `Samedi, 09:00`,
      getDate: () => weekend,
    },
    {
      id: "next_week",
      label: "Semaine prochaine",
      timeLabel: `Lundi, 09:00`,
      getDate: () => nextWeek,
    },
  ];
}
