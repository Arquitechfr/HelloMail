import { describe, it, expect } from 'vitest';
import { extractInlineImages } from './inlineImageService.js';

describe('inlineImageService', () => {
  it('retourne le HTML inchangé et une liste vide quand aucune image inline n\'est présente', () => {
    const html = '<p>Bonjour,</p><p>Merci pour votre retour.</p>';
    const result = extractInlineImages(html);

    expect(result.cleanHtml).toBe(html);
    expect(result.inlineAttachments).toHaveLength(0);
  });

  it('gère correctement les entrées undefined ou vides', () => {
    expect(extractInlineImages(undefined)).toEqual({ html: undefined, cleanHtml: undefined, inlineAttachments: [] });
    expect(extractInlineImages('')).toEqual({ html: '', cleanHtml: '', inlineAttachments: [] });
  });

  it('extrait une image PNG base64 et la remplace par une référence CID', () => {
    const rawBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const html = `<p>Cordialement,</p><img src="data:image/png;base64,${rawBase64}" alt="Logo" style="max-height: 48px;" />`;

    const result = extractInlineImages(html);

    expect(result.inlineAttachments).toHaveLength(1);
    const attachment = result.inlineAttachments[0];

    expect(attachment.contentType).toBe('image/png');
    expect(attachment.filename).toBe('signature-logo-1.png');
    expect(attachment.content).toBe(rawBase64);
    expect(attachment.cid).toMatch(/^sig-img-\d+-1-[a-z0-9]+@hellomail$/);

    expect(result.cleanHtml).toContain(`src="cid:${attachment.cid}"`);
    expect(result.cleanHtml).toContain('alt="Logo"');
    expect(result.cleanHtml).toContain('style="max-height: 48px;"');
  });

  it('extrait plusieurs images inline avec différents types MIME (PNG, JPEG, WebP)', () => {
    const b64Png = 'iVBORw0KGgo=';
    const b64Jpg = '/9j/4AAQSkZJRg==';
    const b64Webp = 'UklGRh4AAABXRUJQVlA4';

    const html = `
      <div>
        <img src="data:image/png;base64,${b64Png}" alt="Logo" />
        <img src="data:image/jpeg;base64,${b64Jpg}" alt="Photo" />
        <img src="data:image/webp;base64,${b64Webp}" alt="Banniere" />
      </div>
    `;

    const result = extractInlineImages(html);

    expect(result.inlineAttachments).toHaveLength(3);
    expect(result.inlineAttachments[0].contentType).toBe('image/png');
    expect(result.inlineAttachments[0].filename).toBe('signature-logo-1.png');

    expect(result.inlineAttachments[1].contentType).toBe('image/jpeg');
    expect(result.inlineAttachments[1].filename).toBe('signature-logo-2.jpg');

    expect(result.inlineAttachments[2].contentType).toBe('image/webp');
    expect(result.inlineAttachments[2].filename).toBe('signature-logo-3.webp');

    expect(result.cleanHtml).not.toContain('data:image/');
    expect(result.cleanHtml).toContain(`src="cid:${result.inlineAttachments[0].cid}"`);
    expect(result.cleanHtml).toContain(`src="cid:${result.inlineAttachments[1].cid}"`);
    expect(result.cleanHtml).toContain(`src="cid:${result.inlineAttachments[2].cid}"`);
  });

  it('nettoie les sauts de ligne et espaces dans le base64', () => {
    const dirtyBase64 = 'iVBOR\n  w0KGgo=\r\n';
    const html = `<img src="data:image/png;base64,${dirtyBase64}" />`;

    const result = extractInlineImages(html);
    expect(result.inlineAttachments[0].content).toBe('iVBORw0KGgo=');
  });
});
