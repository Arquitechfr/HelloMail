import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Readable } from 'node:stream';
import type { IAccountDocument } from '../../models/Account.js';
import type { MessageStructureObject } from 'imapflow';

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

const { fetchAttachmentStream, fetchRawMessageStream } = await import('./attachmentService.js');

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

const bodyStructureWithAttachment: MessageStructureObject = {
  type: 'multipart/mixed',
  part: '',
  childNodes: [
    { type: 'text/plain', part: '1' },
    {
      type: 'application/pdf',
      part: '2',
      disposition: 'attachment',
      dispositionParameters: { filename: 'doc.pdf' },
      size: 50000,
    },
  ],
} as MessageStructureObject;

describe('fetchAttachmentStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retourne un stream + metadata pour une PJ existante', async () => {
    mockClient.fetchOne.mockResolvedValueOnce({
      uid: 100,
      bodyStructure: bodyStructureWithAttachment,
      size: 60000,
    });

    const attachmentContent = Readable.from([Buffer.from('PDF content')]);
    mockClient.download.mockResolvedValueOnce({ content: attachmentContent });

    const result = await fetchAttachmentStream(makeAccount(), 'INBOX', 100, '2');

    expect(result.contentType).toBe('application/pdf');
    expect(result.filename).toBe('doc.pdf');
    expect(result.size).toBe(50000);

    // Consomme le stream.
    const chunks: Buffer[] = [];
    for await (const chunk of result.stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    expect(Buffer.concat(chunks).toString()).toBe('PDF content');
  });

  it('lance 404 si le message est introuvable', async () => {
    mockClient.fetchOne.mockResolvedValueOnce(null);

    await expect(
      fetchAttachmentStream(makeAccount(), 'INBOX', 999, '2'),
    ).rejects.toThrow('Message introuvable');
  });

  it('lance 404 si la partie n\'existe pas', async () => {
    mockClient.fetchOne.mockResolvedValueOnce({
      uid: 100,
      bodyStructure: bodyStructureWithAttachment,
      size: 60000,
    });

    await expect(
      fetchAttachmentStream(makeAccount(), 'INBOX', 100, '99'),
    ).rejects.toThrow('Pièce jointe introuvable');
  });

  it('ouvre le dossier en readOnly', async () => {
    mockClient.fetchOne.mockResolvedValueOnce({
      uid: 100,
      bodyStructure: bodyStructureWithAttachment,
      size: 60000,
    });

    mockClient.download.mockResolvedValueOnce({
      content: Readable.from([Buffer.from('x')]),
    });

    await fetchAttachmentStream(makeAccount(), 'INBOX', 100, '2');

    expect(mockClient.mailboxOpen).toHaveBeenCalledWith('INBOX', { readOnly: true });
  });
});

describe('fetchRawMessageStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retourne un stream RFC822 et le nom de fichier .eml pour un message valide', async () => {
    mockClient.fetchOne.mockResolvedValueOnce({
      uid: 100,
      envelope: { subject: 'Test Sujet Email' },
      size: 1234,
    });

    const rawContent = Readable.from([Buffer.from('From: a@b.com\r\nSubject: Test Sujet Email\r\n\r\nCorps')]);
    mockClient.download.mockResolvedValueOnce({ content: rawContent });

    const result = await fetchRawMessageStream(makeAccount(), 'INBOX', 100);

    expect(result.contentType).toBe('message/rfc822');
    expect(result.filename).toBe('Test Sujet Email.eml');
    expect(result.size).toBe(1234);

    const chunks: Buffer[] = [];
    for await (const chunk of result.stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    expect(Buffer.concat(chunks).toString()).toContain('Subject: Test Sujet Email');
  });

  it('lance 404 si le message est introuvable', async () => {
    mockClient.fetchOne.mockResolvedValueOnce(null);

    await expect(
      fetchRawMessageStream(makeAccount(), 'INBOX', 999),
    ).rejects.toThrow('Message introuvable');
  });

  it('ouvre le dossier en readOnly pour préserver les flags', async () => {
    mockClient.fetchOne.mockResolvedValueOnce({
      uid: 100,
      envelope: { subject: 'Test' },
      size: 10,
    });
    mockClient.download.mockResolvedValueOnce({
      content: Readable.from([Buffer.from('x')]),
    });

    await fetchRawMessageStream(makeAccount(), 'INBOX', 100);

    expect(mockClient.mailboxOpen).toHaveBeenCalledWith('INBOX', { readOnly: true });
  });
});
