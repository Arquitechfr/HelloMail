import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  detectEmailConfig,
  queryMozillaIspdb,
  queryDnsMx,
} from './autoconfigService.js';
import dns from 'node:dns/promises';

describe('autoconfigService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('queryMozillaIspdb', () => {
    it('doit parser correctement une réponse XML valide de Mozilla ISPDB', async () => {
      const mockXml = `
        <clientConfig version="1.1">
          <emailProvider id="orange.fr">
            <domain>orange.fr</domain>
            <incomingServer type="imap">
              <hostname>imap.orange.fr</hostname>
              <port>993</port>
              <socketType>SSL</socketType>
              <username>%EMAILADDRESS%</username>
            </incomingServer>
            <outgoingServer type="smtp">
              <hostname>smtp.orange.fr</hostname>
              <port>465</port>
              <socketType>SSL</socketType>
              <username>%EMAILADDRESS%</username>
            </outgoingServer>
          </emailProvider>
        </clientConfig>
      `;

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        text: async () => mockXml,
      } as Response);

      const result = await queryMozillaIspdb('orange.fr');
      expect(result).not.toBeNull();
      expect(result?.detected).toBe(true);
      expect(result?.source).toBe('ispdb');
      expect(result?.imap?.host).toBe('imap.orange.fr');
      expect(result?.imap?.port).toBe(993);
      expect(result?.imap?.secure).toBe(true);
      expect(result?.smtp?.host).toBe('smtp.orange.fr');
      expect(result?.smtp?.port).toBe(465);
    });

    it('doit retourner null en cas d\'erreur HTTP ou réseau', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await queryMozillaIspdb('inconnu-12345.fr');
      expect(result).toBeNull();
    });
  });

  describe('queryDnsMx', () => {
    it('doit détecter Google Workspace si le MX pointe vers google.com', async () => {
      vi.spyOn(dns, 'resolveMx').mockResolvedValueOnce([
        { exchange: 'aspmx.l.google.com', priority: 1 },
        { exchange: 'alt1.aspmx.l.google.com', priority: 5 },
      ]);

      const result = await queryDnsMx('monentreprise.com');
      expect(result).not.toBeNull();
      expect(result?.providerSuggestion).toBe('google_oauth');
      expect(result?.imap?.host).toBe('imap.gmail.com');
    });

    it('doit détecter Microsoft 365 si le MX pointe vers outlook.com', async () => {
      vi.spyOn(dns, 'resolveMx').mockResolvedValueOnce([
        { exchange: 'monentreprise-com.mail.protection.outlook.com', priority: 0 },
      ]);

      const result = await queryDnsMx('monentreprise.com');
      expect(result).not.toBeNull();
      expect(result?.providerSuggestion).toBe('microsoft_oauth');
      expect(result?.imap?.host).toBe('outlook.office365.com');
      expect(result?.smtp?.host).toBe('smtp.office365.com');
    });

    it('doit détecter OVH si le MX pointe vers ovh.net', async () => {
      vi.spyOn(dns, 'resolveMx').mockResolvedValueOnce([
        { exchange: 'mx1.mail.ovh.net', priority: 1 },
      ]);

      const result = await queryDnsMx('monsitedomaine.fr');
      expect(result).not.toBeNull();
      expect(result?.imap?.host).toBe('ssl0.ovh.net');
    });
  });

  describe('detectEmailConfig', () => {
    it('doit retourner le fallback heuristique si ni ISPDB ni MX ne correspondent', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      vi.spyOn(dns, 'resolveMx').mockResolvedValueOnce([
        { exchange: 'mx.customserver.xyz', priority: 10 },
      ]);

      const result = await detectEmailConfig('contact@customserver.xyz');
      expect(result.detected).toBe(false);
      expect(result.source).toBe('heuristic');
      expect(result.imap?.host).toBe('imap.customserver.xyz');
      expect(result.smtp?.host).toBe('smtp.customserver.xyz');
    });

    it('doit gérer les adresses invalides sans crasher', async () => {
      const result = await detectEmailConfig('adresse-invalide');
      expect(result.detected).toBe(false);
      expect(result.source).toBe('none');
    });
  });
});
