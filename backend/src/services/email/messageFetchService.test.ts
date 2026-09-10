import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IAccountDocument } from '../../models/Account.js';
import type { MessageStructureObject } from 'imapflow';

// Mock du pool — retourne un client mocké.
const mockClient = {
  usable: true,
  mailboxOpen: vi.fn().mockResolvedValue({ exists: 1 }),
  fetchOne: vi.fn(),
  download: vi.fn(),
  logout: vi.fn().mockResolvedValue(undefined),
  connect: vi.fn().mockResolvedValue(undefined),
};

vi.mock('./imapPool.js', () => ({
  imapPool: {
    acquire: vi.fn().mockResolvedValue(mockClient),
    release: vi.fn(),
  },
}));

vi.mock('./sanitize.js', () => ({
  sanitizeEmailHtml: vi.fn((html: string) => `<sanitized>${html}</sanitized>`),
}));

const { fetchMessageDetail } = await import('./messageFetchService.js');
const { sanitizeEmailHtml } = await import('./sanitize.js');

function makeAccount(): IAccountDocument {
  return {
    _id: '507f1f77bcf86cd799439011',
    imapConfig: {
      host: 'imap.test.com', port: 993, secure: true,
      smtpHost: 'smtp.test.com', smtpPort: 465, smtpSecure: true,
      username: 'user@test.com',
      encryptedPassword: { iv: 'aa', authTag: 'bb', ciphertext: 'cc' },
    },
  } as unknown as IAccountDocument;
}

function makeBodyStructure(type: string, overrides: Partial<MessageStructureObject> = {}): MessageStructureObject {
  return { type, part: '1', ...overrides } as MessageStructureObject;
}

const multipartAlternative: MessageStructureObject = {
  type: 'multipart/alternative',
  part: '',
  childNodes: [
    { type: 'text/plain', part: '1' },
    { type: 'text/html', part: '2' },
  ],
} as MessageStructureObject;

const multipartMixedWithAttachment: MessageStructureObject = {
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
      type: 'application/pdf',
      part: '2',
      disposition: 'attachment',
      dispositionParameters: { filename: 'doc.pdf' },
      size: 50000,
    },
  ],
} as MessageStructureObject;

