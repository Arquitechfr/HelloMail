import { describe, it, expect } from 'vitest';
import { mapFetchResultToMessage } from './messageMapper.js';
import type { FetchMessageObject, MessageStructureObject } from 'imapflow';

function makeFetchResult(overrides: Partial<FetchMessageObject> = {}): FetchMessageObject {
  return {
    seq: 1,
    uid: 100,
    envelope: {
      subject: 'Sujet test',
      from: [{ name: 'Alice', address: 'alice@example.com' }],
      to: [{ name: 'Bob', address: 'bob@example.com' }],
      date: new Date('2026-01-15T10:00:00Z'),
      messageId: '<abc@example.com>',
    },
    flags: new Set(['\\Seen']),
    bodyStructure: {
      type: 'text/plain',
      part: '1',
    } as MessageStructureObject,
    size: 1024,
    ...overrides,
  } as FetchMessageObject;
}

describe('mapFetchResultToMessage', () => {
  it('mappe un message nominal', () => {
    const result = mapFetchResultToMessage('acc1', 'INBOX', makeFetchResult());

    expect(result.accountId).toBe('acc1');
    expect(result.folder).toBe('INBOX');
    expect(result.uid).toBe(100);
    expect(result.messageId).toBe('<abc@example.com>');
    expect(result.subject).toBe('Sujet test');
    expect(result.from).toEqual({ name: 'Alice', address: 'alice@example.com' });
    expect(result.to).toEqual([{ name: 'Bob', address: 'bob@example.com' }]);
    expect(result.date).toEqual(new Date('2026-01-15T10:00:00Z'));
    expect(result.flags).toEqual({ seen: true, answered: false, flagged: false });
    expect(result.hasAttachments).toBe(false);
    expect(result.size).toBe(1024);
  });

  it('mappe les flags \Answered et \Flagged', () => {
    const result = mapFetchResultToMessage(
      'acc1',
      'INBOX',
      makeFetchResult({ flags: new Set(['\\Seen', '\\Answered', '\\Flagged']) }),
    );

    expect(result.flags).toEqual({ seen: true, answered: true, flagged: true });
  });

  it('gère un envelope null (valeurs par défaut)', () => {
    const result = mapFetchResultToMessage(
      'acc1',
      'INBOX',
      makeFetchResult({ envelope: undefined }),
    );

    expect(result.subject).toBe('');
    expect(result.from).toEqual({ address: '' });
    expect(result.to).toEqual([]);
    expect(result.date).toEqual(new Date(0));
    expect(result.messageId).toBeUndefined();
  });

  it('gère des flags vides (Set vide)', () => {
    const result = mapFetchResultToMessage(
      'acc1',
      'INBOX',
      makeFetchResult({ flags: new Set() }),
    );

    expect(result.flags).toEqual({ seen: false, answered: false, flagged: false });
  });

  it('gère des flags null', () => {
    const result = mapFetchResultToMessage(
      'acc1',
      'INBOX',
      makeFetchResult({ flags: undefined }),
    );

    expect(result.flags).toEqual({ seen: false, answered: false, flagged: false });
  });

  it('détecte une pièce jointe (disposition attachment)', () => {
    const bodyStructure = {
      type: 'multipart/mixed',
      part: '',
      childNodes: [
        { type: 'text/plain', part: '1' },
        {
          type: 'application/pdf',
          part: '2',
          disposition: 'attachment',
          dispositionParameters: { filename: 'doc.pdf' },
        },
      ],
    } as MessageStructureObject;

    const result = mapFetchResultToMessage(
      'acc1',
      'INBOX',
      makeFetchResult({ bodyStructure }),
    );

    expect(result.hasAttachments).toBe(true);
  });

  it('détecte une PJ imbriquée dans un multipart', () => {
    const bodyStructure = {
      type: 'multipart/mixed',
      part: '',
      childNodes: [
        {
          type: 'multipart/alternative',
          part: '1',
          childNodes: [
            { type: 'text/plain', part: '1.1' },
            { type: 'text/html', part: '1.2' },
          ],
        },
        {
          type: 'image/png',
          part: '2',
          disposition: 'attachment',
          dispositionParameters: { filename: 'logo.png' },
        },
      ],
    } as MessageStructureObject;

    const result = mapFetchResultToMessage(
      'acc1',
      'INBOX',
      makeFetchResult({ bodyStructure }),
    );

    expect(result.hasAttachments).toBe(true);
  });

  it('ne détecte pas de PJ sur un simple text/plain', () => {
    const result = mapFetchResultToMessage(
      'acc1',
      'INBOX',
      makeFetchResult({
        bodyStructure: { type: 'text/plain', part: '1' } as MessageStructureObject,
      }),
    );

    expect(result.hasAttachments).toBe(false);
  });

  it('gère un from sans name', () => {
    const result = mapFetchResultToMessage(
      'acc1',
      'INBOX',
      makeFetchResult({
        envelope: {
          subject: 'Test',
          from: [{ address: 'alice@example.com' }],
          to: [{ address: 'bob@example.com' }],
          date: new Date('2026-01-15T10:00:00Z'),
        },
      }),
    );

    expect(result.from).toEqual({ address: 'alice@example.com' });
    expect(result.from.name).toBeUndefined();
  });

  it('gère un bodyStructure undefined', () => {
    const result = mapFetchResultToMessage(
      'acc1',
      'INBOX',
      makeFetchResult({ bodyStructure: undefined }),
    );

    expect(result.hasAttachments).toBe(false);
  });

  it('gère un size undefined', () => {
    const result = mapFetchResultToMessage(
      'acc1',
      'INBOX',
      makeFetchResult({ size: undefined }),
    );

    expect(result.size).toBe(0);
  });

  it('filtre les destinataires sans adresse', () => {
    const result = mapFetchResultToMessage(
      'acc1',
      'INBOX',
      makeFetchResult({
        envelope: {
          subject: 'Test',
          from: [{ address: 'alice@example.com' }],
          to: [
            { name: 'Bob', address: 'bob@example.com' },
            { name: 'Groupe', address: undefined },
          ],
          date: new Date('2026-01-15T10:00:00Z'),
        },
      }),
    );

    expect(result.to).toHaveLength(1);
    expect(result.to[0]).toEqual({ name: 'Bob', address: 'bob@example.com' });
  });
});
