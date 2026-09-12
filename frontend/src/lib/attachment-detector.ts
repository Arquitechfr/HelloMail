import { htmlToText } from "./compose-utils";

/**
 * Détecteur local d'oubli de pièces jointes (Phase 28).
 * Analyse le texte en français et en anglais avec élimination des citations
 * et des faux positifs courants (négations).
 */

const EXPLICIT_ATTACHMENT_PATTERNS: RegExp[] = [
  // Français
  /\bci[- ]joint(?:e|s|es)?\b/i,
  /\bpi[èe]ces?[- ]joint(?:e|s|es)?\b/i,
  /\ben\s+pj\b/i,
  /\bje\s+(?:vous|te)?\s*joins\b/i,
  /\b(?:veuillez|veiller)\s+trouver\s+(?:ci[- ]joint|en\s+annexe|le\s+document|la\s+pi[èe]ce|le\s+fichier)\b/i,
  /\bvous\s+trouverez\s+(?:ci[- ]joint|en\s+annexe|le\s+document|la\s+pi[èe]ce|le\s+fichier)\b/i,
  /\ben\s+annexe\b/i,

  // Anglais
  /\b(?:please\s+)?find\s+attached\b/i,
  /\b(?:is|are)\s+attached\b/i,
  /\bsee\s+attached\b/i,
  /\battached\s+(?:file|document|invoice|contract|receipt|report)\b/i,
  /\battachment(?:s)?\b/i,
  /\benclosed\b/i,
];

const NEGATION_PATTERNS: RegExp[] = [
  /\bsans\s+(?:pi[èe]ce\s+jointe|pj|fichier|document)\b/i,
  /\bpas\s+de\s+(?:pi[èe]ce\s+jointe|pj|fichier|document)\b/i,
  /\baucune\s+pi[èe]ce\s+jointe\b/i,
  /\bno\s+attachment(?:s)?\b/i,
  /\bwithout\s+attachment(?:s)?\b/i,
];

/**
 * Nettoie le corps d'email en retirant les blocs de citations de messages précédents
 * pour éviter les faux positifs causés par les emails auxquels on répond.
 */
function stripQuotedText(text: string): string {
  const lines = text.split(/\r?\n/);
  const cleanLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Arrêter ou ignorer les lignes de citation
    if (trimmed.startsWith(">")) continue;
    if (/^le\s+.+a\s+[eé]crit\s*:/i.test(trimmed)) break;
    if (/^on\s+.+wrote\s*:/i.test(trimmed)) break;
    if (/^---+\s*(?:original\s+message|message\s+d'origine)\s*---+/i.test(trimmed)) break;
    cleanLines.push(line);
  }

  return cleanLines.join(" ");
}

export function hasAttachmentMention(subject: string, bodyTextOrHtml: string): boolean {
  const rawBodyText = htmlToText(bodyTextOrHtml);
  const cleanBody = stripQuotedText(rawBodyText);
  const fullContent = `${subject} ${cleanBody}`;

  // 1. Vérifier si une négation explicite est présente
  for (const negation of NEGATION_PATTERNS) {
    if (negation.test(fullContent)) {
      return false;
    }
  }

  // 2. Vérifier si l'un des patterns de pièces jointes matche
  for (const pattern of EXPLICIT_ATTACHMENT_PATTERNS) {
    if (pattern.test(fullContent)) {
      return true;
    }
  }

  return false;
}