describe('fetchMessageDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.mailboxOpen.mockResolvedValue({ exists: 1 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('récupère un message multipart/alternative (text + html)', async () => {
    const headersBuffer = Buffer.from('Subject: Test\r\nFrom: alice@test.com\r\n');
    mockClient.fetchOne.mockResolvedValueOnce({
      uid: 100,
      envelope: {
        subject: 'Test',
        from: [{ name: 'Alice', address: 'alice@test.com' }],
        to: [{ name: 'Bob', address: 'bob@test.com' }],
        date: new Date('2026-01-15T10:00:00Z'),
        messageId: '<abc@test.com>',
      },
      flags: new Set(['\\Seen']),
      bodyStructure: multipartAlternative,
      size: 1024,
      headers: headersBuffer,
    });

    // Mock download pour text/plain (part 1) et text/html (part 2).
    mockClient.download
      .mockResolvedValueOnce({ content: (async function* () { yield Buffer.from('Hello text'); })() })
      .mockResolvedValueOnce({ content: (async function* () { yield Buffer.from('<p>Hello html</p>'); })() });

    const result = await fetchMessageDetail(makeAccount(), 'INBOX', 100);

    expect(result.subject).toBe('Test');
    expect(result.from).toEqual({ name: 'Alice', address: 'alice@test.com' });
    expect(result.text).toBe('Hello text');
    expect(result.html).toBe('<sanitized><p>Hello html</p></sanitized>');
    expect(result.flags).toEqual({ seen: true, answered: false, flagged: false });
    expect(result.headers['subject']).toBe('Test');
    expect(result.headers['from']).toBe('alice@test.com');
    expect(sanitizeEmailHtml).toHaveBeenCalledWith('<p>Hello html</p>');
  });

  it('récupère un message avec pièce jointe', async () => {
    mockClient.fetchOne.mockResolvedValueOnce({
      uid: 200,
      envelope: {
        subject: 'Avec PJ',
        from: [{ address: 'alice@test.com' }],
        to: [{ address: 'bob@test.com' }],
        date: new Date('2026-01-15T10:00:00Z'),
      },
      flags: new Set(),
      bodyStructure: multipartMixedWithAttachment,
      size: 60000,
      headers: Buffer.from(''),
    });

    mockClient.download
      .mockResolvedValueOnce({ content: (async function* () { yield Buffer.from('texte'); })() })
      .mockResolvedValueOnce({ content: (async function* () { yield Buffer.from('<p>html</p>'); })() });

    const result = await fetchMessageDetail(makeAccount(), 'INBOX', 200);

    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0]).toEqual({
      filename: 'doc.pdf',
      contentType: 'application/pdf',
      size: 50000,
      part: '2',
      disposition: 'attachment',
    });
  });

  it('lance 404 si le message est introuvable', async () => {
    mockClient.fetchOne.mockResolvedValueOnce(null);

    await expect(fetchMessageDetail(makeAccount(), 'INBOX', 999)).rejects.toThrow('Message introuvable');
  });

  it('gère un message sans partie text/html (texte uniquement)', async () => {
    const simpleText = makeBodyStructure('text/plain');
    mockClient.fetchOne.mockResolvedValueOnce({
      uid: 300,
      envelope: {
        subject: 'Simple',
        from: [{ address: 'alice@test.com' }],
        to: [{ address: 'bob@test.com' }],
        date: new Date('2026-01-15T10:00:00Z'),
      },
      flags: new Set(),
      bodyStructure: simpleText,
      size: 100,
      headers: Buffer.from(''),
    });

    mockClient.download.mockResolvedValueOnce({
      content: (async function* () { yield Buffer.from('Texte simple'); })(),
    });

    const result = await fetchMessageDetail(makeAccount(), 'INBOX', 300);

    expect(result.text).toBe('Texte simple');
    expect(result.html).toBeUndefined();
    expect(result.attachments).toHaveLength(0);
  });

  it('gère un envelope null (valeurs par défaut)', async () => {
    mockClient.fetchOne.mockResolvedValueOnce({
      uid: 400,
      envelope: undefined,
      flags: undefined,
      bodyStructure: makeBodyStructure('text/plain'),
      size: 0,
      headers: Buffer.from(''),
    });

    mockClient.download.mockResolvedValueOnce({
      content: (async function* () { yield Buffer.from('text'); })(),
    });

    const result = await fetchMessageDetail(makeAccount(), 'INBOX', 400);

    expect(result.subject).toBe('');
    expect(result.from).toEqual({ address: '' });
    expect(result.to).toEqual([]);
    expect(result.date).toEqual(new Date(0));
    expect(result.flags).toEqual({ seen: false, answered: false, flagged: false });
  });

  it('ouvre le dossier en readOnly', async () => {
    mockClient.fetchOne.mockResolvedValueOnce({
      uid: 500,
      envelope: { subject: 'Test', from: [{ address: 'a@b.com' }], to: [], date: new Date() },
      flags: new Set(),
      bodyStructure: makeBodyStructure('text/plain'),
      size: 10,
      headers: Buffer.from(''),
    });

    mockClient.download.mockResolvedValueOnce({
      content: (async function* () { yield Buffer.from('x'); })(),
    });

    await fetchMessageDetail(makeAccount(), 'INBOX', 500);

    expect(mockClient.mailboxOpen).toHaveBeenCalledWith('INBOX', { readOnly: true });
  });

  it('gère les images inline avec contentId', async () => {
    const inlineImage = {
      type: 'image/png',
      part: '2',
      disposition: 'inline',
      id: '<image1@test.com>',
      dispositionParameters: { filename: 'logo.png' },
      size: 5000,
    };
    const multipartRelated: MessageStructureObject = {
      type: 'multipart/related',
      part: '',
      childNodes: [
        { type: 'text/html', part: '1' },
        inlineImage as MessageStructureObject,
      ],
    } as MessageStructureObject;

    mockClient.fetchOne.mockResolvedValueOnce({
      uid: 600,
      envelope: { subject: 'Img', from: [{ address: 'a@b.com' }], to: [], date: new Date() },
      flags: new Set(),
      bodyStructure: multipartRelated,
      size: 10000,
      headers: Buffer.from(''),
    });

    mockClient.download.mockResolvedValueOnce({
      content: (async function* () { yield Buffer.from('<p>html</p>'); })(),
    });

    const result = await fetchMessageDetail(makeAccount(), 'INBOX', 600);

    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0].disposition).toBe('inline');
    expect(result.attachments[0].contentId).toBe('<image1@test.com>');
    expect(result.attachments[0].filename).toBe('logo.png');
  });

  it('gère un bodyStructure avec childNodes imbriqués profondément', async () => {
    const deepNested: MessageStructureObject = {
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
          type: 'multipart/related',
          part: '2',
          childNodes: [
            { type: 'text/html', part: '2.1' },
            {
              type: 'image/jpeg',
              part: '2.2',
              disposition: 'inline',
              id: '<img@test.com>',
              size: 3000,
            },
          ],
        },
        {
          type: 'application/zip',
          part: '3',
          disposition: 'attachment',
          dispositionParameters: { filename: 'archive.zip' },
          size: 100000,
        },
      ],
    } as MessageStructureObject;

    mockClient.fetchOne.mockResolvedValueOnce({
      uid: 700,
      envelope: { subject: 'Deep', from: [{ address: 'a@b.com' }], to: [], date: new Date() },
      flags: new Set(['\\Seen', '\\Flagged']),
      bodyStructure: deepNested,
      size: 200000,
      headers: Buffer.from(''),
    });

    // 3 downloads : text/plain (1.1), text/html (1.2), text/html (2.1)
    mockClient.download
      .mockResolvedValueOnce({ content: (async function* () { yield Buffer.from('text'); })() })
      .mockResolvedValueOnce({ content: (async function* () { yield Buffer.from('<p>html1</p>'); })() })
      .mockResolvedValueOnce({ content: (async function* () { yield Buffer.from('<p>html2</p>'); })() });

    const result = await fetchMessageDetail(makeAccount(), 'INBOX', 700);

    expect(result.attachments).toHaveLength(2);
    expect(result.flags).toEqual({ seen: true, answered: false, flagged: true });
  });
});
