export interface InlineAttachment {
  filename: string;
  content: string; // base64
  contentType: string;
  cid: string;
}

export interface ExtractInlineImagesResult {
  html?: string;
  cleanHtml?: string;
  inlineAttachments: InlineAttachment[];
}

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

const DATA_URI_IMAGE_REGEX =
  /<img\s+([^>]*?)src=["']data:(image\/[a-zA-Z0-9.+_-]+);base64,([A-Za-z0-9+/=\s]+)["']([^>]*?)>/gi;

/**
 * Extrait les images encodées en base64 (Data URI) d'un contenu HTML
 * et les remplace par des références Content-ID (cid:...).
 *
 * Cela permet à Nodemailer et MailComposer d'encapsuler ces images dans
 * la section multipart/related de l'email MIME, garantissant qu'elles
 * s'affichent inline dans la signature/le message sans apparaître comme
 * pièces jointes détachées chez le destinataire.
 */
export function extractInlineImages(html?: string): ExtractInlineImagesResult {
  if (!html || typeof html !== 'string') {
    return { html, cleanHtml: html, inlineAttachments: [] };
  }

  const inlineAttachments: InlineAttachment[] = [];
  let imageCounter = 0;

  const cleanHtml = html.replace(
    DATA_URI_IMAGE_REGEX,
    (_fullMatch, beforeAttrs: string, mimeType: string, base64Data: string, afterAttrs: string) => {
      imageCounter++;
      const cleanedBase64 = base64Data.replace(/\s+/g, '');
      const mime = mimeType.toLowerCase();
      const ext = MIME_TO_EXT[mime] || 'png';
      const cid = `sig-img-${Date.now()}-${imageCounter}-${Math.random().toString(36).slice(2, 7)}@hellomail`;
      const filename = `signature-logo-${imageCounter}.${ext}`;

      inlineAttachments.push({
        filename,
        content: cleanedBase64,
        contentType: mime,
        cid,
      });

      return `<img ${beforeAttrs}src="cid:${cid}"${afterAttrs}>`;
    },
  );

  return {
    html: cleanHtml,
    cleanHtml,
    inlineAttachments,
  };
}
