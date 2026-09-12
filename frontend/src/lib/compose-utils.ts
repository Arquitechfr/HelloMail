/**
 * Utilitaires pour la rédaction d'emails (conversion texte brut, signatures).
 */

/** Convertit du HTML en texte brut (pour le champ `text` de l'email). */
export function htmlToText(html: string): string {
  if (typeof document === "undefined") return html.replace(/<[^>]*>/g, "");
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

/** Formate une signature textuelle en blocs HTML de paragraphe. */
export function formatSignatureHtml(sigText: string): string {
  const trimmed = sigText.trim();
  const prefix = trimmed.startsWith("--") ? "" : "<p>-- </p>";
  const linesHtml = sigText
    .split("\n")
    .map((l) => `<p>${l.trim() ? l : "<br>"}</p>`)
    .join("");
  return `<p><br></p>${prefix}${linesHtml}`;
}

/** Enrobe une signature HTML dans un conteneur identifiable. */
export function wrapSignatureContainer(html: string): string {
  return `<div data-signature="true" class="mailora-signature">${html}</div>`;
}

/**
 * Remplace une signature existante identifiée par data-signature="true",
 * ou l'ajoute à la fin du corps de texte si aucune n'est présente.
 */
export function replaceOrAppendSignature(body: string, newSignatureHtml?: string): string {
  const sigRegex = /<div data-signature="true"[^>]*>[\s\S]*?<\/div>/i;
  const wrapped = newSignatureHtml ? wrapSignatureContainer(newSignatureHtml) : "";

  if (sigRegex.test(body)) {
    return body.replace(sigRegex, wrapped);
  }

  if (!wrapped) return body;
  return body && body !== "<p></p>" ? `${body}${wrapped}` : `<p></p>${wrapped}`;
}
