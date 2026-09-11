import { describe, it, expect } from 'vitest';
import { parseICalendar, parseIcsDate } from './calendarService.js';

describe('calendarService', () => {
  describe('parseIcsDate', () => {
    it('parse une date UTC avec Z', () => {
      const iso = parseIcsDate('20261012T143000Z');
      expect(iso).toBe(new Date(Date.UTC(2026, 9, 12, 14, 30, 0)).toISOString());
    });

    it('parse une date sans heure (DATE seule)', () => {
      const iso = parseIcsDate('20261012');
      expect(iso).toBe(new Date(Date.UTC(2026, 9, 12)).toISOString());
    });

    it('retourne undefined pour un format invalide', () => {
      expect(parseIcsDate('invalid-date')).toBeUndefined();
    });
  });

  describe('parseICalendar', () => {
    it('retourne null si le contenu ne contient pas BEGIN:VCALENDAR', () => {
      expect(parseICalendar('Ceci est un simple texte')).toBeNull();
    });

    it('parse une invitation VCALENDAR complète avec pliage et caractères échappés', () => {
      const ics = [
        'BEGIN:VCALENDAR',
        'PRODID:-//Google Inc//Google Calendar 70.9054//EN',
        'VERSION:2.0',
        'METHOD:REQUEST',
        'BEGIN:VEVENT',
        'DTSTART:20261012T090000Z',
        'DTEND:20261012T100000Z',
        'DTSTAMP:20261001T080000Z',
        'ORGANIZER;CN="Alice Dupont":mailto:alice@example.com',
        'UID:meet-12345@google.com',
        'ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN="Bob Martin":mailto:bob@example.com',
        'SUMMARY:Réunion de lancement\, projet HelloMail',
        'DESCRIPTION:Première réunion de cadrage.\\nOrdre du jour: architecture et liv',
        ' rables.',
        'LOCATION:Salle de réunion A\, Étage 2',
        'STATUS:CONFIRMED',
        'SEQUENCE:1',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');

      const event = parseICalendar(ics);
      expect(event).not.toBeNull();
      expect(event?.summary).toBe('Réunion de lancement, projet HelloMail');
      expect(event?.method).toBe('REQUEST');
      expect(event?.location).toBe('Salle de réunion A, Étage 2');
      expect(event?.status).toBe('CONFIRMED');
      expect(event?.uid).toBe('meet-12345@google.com');
      expect(event?.sequence).toBe(1);
      expect(event?.description).toContain('architecture et livrables.');
      expect(event?.organizer).toEqual({
        name: 'Alice Dupont',
        email: 'alice@example.com',
      });
      expect(event?.attendees).toHaveLength(1);
      expect(event?.attendees?.[0]).toEqual({
        name: 'Bob Martin',
        email: 'bob@example.com',
        role: 'REQ-PARTICIPANT',
        status: 'ACCEPTED',
      });
      expect(event?.dtStart).toBe(new Date(Date.UTC(2026, 9, 12, 9, 0, 0)).toISOString());
      expect(event?.dtEnd).toBe(new Date(Date.UTC(2026, 9, 12, 10, 0, 0)).toISOString());
    });

    it('parse une annulation d’événement METHOD:CANCEL', () => {
      const ics = [
        'BEGIN:VCALENDAR',
        'METHOD:CANCEL',
        'BEGIN:VEVENT',
        'UID:meet-cancelled@example.com',
        'SUMMARY:Session annulée',
        'STATUS:CANCELLED',
        'DTSTART:20261101T140000Z',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\n');

      const event = parseICalendar(ics);
      expect(event).not.toBeNull();
      expect(event?.method).toBe('CANCEL');
      expect(event?.status).toBe('CANCELLED');
      expect(event?.summary).toBe('Session annulée');
    });
  });
});
