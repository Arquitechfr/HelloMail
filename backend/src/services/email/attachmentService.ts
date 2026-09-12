import { Readable, PassThrough } from 'node:stream';
import type { IAccountDocument } from '../../models/Account.js';
import { AppError } from '../../utils/AppError.js';
import { imapPool } from './imapPool.js';

export interface AttachmentStream {
  stream: Readable;
  contentType: string;
  filename: string;
  size: number;
}

/**
 * Encapsule un stream de lecture IMAP dans un PassThrough sécurisé avec libération idempotente du pool.
 * Gère la fin normale, les erreurs, et les fermetures prématurées (ex: coupure de socket HTTP).
 */
function createSafePassThrough(content: Readable, accountId: string): PassThrough {
  const passThrough = new PassThrough();
  let released = false;

  const safeRelease = (): void => {
    if (!released) {
      released = true;
      imapPool.release(accountId);
    }
  };

  content.once('end', safeRelease);
  content.once('error', (err) => {
    safeRelease();
    passThrough.destroy(err);
  });
  content.once('close', safeRelease);

  passThrough.once('close', () => {
    safeRelease();
    if (!content.destroyed) {
      content.destroy();
    }
  });
  passThrough.once('error', () => {
    safeRelease();
    if (!content.destroyed) {
      content.destroy();
    }
  });

  content.pipe(passThrough);
  return passThrough;
}

/**
 * Télécharge une pièce jointe spécifique d'un message et retourne un stream.
 *
 * Le pool est libéré uniquement quand le stream est entièrement consommé
 * (ou en erreur) — la connexion IMAP reste active pendant le streaming.
 *
 * Ouvre le dossier en lecture seule (readOnly) — ne marque pas \Seen.
 * ImapFlow utilise automatiquement BODY.PEEK dans download.
 */
export async function fetchAttachmentStream(
  account: IAccountDocument,
  folder: string,
  uid: number,
  part: string,
): Promise<AttachmentStream> {
  const accountId = String(account._id);
  const client = await imapPool.acquire(account);

  try {
    await client.mailboxOpen(folder, { readOnly: true });

    // Vérifie que le message existe avant de streamer.
    const msg = await client.fetchOne(uid, { bodyStructure: true, size: true }, { uid: true });

    if (!msg) {
      imapPool.release(accountId);
      throw AppError.notFound('Message introuvable');
    }

    // Recherche la partie demandée dans le bodyStructure.
    const partInfo = findPart(msg.bodyStructure, part);

    if (!partInfo) {
      imapPool.release(accountId);
      throw AppError.notFound('Pièce jointe introuvable');
    }

    const { content } = await client.download(uid, part, { uid: true });
    const passThrough = createSafePassThrough(content, accountId);

    return {
      stream: passThrough,
      contentType: partInfo.type,
      filename: partInfo.dispositionParameters?.filename ?? partInfo.parameters?.name ?? 'sans-nom',
      size: partInfo.size ?? 0,
    };
  } catch (error) {
    // En cas d'erreur avant l'obtention du stream, libérer le pool.
    imapPool.release(accountId);
    throw error;
  }
}

export interface RawMessageStream {
  stream: Readable;
  contentType: string;
  filename: string;
  size: number;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w\s.-]/gi, '_').trim().slice(0, 100) || 'message';
}

/**
 * Télécharge le message MIME brut complet au format RFC 822 (.eml).
 * Ouvre la boîte en lecture seule pour préserver le flag \Seen.
 */
export async function fetchRawMessageStream(
  account: IAccountDocument,
  folder: string,
  uid: number,
): Promise<RawMessageStream> {
  const accountId = String(account._id);
  const client = await imapPool.acquire(account);

  try {
    await client.mailboxOpen(folder, { readOnly: true });

    const msg = await client.fetchOne(uid, { envelope: true, size: true }, { uid: true });

    if (!msg) {
      imapPool.release(accountId);
      throw AppError.notFound('Message introuvable');
    }

    const { content } = await client.download(uid, undefined, { uid: true });
    const passThrough = createSafePassThrough(content, accountId);

    const safeSubject = sanitizeFilename(msg.envelope?.subject || `message-${uid}`);

    return {
      stream: passThrough,
      contentType: 'message/rfc822',
      filename: `${safeSubject}.eml`,
      size: msg.size ?? 0,
    };
  } catch (error) {
    imapPool.release(accountId);
    throw error;
  }
}

/**
 * Recherche récursivement une partie MIME par son numéro de partie.
 */
function findPart(
  node: import('imapflow').MessageStructureObject | undefined,
  part: string,
): import('imapflow').MessageStructureObject | null {
  if (!node) return null;

  if (node.part === part) {
    return node;
  }

  if (node.childNodes) {
    for (const child of node.childNodes) {
      const found = findPart(child, part);
      if (found) return found;
    }
  }

  return null;
}
