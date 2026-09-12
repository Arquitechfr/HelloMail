export type SecurityVerdict = 'pass' | 'fail' | 'neutral' | 'unknown';

export interface EmailSecuritySummary {
  spf: SecurityVerdict;
  dkim: SecurityVerdict;
  dmarc: SecurityVerdict;
  isTrusted: boolean;
  warningMessage?: string;
  spamScore?: number;
  isSpam?: boolean;
  details?: {
    authResultsRaw?: string;
    spfDetails?: string;
    dkimDetails?: string;
    dmarcDetails?: string;
  };
}

/**
 * Normalise un résultat brut (ex: "pass", "fail", "softfail", "neutral", "none", "temperror")
 * en un verdict synthétique standardisé.
 */
function normalizeVerdict(raw?: string): SecurityVerdict {
  if (!raw) return 'unknown';
  const val = raw.trim().toLowerCase();
  if (val === 'pass') return 'pass';
  if (['fail', 'hardfail', 'permerror', 'reject'].includes(val)) return 'fail';
  if (['softfail', 'neutral', 'none', 'temperror'].includes(val)) return 'neutral';
  return 'unknown';
}

/**
 * Parse les en-têtes Authentication-Results (RFC 8601) pour extraire les verdicts spf, dkim, dmarc.
 */
function parseAuthenticationResults(authHeader: string): {
  spf: SecurityVerdict;
  dkim: SecurityVerdict;
  dmarc: SecurityVerdict;
  spfDetails?: string;
  dkimDetails?: string;
  dmarcDetails?: string;
} {
  let spf: SecurityVerdict = 'unknown';
  let dkim: SecurityVerdict = 'unknown';
  let dmarc: SecurityVerdict = 'unknown';
  let spfDetails: string | undefined;
  let dkimDetails: string | undefined;
  let dmarcDetails: string | undefined;

  // Recherche des motifs spf=result, dkim=result, dmarc=result
  const spfMatch = /\bspf=([a-zA-Z0-9_-]+)(?:\s*\(([^)]*)\))?/i.exec(authHeader);
  if (spfMatch) {
    spf = normalizeVerdict(spfMatch[1]);
    spfDetails = spfMatch[2] ? spfMatch[2].trim() : spfMatch[1];
  }

  const dkimMatch = /\bdkim=([a-zA-Z0-9_-]+)(?:\s*\(([^)]*)\))?/i.exec(authHeader);
  if (dkimMatch) {
    dkim = normalizeVerdict(dkimMatch[1]);
    dkimDetails = dkimMatch[2] ? dkimMatch[2].trim() : dkimMatch[1];
  }

  const dmarcMatch = /\bdmarc=([a-zA-Z0-9_-]+)(?:\s*\(([^)]*)\))?/i.exec(authHeader);
  if (dmarcMatch) {
    dmarc = normalizeVerdict(dmarcMatch[1]);
    dmarcDetails = dmarcMatch[2] ? dmarcMatch[2].trim() : dmarcMatch[1];
  }

  return { spf, dkim, dmarc, spfDetails, dkimDetails, dmarcDetails };
}

/**
 * Parse l'en-tête Received-SPF (RFC 7208) en repli si SPF n'est pas trouvé dans Authentication-Results.
 */
function parseReceivedSpf(receivedSpf: string): { verdict: SecurityVerdict; details?: string } {
  const match = /^([a-zA-Z0-9_-]+)(?:\s*\(([^)]*)\))?/i.exec(receivedSpf.trim());
  if (!match) return { verdict: 'unknown' };
  return {
    verdict: normalizeVerdict(match[1]),
    details: match[2] ? match[2].trim() : match[1],
  };
}

/**
 * Parse les en-têtes anti-spam (X-Spam-Status, X-Spam-Score, X-Spam-Flag).
 */
function parseSpamHeaders(headers: Record<string, string>): { isSpam: boolean; score?: number } {
  let isSpam = false;
  let score: number | undefined;

  const flag = headers['x-spam-flag'];
  if (flag && flag.trim().toUpperCase() === 'YES') {
    isSpam = true;
  }

  const status = headers['x-spam-status'];
  if (status) {
    if (/^\s*yes/i.test(status)) {
      isSpam = true;
    }
    const scoreMatch = /\bscore=([-+]?[0-9]*\.?[0-9]+)/i.exec(status);
    if (scoreMatch) {
      score = parseFloat(scoreMatch[1]);
    }
  }

  if (score === undefined && headers['x-spam-score']) {
    const parsed = parseFloat(headers['x-spam-score']);
    if (!Number.isNaN(parsed)) {
      score = parsed;
      if (score >= 5.0) {
        isSpam = true;
      }
    }
  }

  return { isSpam, score };
}

/**
 * Analyse les en-têtes RFC standards d'un email pour évaluer sa sécurité et authenticité.
 */
export function parseEmailSecurityHeaders(
  headers: Record<string, string>,
  _fromAddress?: string,
): EmailSecuritySummary {
  const authResults = headers['authentication-results'];
  let { spf, dkim, dmarc, spfDetails, dkimDetails, dmarcDetails } = authResults
    ? parseAuthenticationResults(authResults)
    : {
        spf: 'unknown' as SecurityVerdict,
        dkim: 'unknown' as SecurityVerdict,
        dmarc: 'unknown' as SecurityVerdict,
        spfDetails: undefined,
        dkimDetails: undefined,
        dmarcDetails: undefined,
      };

  // Fallback SPF via Received-SPF si non résolu
  if (spf === 'unknown' && headers['received-spf']) {
    const parsedSpf = parseReceivedSpf(headers['received-spf']);
    spf = parsedSpf.verdict;
    if (!spfDetails) spfDetails = parsedSpf.details;
  }

  const { isSpam, score: spamScore } = parseSpamHeaders(headers);

  // Détermination de la confiance (isTrusted)
  // Conforme aux standards : confiance si DMARC valide OU si à la fois DKIM et SPF sont valides
  const isTrusted = (dmarc === 'pass' || (dkim === 'pass' && spf === 'pass')) && !isSpam;

  // Élaboration du message d'avertissement en cas d'anomalie
  let warningMessage: string | undefined;

  if (dmarc === 'fail') {
    warningMessage = "Échec d'authentification DMARC : risque élevé d'usurpation d'identité pour le domaine expéditeur.";
  } else if (dkim === 'fail') {
    warningMessage = "Échec de la signature DKIM : le contenu du message ou les en-têtes ont peut-être été altérés.";
  } else if (spf === 'fail') {
    warningMessage = "Échec du contrôle SPF : le serveur émetteur n'est pas autorisé à expédier au nom de ce domaine.";
  } else if (isSpam) {
    warningMessage = "Ce message a été signalé comme suspect ou indésirable par les filtres anti-spam.";
  }

  return {
    spf,
    dkim,
    dmarc,
    isTrusted,
    warningMessage,
    spamScore,
    isSpam,
    details: {
      authResultsRaw: authResults,
      spfDetails,
      dkimDetails,
      dmarcDetails,
    },
  };
}
