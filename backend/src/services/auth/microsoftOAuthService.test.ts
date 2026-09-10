import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import type { IAccountDocument } from '../../models/Account.js';

vi.mock('../../config/env.js', () => ({
  env: {
    MICROSOFT_CLIENT_ID: 'test-ms-client-id',
    MICROSOFT_CLIENT_SECRET: 'test-ms-client-secret',
    MICROSOFT_REDIRECT_URI: 'http://localhost:4000/api/accounts/oauth/microsoft/callback',
    JWT_ACCESS_SECRET: 'test-jwt-secret-32-chars-minimum-aaaaaa',
    NODE_ENV: 'test',
  },
}));

vi.mock('../../config/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockDecrypt = vi.fn().mockReturnValue('decrypted-ms-refresh-token');
vi.mock('../security/encryptionService.js', () => ({
  decrypt: mockDecrypt,
}));

const mockAccountUpdateOne = vi.fn().mockResolvedValue({});
vi.mock('../../models/Account.js', () => ({
  AccountModel: {
    updateOne: mockAccountUpdateOne,
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const {
  getMicrosoftAuthUrl,
  exchangeMicrosoftCode,
  refreshMicrosoftAccessToken,
  getValidMicrosoftAccessToken,
  invalidateMicrosoftTokenCache,
} = await import('./microsoftOAuthService.js');

function makeMicrosoftAccount(overrides: Partial<IAccountDocument> = {}): IAccountDocument {
  return {
    _id: 'ms-account-123',
    userId: 'user-456',
    provider: 'microsoft_oauth',
    emailAddress: 'user@outlook.com',
    oauthConfig: {
      encryptedRefreshToken: { iv: 'aa', authTag: 'bb', ciphertext: 'cc' },
      scope: ['https://outlook.office.com/IMAP.AccessAsUser.All'],
    },
    ...overrides,
  } as unknown as IAccountDocument;
}

describe('microsoftOAuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMicrosoftAuthUrl', () => {
    it('doit générer une URL d\'autorisation Microsoft valide avec le state', () => {
      const state = 'signed-state-jwt';
      const url = getMicrosoftAuthUrl(state);

      expect(url).toContain('login.microsoftonline.com');
      expect(url).toContain('client_id=test-ms-client-id');
      expect(url).toContain('state=signed-state-jwt');
      expect(url).toContain('redirect_uri=');
    });
  });

  describe('exchangeMicrosoftCode', () => {
    it('doit échanger un code contre des tokens', async () => {
      const mockTokens = {
        access_token: 'ms-access-token',
        refresh_token: 'ms-refresh-token',
        expires_in: 3600,
        scope: 'openid email',
        token_type: 'Bearer',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokens,
      });

      const result = await exchangeMicrosoftCode('valid-code');
      expect(result.access_token).toBe('ms-access-token');
      expect(result.refresh_token).toBe('ms-refresh-token');
    });

    it('doit lever une erreur si la réponse HTTP n\'est pas OK', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'invalid_grant',
      });

      await expect(exchangeMicrosoftCode('bad-code')).rejects.toThrow('Échange de code Microsoft échoué');
    });
  });

  describe('refreshMicrosoftAccessToken', () => {
    it('doit renouveler l\'access token et mettre à jour la date d\'expiration en base', async () => {
      const account = makeMicrosoftAccount();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'new-token', expires_in: 3600 }),
      });

      const result = await refreshMicrosoftAccessToken(account);

      expect(result.accessToken).toBe('new-token');
      expect(mockAccountUpdateOne).toHaveBeenCalledWith(
        { _id: 'ms-account-123' },
        expect.objectContaining({ 'oauthConfig.accessTokenExpiresAt': expect.any(Date) }),
      );
    });
  });

  describe('getValidMicrosoftAccessToken & cache', () => {
    it('doit mettre en cache et réutiliser le token valide sans réappeler l\'API', async () => {
      const cachedId = new mongoose.Types.ObjectId();
      const account = makeMicrosoftAccount({ _id: cachedId });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'cached-token', expires_in: 3600 }),
      });

      const token1 = await getValidMicrosoftAccessToken(account);
      const token2 = await getValidMicrosoftAccessToken(account);

      expect(token1).toBe('cached-token');
      expect(token2).toBe('cached-token');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Test invalidation
      invalidateMicrosoftTokenCache(String(cachedId));
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'fresh-token', expires_in: 3600 }),
      });

      const token3 = await getValidMicrosoftAccessToken(account);
      expect(token3).toBe('fresh-token');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
