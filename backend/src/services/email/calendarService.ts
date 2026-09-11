/**
 * Service de parsing d'invitations et événements iCalendar (RFC 5545).
 * Décode les objets VCALENDAR / VEVENT (text/calendar et fichiers .ics).
 */

export interface CalendarAttendee {
  name?: string;
  email: string;
  role?: string;
  status?: string;
}

export interface CalendarEventInfo {
  uid?: string;
  method?: string; // REQUEST, REPLY, CANCEL, PUBLISH
  summary: string;
  description?: string;
  location?: string;
  dtStart?: string; // Date ISO 8601
  dtEnd?: string;   // Date ISO 8601
  organizer?: { name?: string; email: string };
  status?: string;  // CONFIRMED, TENTATIVE, CANCELLED
  attendees?: CalendarAttendee[];
  sequence?: number;
  rawIcs?: string;
}

/**
 * Dé-échappe les séquences textuelles iCalendar selon RFC 5545 §3.3.11.
 */
function unescapeIcs(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

/**
 * Parse une chaîne de date iCalendar (ex: 20261012T140000Z, 20261012T140000, 20261012)
 * et la convertit en chaîne ISO 8601.
 */
export function parseIcsDate(rawDate: string): string | undefined {
  const cleaned = rawDate.trim();
  const match = cleaned.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!match) return undefined;

  const [, year, month, day, hours, minutes, seconds, isUtc] = match;
  const y = parseInt(year, 10);
  const m = parseInt(month, 10) - 1;
  const d = parseInt(day, 10);

  if (hours !== undefined && minutes !== undefined && seconds !== undefined) {
    const hh = parseInt(hours, 10);
    const mm = parseInt(minutes, 10);
    const ss = parseInt(seconds, 10);
    const date = isUtc
      ? new Date(Date.UTC(y, m, d, hh, mm, ss))
      : new Date(y, m, d, hh, mm, ss);
    return isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  const date = new Date(Date.UTC(y, m, d));
  return isNaN(date.getTime()) ? undefined : date.toISOString();
}

/**
 * Découpe une ligne d'attribut iCalendar en nom, paramètres et valeur.
 */
function parsePropertyLine(line: string): { name: string; params: Record<string, string>; value: string } | null {
  const colonIdx = line.indexOf(':');
  if (colonIdx <= 0) return null;

  const leftPart = line.substring(0, colonIdx);
  const value = line.substring(colonIdx + 1);

  const parts = leftPart.split(';');
  const name = (parts[0] ?? '').trim().toUpperCase();
  const params: Record<string, string> = {};

  for (let i = 1; i < parts.length; i++) {
    const param = parts[i];
    if (!param) continue;
    const eqIdx = param.indexOf('=');
    if (eqIdx > 0) {
      const pKey = param.substring(0, eqIdx).trim().toUpperCase();
      let pVal = param.substring(eqIdx + 1).trim();
      if (pVal.startsWith('"') && pVal.endsWith('"')) {
        pVal = pVal.slice(1, -1);
      }
      params[pKey] = pVal;
    }
  }

  return { name, params, value };
}

/**
 * Parse un contenu brut iCalendar (RFC 5545).
 */
export function parseICalendar(icsContent: string): CalendarEventInfo | null {
  if (!icsContent || !icsContent.includes('BEGIN:VCALENDAR')) {
    return null;
  }

  // Déplie les lignes longues (RFC 5545 §3.1)
  const unfolded = icsContent.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  let inEvent = false;
  let method: string | undefined;
  let summary = '';
  let description: string | undefined;
  let location: string | undefined;
  let dtStart: string | undefined;
  let dtEnd: string | undefined;
  let organizer: { name?: string; email: string } | undefined;
  let status: string | undefined;
  let uid: string | undefined;
  let sequence: number | undefined;
  const attendees: CalendarAttendee[] = [];

  for (const line of lines) {
    if (line.startsWith('METHOD:')) {
      method = line.substring(7).trim().toUpperCase();
      continue;
    }

    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      continue;
    }

    if (line === 'END:VEVENT') {
      inEvent = false;
      break; // Traite le premier événement principal
    }

    if (!inEvent) continue;

    const parsed = parsePropertyLine(line);
    if (!parsed) continue;

    const { name, params, value } = parsed;

    switch (name) {
      case 'SUMMARY':
        summary = unescapeIcs(value);
        break;
      case 'DESCRIPTION':
        description = unescapeIcs(value);
        break;
      case 'LOCATION':
        location = unescapeIcs(value);
        break;
      case 'UID':
        uid = value.trim();
        break;
      case 'STATUS':
        status = value.trim().toUpperCase();
        break;
      case 'SEQUENCE':
        sequence = parseInt(value.trim(), 10) || 0;
        break;
      case 'DTSTART':
        dtStart = parseIcsDate(value);
        break;
      case 'DTEND':
        dtEnd = parseIcsDate(value);
        break;
      case 'ORGANIZER': {
        const email = value.replace(/^mailto:/i, '').trim();
        organizer = {
          email,
          ...(params.CN !== undefined && { name: params.CN }),
        };
        break;
      }
      case 'ATTENDEE': {
        const email = value.replace(/^mailto:/i, '').trim();
        attendees.push({
          email,
          ...(params.CN !== undefined && { name: params.CN }),
          ...(params.ROLE !== undefined && { role: params.ROLE }),
          ...(params.PARTSTAT !== undefined && { status: params.PARTSTAT }),
        });
        break;
      }
    }
  }

  if (!summary && !uid && !dtStart) {
    return null;
  }

  return {
    uid,
    method,
    summary: summary || 'Événement sans titre',
    ...(description && { description }),
    ...(location && { location }),
    ...(dtStart && { dtStart }),
    ...(dtEnd && { dtEnd }),
    ...(organizer && { organizer }),
    ...(status && { status }),
    ...(attendees.length > 0 && { attendees }),
    ...(sequence !== undefined && { sequence }),
    rawIcs: icsContent,
  };
}
