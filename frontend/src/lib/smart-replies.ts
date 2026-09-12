import { htmlToText } from "./compose-utils";

/**
 * Moteur heuristique local de suggestions de réponses rapides ("Smart Replies" — Phase 28).
 * 100% exécuté dans le navigateur, respect absolu de la vie privée (zéro appel réseau/cloud).
 */

interface IntentPattern {
  keywords: RegExp;
  replies: string[];
}

const INTENT_PATTERNS: IntentPattern[] = [
  // 1. Remerciements reçus
  {
    keywords: /\b(?:merci(?:\s+beaucoup|\s+infiniment)?|remercie|thanks|thank\s+you)\b/i,
    replies: ["De rien !", "Avec grand plaisir !", "À votre service !"],
  },

  // 2. Demande de validation ou accord
  {
    keywords: /\b(?:valider|validation|d'accord|tu\s+en\s+penses|qu'en\s+penses|confirmez|approuvez|ok\s+pour\s+toi|agree)\b/i,
    replies: ["C'est validé pour moi.", "D'accord, c'est noté !", "Je regarde et je vous confirme."],
  },

  // 3. Proposition de rendez-vous, réunion ou appel
  {
    keywords: /\b(?:r[eé]union|rdv|rendez-vous|call|visio|meeting|cr[eé]neau|disponible|dispo)\b/i,
    replies: ["Disponible, c'est parfait pour moi.", "Je vous recontacte pour convenir d'un créneau.", "Entendu, à bientôt !"],
  },

  // 4. Partage de document / pièce jointe reçue
  {
    keywords: /\b(?:voici|ci[- ]joint|en\s+pj|fichier|document|attestation|facture|attached)\b/i,
    replies: ["Bien reçu, merci !", "Merci pour le document.", "Je regarde ça dès que possible."],
  },

  // 5. Questions ou demandes générales
  {
    keywords: /\?|\b(?:pourriez-vous|pouvez-vous|pourrais-tu|peux-tu|auriez-vous|est-ce\s+que|quand\s+peux)\b/i,
    replies: ["Bien reçu, je m'en occupe.", "Je regarde ça et je reviens vers vous.", "Merci pour l'information."],
  },
];

const DEFAULT_REPLIES = [
  "Bien reçu, merci !",
  "Merci beaucoup !",
  "Excellente journée à vous.",
];

/**
 * Analyse le message d'origine et retourne 3 suggestions de réponses naturelles.
 */
export function generateSmartReplies(subject = "", bodyTextOrHtml = ""): string[] {
  const rawText = htmlToText(bodyTextOrHtml);
  const fullContent = `${subject} ${rawText}`.trim();

  if (!fullContent) {
    return DEFAULT_REPLIES;
  }

  for (const intent of INTENT_PATTERNS) {
    if (intent.keywords.test(fullContent)) {
      return intent.replies;
    }
  }

  return DEFAULT_REPLIES;
}
