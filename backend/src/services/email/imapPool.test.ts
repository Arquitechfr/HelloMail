import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IAccountDocument } from '../../models/Account.js';

// Mock de ImapFlow — on simule connect/logout/usable/mailboxOpen.
const mockClient = {
  usable: true,
  connect: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn().mockResolvedValue(undefined),
  mailboxOpen: vi.fn().mockResolvedValue({ exists: 0 }),
  fetchOne: vi.fn(),
  download: vi.fn(),
};

vi.mock('imapflow', () => ({
  ImapFlow: vi.fn().mockImplementation(function () {
    return mockClient;
  }),
}));

// Mock de encryptionService.decrypt pour éviter d'avoir besoin d'une vraie clé.
vi.mock('../security/encryptionService.js', () => ({
  decrypt: vi.fn().mockReturnValue('fake-password'),
}));

// Mock de oauthService.getImapAuth — les tests existants utilisent des comptes IMAP.
vi.mock('../auth/oauthService.js', () => ({
  getImapAuth: vi.fn().mockResolvedValue({ user: 'user@test.com', pass: 'fake-password' }),
}));

// Import après les mocks.
const { imapPool } = await import('./imapPool.js');

function makeAccount(id = '507f1f77bcf86cd799439011'): IAccountDocument {
  return {
    _id: id,
    imapConfig: {
      host: 'imap.test.com',
      port: 993,
      secure: true,
      smtpHost: 'smtp.test.com',
      smtpPort: 465,
      smtpSecure: true,
      username: 'user@test.com',
      encryptedPassword: { iv: 'aa', authTag: 'bb', ciphertext: 'cc' },
    },
  } as unknown as IAccountDocument;
}

describe('imapPool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.usable = true;
  });

  afterEach(async () => {
    await imapPool.closeAll();
  });

  it('acquire crée une connexion et appelle connect', async () => {
    const account = makeAccount();
    const client = await imapPool.acquire(account);

    expect(mockClient.connect).toHaveBeenCalledTimes(1);
    expect(client).toBe(mockClient);
  });

  it('acquire réutilise une connexion existante et utilisable', async () => {
    const account = makeAccount();
    const client1 = await imapPool.acquire(account);
    imapPool.release(String(account._id));
    const client2 = await imapPool.acquire(account);

    expect(mockClient.connect).toHaveBeenCalledTimes(1);
    expect(client2).toBe(client1);
  });

  it('release ne ferme pas la connexion', async () => {
    const account = makeAccount();
    await imapPool.acquire(account);
    imapPool.release(String(account._id));

    expect(mockClient.logout).not.toHaveBeenCalled();
  });

  it('recrée une connexion si l\'existante est morte (usable=false)', async () => {
    const account = makeAccount();
    await imapPool.acquire(account);
    imapPool.release(String(account._id));

    // Simule une connexion morte.
    mockClient.usable = false;
    mockClient.connect.mockClear();

    await imapPool.acquire(account);

    expect(mockClient.connect).toHaveBeenCalledTimes(1);
  });

  it('closeAll ferme toutes les connexions', async () => {
    const account = makeAccount();
    await imapPool.acquire(account);
    imapPool.release(String(account._id));

    await imapPool.closeAll();

    expect(mockClient.logout).toHaveBeenCalled();
  });

  it('lance une AppError si la connexion IMAP échoue', async () => {
    const account = makeAccount();
    mockClient.connect.mockRejectedValueOnce(new Error('Auth failed'));

    await expect(imapPool.acquire(account)).rejects.toThrow('Connexion IMAP échouée');
  });

  it('lance une AppError si imapConfig est manquant', async () => {
    const account = { _id: '507f1f77bcf86cd799439012' } as unknown as IAccountDocument;

    await expect(imapPool.acquire(account)).rejects.toThrow('Configuration IMAP manquante');
  });

  it('attend l\'initialisation en cours (verrou) si acquire est appelé en parallèle', async () => {
    const account = makeAccount();

    // Lance deux acquire en parallèle — le second doit attendre le premier.
    const [client1, client2] = await Promise.all([
      imapPool.acquire(account),
      imapPool.acquire(account),
    ]);

    // Une seule connexion créée.
    expect(mockClient.connect).toHaveBeenCalledTimes(1);
    expect(client1).toBe(client2);
  });

  it('release sur un accountId inexistant ne fait rien', () => {
    // Ne doit pas throw.
    imapPool.release('nonexistent-account-id');
  });

  it('closeAll sur un pool vide ne fait rien', async () => {
    await imapPool.closeAll();
    expect(mockClient.logout).not.toHaveBeenCalled();
  });
});
