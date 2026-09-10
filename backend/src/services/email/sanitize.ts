import DOMPurify from 'isomorphic-dompurify';

/**
 * Configuration de sanitization pour les corps d'emails HTML.
 *
 * Restrictive : neutralise <script>, <style>, <form>, les event handlers,
 * les URIs javascript:/data:, et n'autorise que les schémas sûrs
 * (https, mailto, tel, cid pour les images inline, ancres #).
 */
const SANITIZE_CONFIG = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['script', 'style', 'form', 'input', 'meta', 'link', 'base', 'object', 'embed'],
  FORBID_ATTR: [
    'onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout',
    'onfocus', 'onblur', 'style', 'srcset', 'formaction',
  ],
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|cid:|#)/i,
};

/**
 * Sanitize un corps d'email HTML pour neutraliser les XSS.
 * Utilise DOMPurify (isomorphic-dompurify) qui fonctionne côté serveur via jsdom.
 */
export function sanitizeEmailHtml(html: string): string {
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}
