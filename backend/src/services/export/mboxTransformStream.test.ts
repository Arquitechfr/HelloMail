import { describe, it, expect } from 'vitest';
import { Readable } from 'node:stream';
import {
  formatAsctime,
  formatMboxFromLine,
  MboxTransformStream,
} from './mboxTransformStream.js';

async function streamToString(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

describe('MboxTransformStream (RFC 4155)', () => {
  it('formate une date au format asctime standard', () => {
    const d = new Date('2026-09-12T15:58:26.000Z');
    const str = formatAsctime(d);
    // Ex: "Sat Sep 12 15:58:26 2026"
    expect(str).toMatch(/^[A-Z][a-z]{2} [A-Z][a-z]{2} [ 0-9]{2} \d{2}:\d{2}:\d{2} \d{4}$/);
    expect(str).toContain('2026');
    expect(str).toContain('Sep');
  });

  it('formate la ligne séparatrice From avec adresse et date', () => {
    const d = new Date('2026-09-12T15:58:26.000Z');
    const line = formatMboxFromLine('alice@example.com', d);
    expect(line.startsWith('From alice@example.com ')).toBe(true);
    expect(line.endsWith('\n')).toBe(true);

    const fallback = formatMboxFromLine(undefined, d);
    expect(fallback.startsWith('From MAILER-DAEMON ')).toBe(true);
  });

  it('transforme un message RFC 822 en mbox avec ligne From et saut de ligne final', async () => {
    const rawEmail = 'Subject: Test\nFrom: bob@example.com\n\nHello world!\n';
    const readable = Readable.from([rawEmail]);
    const transform = new MboxTransformStream({
      fromAddress: 'bob@example.com',
      date: new Date('2026-09-12T12:00:00.000Z'),
    });

    const result = await streamToString(readable.pipe(transform));

    expect(result.startsWith('From bob@example.com ')).toBe(true);
    expect(result).toContain('Subject: Test\nFrom: bob@example.com\n\nHello world!\n');
    expect(result.endsWith('\n\n')).toBe(true);
  });

  it('quote les lignes commençant par From et >From selon la spécification mboxrd', async () => {
    const rawEmail = 'Subject: Quoting\n\nFrom start of line\nNormal line\n>From quoted line\n';
    const readable = Readable.from([rawEmail]);
    const transform = new MboxTransformStream({
      fromAddress: 'sender@example.com',
    });

    const result = await streamToString(readable.pipe(transform));

    expect(result).toContain('\n>From start of line\n');
    expect(result).toContain('\n>>From quoted line\n');
    expect(result).toContain('\nNormal line\n');
  });

  it('gère les chunks fragmentés à travers plusieurs blocs de buffer', async () => {
    // Le mot "From " est découpé entre chunk 1 et chunk 2
    const chunk1 = 'Subject: Chunks\n\nFr';
    const chunk2 = 'om the other side\nEnd.\n';
    const readable = Readable.from([chunk1, chunk2]);
    const transform = new MboxTransformStream({
      fromAddress: 'chunk@example.com',
    });

    const result = await streamToString(readable.pipe(transform));

    expect(result).toContain('\n>From the other side\n');
    expect(result).toContain('End.\n');
  });
});
