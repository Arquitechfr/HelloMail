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
