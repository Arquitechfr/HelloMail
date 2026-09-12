import { Transform, type TransformCallback } from 'node:stream';

/**
 * Formate une date en chaîne asctime standard (RFC 4155 / ANSI C asctime).
 * Exemple : "Sat Sep 12 15:58:26 2026"
 */
export function formatAsctime(date?: Date): string {
  const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`);
  const padSpace = (n: number): string => (n < 10 ? ` ${n}` : `${n}`);

  return `${days[d.getUTCDay()]} ${months[d.getUTCMonth()]} ${padSpace(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())} ${d.getUTCFullYear()}`;
}

/**
 * Formate la ligne d'en-tête séparatrice MBOX (RFC 4155).
 * Doit commencer par "From " (sans deux-points) suivi de l'adresse et de la date asctime.
 */
export function formatMboxFromLine(fromAddress?: string, date?: Date): string {
  const sender = fromAddress?.trim() || 'MAILER-DAEMON';
  return `From ${sender} ${formatAsctime(date)}\n`;
}

export interface MboxTransformOptions {
  fromAddress?: string;
  date?: Date;
}

/**
 * Transformateur de flux pour convertir un message MIME RFC 822 en format MBOX (mboxrd).
 * - Écrit l'en-tête "From <sender> <asctime>\n" au début du flux.
 * - Quote les lignes commençant par "From " ou ">*From " avec un chevron supplémentaire ">" (RFC 4155 mboxrd).
 * - Ajoute un saut de ligne vide final ("\n\n") pour isoler le message du suivant.
 */
export class MboxTransformStream extends Transform {
  private headerWritten = false;
  private readonly headerLine: string;
  private lineRemainder = '';

  constructor(options: MboxTransformOptions = {}) {
    super();
    this.headerLine = formatMboxFromLine(options.fromAddress, options.date);
  }

  override _transform(chunk: Buffer | string, encoding: BufferEncoding, callback: TransformCallback): void {
    let text = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');

    // Écrire la ligne From séparatrice avant les en-têtes du premier chunk
    if (!this.headerWritten) {
      this.push(this.headerLine, 'utf-8');
      this.headerWritten = true;
    }

    // Concaténer avec le reliquat de ligne précédent
    text = this.lineRemainder + text;
    const lastNewlineIdx = text.lastIndexOf('\n');

    if (lastNewlineIdx === -1) {
      // Pas de saut de ligne complet encore reçu, conserver dans le tampon
      this.lineRemainder = text;
      callback();
      return;
    }

    const processable = text.slice(0, lastNewlineIdx + 1);
    this.lineRemainder = text.slice(lastNewlineIdx + 1);

    // Appliquer le quoting mboxrd : préfixer d'un '>' toute ligne commençant par '>...From ' ou 'From '
    // Regex : début de ligne suivi de 0 ou plusieurs '>' puis 'From '
    const quoted = processable.replace(/(^|\n)(>*From )/g, '$1>$2');
    this.push(quoted, 'utf-8');
    callback();
  }

  override _flush(callback: TransformCallback): void {
    // Si premier chunk jamais reçu, écrire tout de même l'en-tête
    if (!this.headerWritten) {
      this.push(this.headerLine, 'utf-8');
      this.headerWritten = true;
    }

    if (this.lineRemainder.length > 0) {
      const quotedRemainder = this.lineRemainder.replace(/(^|\n)(>*From )/g, '$1>$2');
      this.push(quotedRemainder, 'utf-8');
      this.lineRemainder = '';
    }

    // Le standard MBOX requiert un saut de ligne final pour séparer du message suivant
    this.push('\n\n', 'utf-8');
    callback();
  }
}
