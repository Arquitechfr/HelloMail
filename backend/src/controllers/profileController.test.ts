import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from '../test/setup.js';
import { authRoutes } from '../routes/authRoutes.js';
import profileRoutes from '../routes/profileRoutes.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { TagModel } from '../models/Tag.js';
import { encryptProfilePayload, type IMailoraProfilePayload } from '../services/profile/profileCryptoService.js';

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/profile', profileRoutes);
  app.use(errorHandler);
  return app;
}

async function setupUser(app: express.Express): Promise<{ token: string; email: string }> {
  const email = `user-${Date.now()}@test.com`;
  await request(app).post('/api/auth/register').send({ email, password: 'Password1' });
  const loginRes = await request(app).post('/api/auth/login').send({ email, password: 'Password1' });
  return { token: loginRes.body.accessToken, email };
}

describe('profileController (Lot 30.4)', () => {
  let app: express.Express;

  beforeAll(async () => {
    await setupTestDb();
    app = createApp();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearDb();
  });

  describe('GET /api/profile/export', () => {
    it('retourne 401 si non authentifié', async () => {
      const res = await request(app).get('/api/profile/export');
      expect(res.status).toBe(401);
    });

    it('exporte le profil au format JSON clair avec les bons headers', async () => {
      const { token, email } = await setupUser(app);

      const res = await request(app)
        .get('/api/profile/export')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/json');
      expect(res.headers['content-disposition']).toContain('attachment; filename="mailora-profile-');
      expect(res.body.metadata.version).toBe('1.0');
      expect(res.body.metadata.userEmail).toBe(email);
    });

    it('retourne 400 si encrypt=true sans mot de passe', async () => {
      const { token } = await setupUser(app);

      const res = await request(app)
        .get('/api/profile/export?encrypt=true')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('password');
    });

    it('exporte le profil au format chiffré si encrypt=true et mot de passe fourni', async () => {
      const { token } = await setupUser(app);

      const res = await request(app)
        .get('/api/profile/export?encrypt=true&password=SecretPassword123')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toContain('.enc.json');
      expect(res.body.format).toBe('mailora-encrypted-profile');
      expect(res.body.algorithm).toBe('aes-256-gcm');
      expect(res.body.ciphertext).toBeDefined();
    });
  });

  describe('POST /api/profile/preview', () => {
    const samplePayload: IMailoraProfilePayload = {
      metadata: {
        version: '1.0',
        generator: 'Mailora',
        exportedAt: '2026-09-12T12:00:00.000Z',
        userEmail: 'imported@test.com',
      },
      tags: [{ name: 'TestTag', color: '#10b981' }],
    };

    it('analyse un profil clair et retourne les compteurs', async () => {
      const { token } = await setupUser(app);

      const res = await request(app)
        .post('/api/profile/preview')
        .set('Authorization', `Bearer ${token}`)
        .send({ backupData: samplePayload });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.preview.summary.tags.total).toBe(1);
      expect(res.body.preview.summary.tags.new).toBe(1);
    });

    it('déchiffre et analyse un profil chiffré avec le bon mot de passe', async () => {
      const { token } = await setupUser(app);
      const encrypted = encryptProfilePayload(samplePayload, 'Password123', 1000);

      const res = await request(app)
        .post('/api/profile/preview')
        .set('Authorization', `Bearer ${token}`)
        .send({ backupData: encrypted, password: 'Password123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.preview.isEncrypted).toBe(true);
      expect(res.body.preview.summary.tags.total).toBe(1);
    });

    it('rejette un profil chiffré avec un mauvais mot de passe', async () => {
      const { token } = await setupUser(app);
      const encrypted = encryptProfilePayload(samplePayload, 'Password123', 1000);

      const res = await request(app)
        .post('/api/profile/preview')
        .set('Authorization', `Bearer ${token}`)
        .send({ backupData: encrypted, password: 'WrongPassword' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Mot de passe incorrect');
    });
  });

  describe('POST /api/profile/restore', () => {
    it('restaure les sections sélectionnées et renvoie le rapport', async () => {
      const { token } = await setupUser(app);
      const samplePayload: IMailoraProfilePayload = {
        metadata: {
          version: '1.0',
          generator: 'Mailora',
          exportedAt: '2026-09-12T12:00:00.000Z',
          userEmail: 'imported@test.com',
        },
        tags: [{ name: 'NouveauLibelle', color: '#6366f1' }],
      };

      const res = await request(app)
        .post('/api/profile/restore')
        .set('Authorization', `Bearer ${token}`)
        .send({
          backupData: samplePayload,
          sections: ['tags'],
          conflictStrategy: 'skip',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.report.imported.tags).toBe(1);

      // Vérifie en base que le tag a bien été créé
      const createdTag = await TagModel.findOne({ name: 'NouveauLibelle' });
      expect(createdTag).not.toBeNull();
      expect(createdTag?.color).toBe('#6366f1');
    });
  });
});
