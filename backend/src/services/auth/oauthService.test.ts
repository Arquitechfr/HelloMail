import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IAccountDocument } from '../../models/Account.js';

// Mock de env.
vi.mock('../../config/env.js', () => ({
  env: {
    GOOGLE_CLIENT_ID: 'test-client-id',
    GOOGLE_CLIENT_SECRET: 'test-client-secret',
    GOOGLE_REDIRECT_URI: 'http://localhost:4001/api/accounts/oauth/google/callback',
    JWT_ACCESS_SECRET: 'test-jwt-secret-32-chars-minimum-aaaaaa',
    NODE_ENV: 'test',
  },
}));

// Mock de logger.
vi.mock('../../config/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock de encryptionService.
const mockEncrypt = vi.fn().mockReturnValue({ iv: 'aa', authTag: 'bb', ciphertext: 'cc' });
const mockDecrypt = vi.fn().mockReturnValue('decrypted-refresh-token');

vi.mock('../security/encryptionService.js', () => ({
  encrypt: mockEncrypt,
  decrypt: mockDecrypt,
}));

// Mock de AccountModel.
const mockAccountUpdateOne = vi.fn().mockResolvedValue({});

vi.mock('../../models/Account.js', () => ({
  AccountModel: {
    updateOne: mockAccountUpdateOne,
  },
}));

// Mock global.fetch.
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const {
  getGoogleAuthUrl,
  createOAuthState,
  verifyOAuthState,
  exchangeGoogleCode,
  refreshGoogleAccessToken,
  getValidGoogleAccessToken,
  getImapAuth,
  getSmtpAuth,
  encryptRefreshToken,
  invalidateTokenCache,
} = await import('./oauthService.js');

function makeOAuthAccount(overrides: Partial<IAccountDocument> = {}): IAccountDocument {
  return {
    _id: '507f1f77bcf86cd799439011',
    userId: '507f1f77bcf86cd799439012',
    provider: 'google_oauth',
    emailAddress: 'user@gmail.com',
    imapConfig: {
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      smtpHost: 'smtp.gmail.com',
      smtpPort: 465,
      smtpSecure: true,
      username: 'user@gmail.com',
    },
    oauthConfig: {
      encryptedRefreshToken: { iv: 'aa', authTag: 'bb', ciphertext: 'cc' },
      accessTokenExpiresAt: new Date(Date.now() + 3600_000),
      scope: ['https://mail.google.com/'],
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as IAccountDocument;
}

describe('oauthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    mockDecrypt.mockReturnValue('decrypted-refresh-token');
    mockAccountUpdateOne.mockResolvedValue({});
    invalidateTokenCache('507f1f77bcf86cd799439011');
  });

  afterEach(() => {
    invalidateTokenCache('507f1f77bcf86cd799439011');
  });

  describe('getGoogleAuthUrl', () => {
    it('génère une URL d\'autorisation valide', () => {
      const url = getGoogleAuthUrl('state-test');
      expect(url).toContain('accounts.google.com');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('scope=https%3A%2F%2Fmail.google.com%2F');
      expect(url).toContain('access_type=offline');
      expect(url).toContain('state=state-test');
    });
  });

  describe('createOAuthState / verifyOAuthState', () => {
    it('crée et vérifie un state JWT valide', () => {
      const userId = '507f1f77bcf86cd799439012';
      const state = createOAuthState(userId);
      const decodedUserId = verifyOAuthState(state);
      expect(decodedUserId).toBe(userId);
    });

    it('rejette un state invalide', () => {
      expect(() => verifyOAuthState('invalid-state')).toThrow();
    });
  });

  describe('exchangeGoogleCode', () => {
    it('échange un code contre des tokens', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'access-123',
          refresh_token: 'refresh-456',
          expires_in: 3600,
          scope: 'https://mail.google.com/',
          token_type: 'Bearer',
        }),
      });

      const tokens = await exchangeGoogleCode('test-code');
      expect(tokens.access_token).toBe('access-123');
      expect(tokens.refresh_token).toBe('refresh-456');
      expect(tokens.expires_in).toBe(3600);
    });

    it('lance une erreur si Google rejette le code', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, text: async () => 'invalid_grant' });
      await expect(exchangeGoogleCode('bad-code')).rejects.toThrow();
    });
  });

  describe('refreshGoogleAccessToken', () => {
    it('renouvelle l\'access token et met à jour le compte', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'new-access', expires_in: 3600 }),
      });

      const account = makeOAuthAccount();
      const result = await refreshGoogleAccessToken(account);
      expect(result.accessToken).toBe('new-access');
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(mockAccountUpdateOne).toHaveBeenCalledOnce();
    });

    it('lance une erreur si le refresh échoue', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, text: async () => 'invalid_grant' });
      await expect(refreshGoogleAccessToken(makeOAuthAccount())).rejects.toThrow();
    });
  });

  describe('getValidGoogleAccessToken', () => {
    it('utilise le cache si le token est valide', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'cached-access', expires_in: 3600 }),
      });

      const account = makeOAuthAccount();
      const token1 = await getValidGoogleAccessToken(account);
      const token2 = await getValidGoogleAccessToken(account);

      expect(token1).toBe('cached-access');
      expect(token2).toBe('cached-access');
      // Un seul appel à fetch (le 2e utilise le cache).
      expect(mockFetch).toHaveBeenCalledOnce();
    });

    it('renouvelle si le token en cache est expiré', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'first-access', expires_in: 1 }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'second-access', expires_in: 3600 }),
      });

      const account = makeOAuthAccount();
      const token1 = await getValidGoogleAccessToken(account);

      // Attend que le cache expire.
      await new Promise((r) => setTimeout(r, 1100));

      const token2 = await getValidGoogleAccessToken(account);
      expect(token1).toBe('first-access');
      expect(token2).toBe('second-access');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('getImapAuth', () => {
    it('retourne password pour un compte IMAP', async () => {
      const account = makeOAuthAccount({ provider: 'imap' } as Partial<IAccountDocument>);
      // Pour IMAP, on a besoin de encryptedPassword.
      (account as { imapConfig?: { encryptedPassword?: unknown } }).imapConfig = {
        ...account.imapConfig,
        encryptedPassword: { iv: 'aa', authTag: 'bb', ciphertext: 'cc' },
      };
      const auth = await getImapAuth(account);
      expect(auth.user).toBe('user@gmail.com');
      expect(auth.pass).toBe('decrypted-refresh-token');
      expect(auth.accessToken).toBeUndefined();
    });

    it('retourne accessToken pour un compte Google OAuth', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'oauth-access', expires_in: 3600 }),
      });
      const auth = await getImapAuth(makeOAuthAccount());
      expect(auth.user).toBe('user@gmail.com');
      expect(auth.accessToken).toBe('oauth-access');
      expect(auth.pass).toBeUndefined();
    });
  });

  describe('getSmtpAuth', () => {
    it('retourne password pour un compte IMAP', async () => {
      const account = makeOAuthAccount({ provider: 'imap' } as Partial<IAccountDocument>);
      (account as { imapConfig?: { encryptedPassword?: unknown } }).imapConfig = {
        ...account.imapConfig,
        encryptedPassword: { iv: 'aa', authTag: 'bb', ciphertext: 'cc' },
      };
      const auth = await getSmtpAuth(account);
      expect(auth.user).toBe('user@gmail.com');
      expect(auth.pass).toBe('decrypted-refresh-token');
    });

    it('retourne OAuth2 pour un compte Google OAuth', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'oauth-smtp', expires_in: 3600 }),
      });
      const auth = await getSmtpAuth(makeOAuthAccount());
      expect(auth.user).toBe('user@gmail.com');
      expect(auth.type).toBe('OAuth2');
      expect(auth.accessToken).toBe('oauth-smtp');
    });
  });

  describe('encryptRefreshToken', () => {
    it('chiffre le refresh token', () => {
      const result = encryptRefreshToken('my-refresh-token');
      expect(mockEncrypt).toHaveBeenCalledWith('my-refresh-token');
      expect(result).toEqual({ iv: 'aa', authTag: 'bb', ciphertext: 'cc' });
    });
  });
});
