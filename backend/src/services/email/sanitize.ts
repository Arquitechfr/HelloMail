import DOMPurify from 'isomorphic-dompurify';

/**
 * Configuration de sanitization pour les corps d'emails HTML.
 *
 * Neutralise <script>, <form>, les event handlers et les URIs dangereuses
 * (javascript:, data:), mais préserve les styles (inline et <style>) et
 * les images (http/https) pour un rendu fidèle des emails.
 *
 * Sécurité :
 * - <script> interdit → pas d'exécution de code.
 * - Event handlers (on*) interdits → pas de déclencheurs.
 * - L'iframe sandbox (allow-same-origin sans allow-scripts) isole le rendu.
 * - DOMPurify neutralise les attaques CSS (expression(), behavior, etc.).
 */
const SANITIZE_CONFIG = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['script', 'form', 'input', 'meta', 'link', 'base', 'object', 'embed'],
  FORBID_ATTR: [
    'onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout',
    'onfocus', 'onblur', 'formaction',
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
