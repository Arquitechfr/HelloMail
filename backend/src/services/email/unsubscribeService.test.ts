import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseUnsubscribeHeaders, parseMailtoUri, executeUnsubscribe } from './unsubscribeService.js';
import type { IAccountDocument } from '../../models/Account.js';
import type { MessageDetail } from './messageFetchService.js';

vi.mock('./sendService.js', () => ({
  sendEmail: vi.fn().mockResolvedValue({ messageId: 'test-unsub-id' }),
}));

vi.mock('./messageFetchService.js', () => ({
  fetchMessageDetail: vi.fn(),
}));

const { fetchMessageDetail } = await import('./messageFetchService.js');
const { sendEmail } = await import('./sendService.js');

describe('unsubscribeService', () => {
  const mockAccount = {
    _id: '507f1f77bcf86cd799439011',
    emailAddress: 'user@test.com',
  } as unknown as IAccountDocument;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseUnsubscribeHeaders', () => {
    it('détecte le mode One-Click avec https et mailto', () => {
      const headers = {
        'list-unsubscribe': '<https://example.com/unsub?id=42>, <mailto:unsub@example.com?subject=stop>',
        'list-unsubscribe-post': 'List-Unsubscribe=One-Click',
      };
      const result = parseUnsubscribeHeaders(headers);
      expect(result).toEqual({
        httpUrl: 'https://example.com/unsub?id=42',
        mailto: 'mailto:unsub@example.com?subject=stop',
        isOneClick: true,
      });
    });

    it('détecte un lien https sans One-Click', () => {
      const headers = {
        'list-unsubscribe': '<https://example.com/preferences>',
      };
      const result = parseUnsubscribeHeaders(headers);
      expect(result).toEqual({
        httpUrl: 'https://example.com/preferences',
        mailto: undefined,
        isOneClick: false,
      });
    });

    it('détecte une adresse mailto seule', () => {
      const headers = {
        'list-unsubscribe': '<mailto:leave@news.example.com?subject=unsubscribe>',
      };
      const result = parseUnsubscribeHeaders(headers);
      expect(result).toEqual({
        httpUrl: undefined,
        mailto: 'mailto:leave@news.example.com?subject=unsubscribe',
        isOneClick: false,
      });
    });

    it('retourne undefined si aucun en-tête List-Unsubscribe', () => {
      expect(parseUnsubscribeHeaders({})).toBeUndefined();
    });
  });

  describe('parseMailtoUri', () => {
    it('parse correctement une URI mailto avec sujet complexe', () => {
      const parsed = parseMailtoUri('mailto:unsub-user@domain.com?subject=D%C3%A9sinscription%20Lettre');
      expect(parsed.to).toBe('unsub-user@domain.com');
      expect(parsed.subject).toBe('Désinscription Lettre');
    });

    it('parse une URI mailto sans paramètres', () => {
      const parsed = parseMailtoUri('mailto:bot@example.com');
      expect(parsed.to).toBe('bot@example.com');
      expect(parsed.subject).toBeUndefined();
    });
  });

  describe('executeUnsubscribe', () => {
    it('exécute une requête POST One-Click RFC 8058 avec succès', async () => {
      vi.mocked(fetchMessageDetail).mockResolvedValueOnce({
        headers: {
          'list-unsubscribe': '<https://example.com/one-click>',
          'list-unsubscribe-post': 'List-Unsubscribe=One-Click',
        },
      } as unknown as MessageDetail);

      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
      });
      vi.stubGlobal('fetch', mockFetch);

      const res = await executeUnsubscribe(mockAccount, 'INBOX', 101);

      expect(res.action).toBe('one_click');
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/one-click', expect.objectContaining({
        method: 'POST',
        body: 'List-Unsubscribe=One-Click',
      }));

      vi.unstubAllGlobals();
    });

    it('bascule sur open_url si la requête POST One-Click échoue', async () => {
      vi.mocked(fetchMessageDetail).mockResolvedValueOnce({
        headers: {
          'list-unsubscribe': '<https://example.com/one-click>',
          'list-unsubscribe-post': 'List-Unsubscribe=One-Click',
        },
      } as unknown as MessageDetail);

      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
      });
      vi.stubGlobal('fetch', mockFetch);

      const res = await executeUnsubscribe(mockAccount, 'INBOX', 102);

      expect(res.action).toBe('open_url');
      expect(res.url).toBe('https://example.com/one-click');

      vi.unstubAllGlobals();
    });

    it('envoie un email automatique si seulement mailto est disponible', async () => {
      vi.mocked(fetchMessageDetail).mockResolvedValueOnce({
        headers: {
          'list-unsubscribe': '<mailto:unsub@list.com?subject=optout>',
        },
      } as unknown as MessageDetail);

      const res = await executeUnsubscribe(mockAccount, 'INBOX', 103);

      expect(res.action).toBe('mailto');
      expect(sendEmail).toHaveBeenCalledWith(mockAccount, expect.objectContaining({
        to: ['unsub@list.com'],
        subject: 'optout',
      }));
    });

    it('retourne le lien externe si seule une URL HTTP classique existe', async () => {
      vi.mocked(fetchMessageDetail).mockResolvedValueOnce({
        headers: {
          'list-unsubscribe': '<https://example.com/unsub-form>',
        },
      } as unknown as MessageDetail);

      const res = await executeUnsubscribe(mockAccount, 'INBOX', 104);

      expect(res.action).toBe('open_url');
      expect(res.url).toBe('https://example.com/unsub-form');
    });

    it('lève une exception AppError 400 si aucun en-tête de désabonnement', async () => {
      vi.mocked(fetchMessageDetail).mockResolvedValueOnce({
        headers: {},
      } as unknown as MessageDetail);

      await expect(executeUnsubscribe(mockAccount, 'INBOX', 105)).rejects.toThrow(
        "Ce message ne contient pas d'en-tête de désabonnement valide",
      );
    });
  });
});
