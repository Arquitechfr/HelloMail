import dns from 'node:dns/promises';
import { logger } from '../../config/logger.js';

export interface ServerEndpointConfig {
  host: string;
  port: number;
  secure: boolean;
  usernameRule: 'email' | 'localpart';
}

export interface AutoconfigResult {
  detected: boolean;
  source: 'ispdb' | 'mx' | 'heuristic' | 'none';
  providerSuggestion?: 'google_oauth' | 'microsoft_oauth' | 'imap';
  imap?: ServerEndpointConfig;
  smtp?: ServerEndpointConfig;
}

/**
 * Extrait le contenu d'une balise XML simple via regex sécurisée.
 */
function extractTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([^<]+)<\\/${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Parse un bloc de serveur (incomingServer ou outgoingServer) depuis le XML Mozilla ISPDB.
 */
function parseServerBlock(xml: string, serverTag: string): ServerEndpointConfig | null {
  const blockRegex = new RegExp(`<${serverTag}[^>]*>([\\s\\S]*?)<\\/${serverTag}>`, 'i');
  const match = xml.match(blockRegex);
  if (!match) return null;

  const content = match[1];
  const host = extractTag(content, 'hostname');
  const portStr = extractTag(content, 'port');
  const socketType = extractTag(content, 'socketType');
  const username = extractTag(content, 'username');

  if (!host || !portStr) return null;

  const port = parseInt(portStr, 10);
  if (isNaN(port)) return null;

  const secure = socketType?.toUpperCase() === 'SSL';
  const usernameRule = username?.includes('%EMAILLOCALPART%') ? 'localpart' : 'email';

  return { host, port, secure, usernameRule };
}

/**
 * Interroge l'annuaire open-source Mozilla ISPDB (Thunderbird).
 */
export async function queryMozillaIspdb(domain: string): Promise<AutoconfigResult | null> {
  const url = `https://autoconfig.thunderbird.net/v1.1/${encodeURIComponent(domain)}`;
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(4000),
      headers: { Accept: 'application/xml, text/xml' },
    });

    if (!response.ok) return null;

    const xml = await response.text();
    const imap = parseServerBlock(xml, 'incomingServer');
    const smtp = parseServerBlock(xml, 'outgoingServer');

    if (imap && smtp) {
      return {
        detected: true,
        source: 'ispdb',
        providerSuggestion: 'imap',
        imap,
        smtp,
      };
    }
  } catch (error) {
    logger.debug({ domain, err: error }, 'Échec de la détection Mozilla ISPDB');
  }
  return null;
}

/**
 * Analyse les enregistrements MX d'un domaine pour identifier les fournisseurs connus.
 */
export async function queryDnsMx(domain: string): Promise<AutoconfigResult | null> {
  try {
    const mxRecords = await dns.resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) return null;

    // Trier par priorité croissante
    mxRecords.sort((a, b) => a.priority - b.priority);
    const primaryExchange = mxRecords[0].exchange.toLowerCase();

    // 1. Google Workspace / Gmail
    if (primaryExchange.includes('google.com') || primaryExchange.includes('googlemail.com')) {
      return {
        detected: true,
        source: 'mx',
        providerSuggestion: 'google_oauth',
        imap: { host: 'imap.gmail.com', port: 993, secure: true, usernameRule: 'email' },
        smtp: { host: 'smtp.gmail.com', port: 465, secure: true, usernameRule: 'email' },
      };
    }

    // 2. Microsoft 365 / Outlook
    if (
      primaryExchange.includes('outlook.com') ||
      primaryExchange.includes('office365.com') ||
      primaryExchange.includes('protection.outlook.com')
    ) {
      return {
        detected: true,
        source: 'mx',
        providerSuggestion: 'microsoft_oauth',
        imap: { host: 'outlook.office365.com', port: 993, secure: true, usernameRule: 'email' },
        smtp: { host: 'smtp.office365.com', port: 587, secure: false, usernameRule: 'email' },
      };
    }

    // 3. OVH Telecom
    if (primaryExchange.includes('ovh.net') || primaryExchange.includes('ovh.com')) {
      return {
        detected: true,
        source: 'mx',
        providerSuggestion: 'imap',
        imap: { host: 'ssl0.ovh.net', port: 993, secure: true, usernameRule: 'email' },
        smtp: { host: 'ssl0.ovh.net', port: 465, secure: true, usernameRule: 'email' },
      };
    }

    // 4. Infomaniak
    if (primaryExchange.includes('infomaniak.com') || primaryExchange.includes('infomaniak.ch')) {
      return {
        detected: true,
        source: 'mx',
        providerSuggestion: 'imap',
        imap: { host: 'mail.infomaniak.com', port: 993, secure: true, usernameRule: 'email' },
        smtp: { host: 'mail.infomaniak.com', port: 465, secure: true, usernameRule: 'email' },
      };
    }

    // 5. Gandi
    if (primaryExchange.includes('gandi.net')) {
      return {
        detected: true,
        source: 'mx',
        providerSuggestion: 'imap',
        imap: { host: 'mail.gandi.net', port: 993, secure: true, usernameRule: 'email' },
        smtp: { host: 'mail.gandi.net', port: 465, secure: true, usernameRule: 'email' },
      };
    }
  } catch (error) {
    logger.debug({ domain, err: error }, 'Résolution MX non concluante');
  }
  return null;
}

/**
 * Service principal de détection automatique des configurations email.
 */
export async function detectEmailConfig(email: string): Promise<AutoconfigResult> {
  const parts = email.trim().toLowerCase().split('@');
  if (parts.length !== 2 || !parts[1]) {
    return { detected: false, source: 'none' };
  }

  const domain = parts[1];

  // 1. Tenter Mozilla ISPDB
  const ispdbResult = await queryMozillaIspdb(domain);
  if (ispdbResult) {
    return ispdbResult;
  }

  // 2. Tenter résolution DNS MX
  const mxResult = await queryDnsMx(domain);
  if (mxResult) {
    return mxResult;
  }

  // 3. Fallback heuristique standard
  return {
    detected: false,
    source: 'heuristic',
    providerSuggestion: 'imap',
    imap: {
      host: `imap.${domain}`,
      port: 993,
      secure: true,
      usernameRule: 'email',
    },
    smtp: {
      host: `smtp.${domain}`,
      port: 465,
      secure: true,
      usernameRule: 'email',
    },
  };
}
