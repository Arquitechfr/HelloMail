import { describe, it, expect } from 'vitest';
import { escapeRegExp } from './regex.js';

describe('escapeRegExp', () => {
  it('laisse inchangée une chaîne alphanumérique simple', () => {
    expect(escapeRegExp('mailora')).toBe('mailora');
    expect(escapeRegExp('user123')).toBe('user123');
  });

  it('échappe tous les métacaractères d\'expressions régulières', () => {
    const chars = '.*+?^${}()|[]\\';
    const escaped = escapeRegExp(chars);
    expect(escaped).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
  });

  it('échappe correctement les adresses email avec alias (+)', () => {
    expect(escapeRegExp('support+dev@societe.com')).toBe('support\\+dev@societe\\.com');
  });

  it('échappe correctement les sujets avec crochets ou parenthèses', () => {
    expect(escapeRegExp('[CRITIQUE] (urgent) Problème')).toBe('\\[CRITIQUE\\] \\(urgent\\) Problème');
  });

  it('permet de construire une RegExp valide même avec des caractères pernicieux', () => {
    const maliciousInput = '(?=a)b+c*d?{1,2}[a-z]';
    const escaped = escapeRegExp(maliciousInput);
    expect(() => new RegExp(escaped, 'i')).not.toThrow();
    const regex = new RegExp(escaped, 'i');
    expect(regex.test(maliciousInput)).toBe(true);
    expect(regex.test('abc')).toBe(false);
  });
});
