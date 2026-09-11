import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from '../test/setup.js';
import { authRoutes } from '../routes/authRoutes.js';
import { twoFactorRoutes } from '../routes/twoFactorRoutes.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { UserModel } from '../models/User.js';
import { COOKIE_REFRESH_TOKEN } from '../config/constants.js';

// Mock simplewebauthn/server pour les tests unitaires / intégration
vi.mock('@simplewebauthn/server', () => ({
  generateAuthenticationOptions: vi.fn(async () => ({
    challenge: 'mock_challenge_base64url',
    rpId: 'localhost',
    allowCredentials: [],
  })),
  verifyAuthenticationResponse: vi.fn(async () => ({
    verified: true,
    authenticationInfo: {
      newCounter: 10,
    },
  })),
  generateRegistrationOptions: vi.fn(async () => ({
    challenge: 'mock_reg_challenge',
    rpName: 'HelloMail',
    rpID: 'localhost',
    user: { id: 'userid', name: 'test@example.com', displayName: 'test@example.com' },
  })),
  verifyRegistrationResponse: vi.fn(async () => ({
    verified: true,
    registrationInfo: {
      credential: {
        id: 'mock_cred_id',
        publicKey: Buffer.from('mock_public_key'),
        counter: 1,
        transports: ['internal'],
      },
      credentialDeviceType: 'singleDevice',
    },
  })),
}));

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/auth', twoFactorRoutes);
  app.use(errorHandler);
  return app;
}

describe('WebAuthn Login Finish (Intégration)', () => {
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
    vi.clearAllMocks();
  });

  it('login start avec email inexistant → 404', async () => {
    const res = await request(app)
      .post('/api/auth/2fa/webauthn/login/start')
      .send({ email: 'unknown@test.com' });

    expect(res.status).toBe(404);
  });

  it('login start quand 2FA non activée → 400', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'no2fa@test.com', password: 'Password1' });

    const res = await request(app)
      .post('/api/auth/2fa/webauthn/login/start')
      .send({ email: 'no2fa@test.com' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('2FA');
  });

  it('login finish complet → 200, émet accessToken et cookie refreshToken', async () => {
    // 1. Enregistrement d'un utilisateur
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'passkey@test.com', password: 'Password1' });

    const userId = registerRes.body.user.id;

    // 2. Ajout manuel d'une credential WebAuthn et activation 2FA
    await UserModel.updateOne(
      { _id: userId },
      {
        twoFactorEnabled: true,
        currentWebauthnChallenge: 'mock_challenge_base64url',
        webauthnCredentials: [
          {
            id: 'mock_cred_id',
            publicKey: 'bW9ja19wdWJsaWNfa2V5',
            counter: 5,
            deviceType: 'singleDevice',
            transports: ['internal'],
            createdAt: new Date(),
          },
        ],
      },
    );

    // 3. Appel de login/finish
    const res = await request(app)
      .post('/api/auth/2fa/webauthn/login/finish')
      .send({
        email: 'passkey@test.com',
        response: {
          id: 'mock_cred_id',
          rawId: 'mock_cred_id',
          response: { clientDataJSON: 'xyz' },
          type: 'public-key',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('passkey@test.com');

    // Vérifie la présence du cookie httpOnly
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const refreshCookie = Array.isArray(cookies)
      ? cookies.find((c: string) => c.startsWith(`${COOKIE_REFRESH_TOKEN}=`))
      : cookies;
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain('HttpOnly');
  });
});
