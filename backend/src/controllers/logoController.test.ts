import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import logoRoutes from '../routes/logoRoutes.js';
import { extractDomain, getLogo, clearLogoMemoryCache } from '../services/logo/logoService.js';
import { env } from '../config/env.js';

function createApp(): express.Express {
  const app = express();
  app.use('/api/logos', logoRoutes);
  return app;
}

describe('logoService & logoController', () => {
  const originalFetch = global.fetch;
  const originalToken = env.LOGO_DEV_TOKEN;
  let app: express.Express;

  beforeEach(() => {
    clearLogoMemoryCache();
    app = createApp();
    // Par défaut, simule un token présent
    env.LOGO_DEV_TOKEN = 'pk_test_token_123';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    env.LOGO_DEV_TOKEN = originalToken;
    vi.restoreAllMocks();
  });

  describe('extractDomain', () => {
    it('extrait le domaine depuis une adresse email simple', () => {
      expect(extractDomain('support@stripe.com')).toBe('stripe.com');
      expect(extractDomain('contact@GITHUB.COM')).toBe('github.com');
    });

    it('extrait et nettoie un domaine brut avec espaces ou URL', () => {
      expect(extractDomain('  google.com  ')).toBe('google.com');
      expect(extractDomain('https://apple.com/')).toBe('apple.com');
      expect(extractDomain('www.notion.so')).toBe('notion.so');
    });

    it('rejette les domaines invalides, localhost ou sans TLD', () => {
      expect(extractDomain('')).toBeNull();
      expect(extractDomain(null)).toBeNull();
      expect(extractDomain('localhost')).toBeNull();
      expect(extractDomain('invalid_domain')).toBeNull();
      expect(extractDomain('127.0.0.1')).toBeNull();
    });
  });

  describe('getLogo & Cache', () => {
    it('renvoie null si aucun LOGO_DEV_TOKEN n\'est configuré', async () => {
      env.LOGO_DEV_TOKEN = undefined;
      const result = await getLogo('github.com');
      expect(result).toBeNull();
    });

    it('récupère un logo avec succès depuis Logo.dev et le met en cache', async () => {
      const mockRaw = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // signature PNG
      const mockImageBytes = Buffer.from(mockRaw);
      const fetchMock = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'image/png' }),
        arrayBuffer: async () => mockRaw.buffer,
      });
      global.fetch = fetchMock;

      const result1 = await getLogo('stripe.com');
      expect(result1).not.toBeNull();
      expect(result1?.contentType).toBe('image/png');
      expect(result1?.buffer).toEqual(mockImageBytes);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Le deuxième appel doit être servi depuis le cache mémoire sans second fetch
      const result2 = await getLogo('stripe.com');
      expect(result2).toEqual(result1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('renvoie null et met en cache le statut 404 lorsque Logo.dev ne trouve pas le logo', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        status: 404,
      });
      global.fetch = fetchMock;

      const result1 = await getLogo('unknown-brand-404.com');
      expect(result1).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Le cache 404 évite de répéter l'appel
      const result2 = await getLogo('unknown-brand-404.com');
      expect(result2).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('gère gracieusement les erreurs réseau sans planter', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

      const result = await getLogo('error-domain.org');
      expect(result).toBeNull();
    });

    it('résout automatiquement la clé publiable si une clé secrète sk_ est fournie', async () => {
      env.LOGO_DEV_TOKEN = 'sk_secret_123';
      const mockRaw = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      const fetchMock = vi.fn()
        // 1. Appel api.logo.dev/search?q=google pour résoudre pk_
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [{ logo_url: 'https://img.logo.dev/google.com?token=pk_auto_resolved_456' }],
        })
        // 2. Appel img.logo.dev/notion.so?token=pk_auto_resolved_456
        .mockResolvedValueOnce({
          status: 200,
          headers: new Headers({ 'content-type': 'image/png' }),
          arrayBuffer: async () => mockRaw.buffer,
        });
      global.fetch = fetchMock;

      const result = await getLogo('notion.so');
      expect(result).not.toBeNull();
      expect(result?.contentType).toBe('image/png');
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[1][0]).toContain('token=pk_auto_resolved_456');
    });
  });

  describe('Route HTTP GET /api/logos/:domain', () => {
    it('renvoie 200 et les bons en-têtes HTTP de cache pour un logo existant', async () => {
      const mockPng = Buffer.from('fake-png-data');
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'image/png' }),
        arrayBuffer: async () => mockPng.buffer,
      });

      const res = await request(app).get('/api/logos/stripe.com');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('image/png');
      expect(res.headers['cache-control']).toContain('public');
      expect(res.headers['cache-control']).toContain('max-age=604800');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('accepte une adresse email complète en paramètre et extrait le domaine', async () => {
      const mockPng = Buffer.from('fake-png-data');
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'image/png' }),
        arrayBuffer: async () => mockPng.buffer,
      });

      const res = await request(app).get('/api/logos/support@github.com');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('image/png');
    });

    it('renvoie 404 pour un domaine inexistant ou introuvable', async () => {
      global.fetch = vi.fn().mockResolvedValue({ status: 404 });

      const res = await request(app).get('/api/logos/unknown-domain-test.com');
      expect(res.status).toBe(404);
      expect(res.headers['cache-control']).toContain('no-cache');
    });

    it('renvoie 404 avec cache négatif pour un domaine invalide', async () => {
      const res = await request(app).get('/api/logos/invalid_not_domain');
      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Domaine invalide ou introuvable');
    });
  });
});
