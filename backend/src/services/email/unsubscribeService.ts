import type { IAccountDocument } from '../../models/Account.js';
import { AppError } from '../../utils/AppError.js';
import { logger } from '../../config/logger.js';
import { sendEmail } from './sendService.js';
import { fetchMessageDetail } from './messageFetchService.js';

export interface UnsubscribeInfo {
  httpUrl?: string;
  mailto?: string;
  isOneClick: boolean;
}

export interface UnsubscribeResult {
  success: boolean;
  action: 'one_click' | 'mailto' | 'open_url';
  url?: string;
  details: string;
}

/**
 * Analyse les en-têtes List-Unsubscribe et List-Unsubscribe-Post
 * conformément aux RFC 2369 et RFC 8058.
 */
export function parseUnsubscribeHeaders(headers: Record<string, string>): UnsubscribeInfo | undefined {
  const rawListUnsubscribe = headers['list-unsubscribe'];
  if (!rawListUnsubscribe) {
    return undefined;
  }

  const rawPost = headers['list-unsubscribe-post'];
  const hasOneClickPost = Boolean(
    rawPost && rawPost.toLowerCase().includes('list-unsubscribe=one-click'),
  );

  let httpUrl: string | undefined;
  let mailto: string | undefined;

  const matches = rawListUnsubscribe.matchAll(/<([^>]+)>/g);
  for (const match of matches) {
    const uri = match[1].trim();
    if (/^https?:\/\//i.test(uri)) {
      if (!httpUrl) httpUrl = uri;
    } else if (/^mailto:/i.test(uri)) {
      if (!mailto) mailto = uri;
    }
  }

  if (!httpUrl && !mailto) {
    return undefined;
  }

  return {
    httpUrl,
    mailto,
    isOneClick: Boolean(hasOneClickPost && httpUrl),
  };
}

/**
 * Extrait l'adresse email et le sujet d'une URL mailto:
 */
export function parseMailtoUri(mailtoUri: string): { to: string; subject?: string } {
  const withoutPrefix = mailtoUri.replace(/^mailto:/i, '');
  const [addressPart, queryPart] = withoutPrefix.split('?');
  const to = decodeURIComponent(addressPart.trim());

  let subject: string | undefined;
  if (queryPart) {
    const params = new URLSearchParams(queryPart);
    const rawSubject = params.get('subject');
    if (rawSubject) {
      subject = rawSubject;
    }
  }

  return { to, subject };
}

/**
 * Exécute l'action de désabonnement pour un message donné.
 */
export async function executeUnsubscribe(
  account: IAccountDocument,
  folder: string,
  uid: number,
): Promise<UnsubscribeResult> {
  const detail = await fetchMessageDetail(account, folder, uid);
  const info = parseUnsubscribeHeaders(detail.headers);

  if (!info) {
    throw AppError.badRequest("Ce message ne contient pas d'en-tête de désabonnement valide (RFC 2369)");
  }

  // 1. One-Click POST RFC 8058
  if (info.isOneClick && info.httpUrl) {
    try {
      const res = await fetch(info.httpUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'List-Unsubscribe=One-Click',
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        logger.warn(
          { status: res.status, url: info.httpUrl },
          'La requête One-Click de désabonnement a retourné un code non-2xx',
        );
        return {
          success: true,
          action: 'open_url',
          url: info.httpUrl,
          details: "Échec de la désinscription directe, redirection vers le lien d'origine",
        };
      }

      return {
        success: true,
        action: 'one_click',
        details: 'Désabonnement en 1 clic effectué avec succès',
      };
    } catch (err) {
      logger.error({ err, url: info.httpUrl }, 'Erreur lors de la requête POST One-Click');
      return {
        success: true,
        action: 'open_url',
        url: info.httpUrl,
        details: "Erreur réseau lors de la désinscription automatique, lien ouvert pour confirmation",
      };
    }
  }

  // 2. Mailto automatique
  if (info.mailto) {
    const { to, subject } = parseMailtoUri(info.mailto);
    if (!to) {
      throw AppError.badRequest('Adresse mailto de désabonnement invalide');
    }

    try {
      await sendEmail(account, {
        to: [to],
        subject: subject ?? 'Unsubscribe',
        text: 'Unsubscribe request sent automatically by Mailora client.',
      });

      return {
        success: true,
        action: 'mailto',
        details: 'Demande de désabonnement transmise par email avec succès',
      };
    } catch (err) {
      logger.error({ err, to }, "Erreur lors de l'envoi de l'email de désabonnement");
      throw new AppError(500, "Impossible d'envoyer l'email de désabonnement");
    }
  }

  // 3. Simple URL HTTP(S) sans One-Click POST
  if (info.httpUrl) {
    return {
      success: true,
      action: 'open_url',
      url: info.httpUrl,
      details: 'Lien de désabonnement externe à ouvrir dans le navigateur',
    };
  }

  throw AppError.badRequest('Aucune méthode de désabonnement exploitable trouvée');
}
