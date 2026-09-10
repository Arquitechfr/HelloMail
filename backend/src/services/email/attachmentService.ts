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

    // Wrapper PassThrough : libère le pool quand le stream se termine.
    const passThrough = new PassThrough();
    const releasePool = (): void => imapPool.release(accountId);

    content.on('end', releasePool);
    content.on('error', (err) => {
      releasePool();
      passThrough.destroy(err);
    });
    content.pipe(passThrough);

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
