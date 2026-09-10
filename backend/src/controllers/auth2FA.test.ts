import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from '../test/setup.js';
import { authRoutes } from '../routes/authRoutes.js';
import { twoFactorRoutes } from '../routes/twoFactorRoutes.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { UserModel } from '../models/User.js';
import { generateTOTPSetup, enableTOTP } from '../services/auth/twoFactorService.js';

// Mock otplib (API async v13).
vi.mock('otplib', () => ({
  generateSecret: () => 'TESTSECRETBASE32',
  generate: vi.fn(async () => '123456'),
  verify: vi.fn(async ({ token }: { token: string }) => ({ valid: token === '123456' })),
  generateURI: ({ secret, label, issuer }: { secret: string; label: string; issuer: string }) =>
    `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}`,
}));

// Mock qrcode.
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(async () => 'data:image/png;base64,FAKEQR'),
  },
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

describe('Auth 2FA routes (intégration)', () => {
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

  it('login sans 2FA → 200 avec accessToken (comportement normal)', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'no2fa@test.com', password: 'Password1' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'no2fa@test.com', password: 'Password1' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.requiresTwoFactor).toBeUndefined();
  });

  it('login avec 2FA activée → 200 avec requiresTwoFactor + twoFactorTempToken', async () => {
    // Register.
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'with2fa@test.com', password: 'Password1' });

    // Active la 2FA via le service.
    const user = await UserModel.findOne({ email: 'with2fa@test.com' });
    await generateTOTPSetup(user!);
    const userWithSecret = await UserModel.findById(user!._id).select('+twoFactorSecret');
    await enableTOTP(userWithSecret!, '123456');

    // Login → doit demander la 2FA.
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'with2fa@test.com', password: 'Password1' });

    expect(res.status).toBe(200);
    expect(res.body.requiresTwoFactor).toBe(true);
    expect(res.body.twoFactorTempToken).toBeDefined();
    expect(res.body.accessToken).toBeUndefined();
  });

  it('verify-2fa avec un code TOTP valide → 200 avec accessToken', async () => {
    // Register + active 2FA.
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'verify2fa@test.com', password: 'Password1' });

    const user = await UserModel.findOne({ email: 'verify2fa@test.com' });
    await generateTOTPSetup(user!);
    const userWithSecret = await UserModel.findById(user!._id).select('+twoFactorSecret');
    await enableTOTP(userWithSecret!, '123456');

    // Login → obtient le temp token.
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'verify2fa@test.com', password: 'Password1' });

    const { twoFactorTempToken } = loginRes.body;

    // Vérifie la 2FA.
    const res = await request(app)
      .post('/api/auth/verify-2fa')
      .send({ twoFactorTempToken, code: '123456' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user).toMatchObject({ id: expect.any(String), email: 'verify2fa@test.com' });
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('verify-2fa avec un code invalide → 401', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'bad2fa@test.com', password: 'Password1' });

    const user = await UserModel.findOne({ email: 'bad2fa@test.com' });
    await generateTOTPSetup(user!);
    const userWithSecret = await UserModel.findById(user!._id).select('+twoFactorSecret');
    await enableTOTP(userWithSecret!, '123456');

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bad2fa@test.com', password: 'Password1' });

    const res = await request(app)
      .post('/api/auth/verify-2fa')
      .send({ twoFactorTempToken: loginRes.body.twoFactorTempToken, code: '000000' });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toContain('invalide');
  });

  it('verify-2fa avec un temp token expiré/invalide → 401', async () => {
    const res = await request(app)
      .post('/api/auth/verify-2fa')
      .send({ twoFactorTempToken: 'invalid-token', code: '123456' });

    expect(res.status).toBe(401);
  });

  it('verify-2fa sans body → 400 (validation Zod)', async () => {
    const res = await request(app)
      .post('/api/auth/verify-2fa')
      .send({});

    expect(res.status).toBe(400);
  });

  it('GET /2fa/status sans auth → 401', async () => {
    const res = await request(app).get('/api/auth/2fa/status');
    expect(res.status).toBe(401);
  });

  it('GET /2fa/status avec auth → 200 avec état 2FA', async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'status@test.com', password: 'Password1' });

    const res = await request(app)
      .get('/api/auth/2fa/status')
      .set('Authorization', `Bearer ${registerRes.body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.twoFactorEnabled).toBe(false);
    expect(res.body.webauthnCredentialsCount).toBe(0);
  });

  it('POST /2fa/totp/setup avec auth → 200 avec QR code', async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'setup@test.com', password: 'Password1' });

    const res = await request(app)
      .post('/api/auth/2fa/totp/setup')
      .set('Authorization', `Bearer ${registerRes.body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.qrCodeUrl).toBeDefined();
    expect(res.body.secret).toBeDefined();
  });

  it('POST /2fa/totp/enable avec code valide → 200 avec backup codes', async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'enable@test.com', password: 'Password1' });

    const token = registerRes.body.accessToken;

    // Setup d'abord.
    await request(app)
      .post('/api/auth/2fa/totp/setup')
      .set('Authorization', `Bearer ${token}`);

    // Enable avec code valide.
    const res = await request(app)
      .post('/api/auth/2fa/totp/enable')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: '123456' });

    expect(res.status).toBe(200);
    expect(res.body.backupCodes).toHaveLength(10);
  });

  it('POST /2fa/disable avec bon mot de passe → 200', async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'disable@test.com', password: 'Password1' });

    const token = registerRes.body.accessToken;

    // Setup + enable.
    await request(app)
      .post('/api/auth/2fa/totp/setup')
      .set('Authorization', `Bearer ${token}`);
    await request(app)
      .post('/api/auth/2fa/totp/enable')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: '123456' });

    // Disable.
    const res = await request(app)
      .post('/api/auth/2fa/disable')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'Password1' });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('désactivée');
  });

  it('POST /2fa/disable avec mauvais mot de passe → 401', async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'disablebad@test.com', password: 'Password1' });

    const token = registerRes.body.accessToken;

    const res = await request(app)
      .post('/api/auth/2fa/disable')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'WrongPass1' });

    expect(res.status).toBe(401);
  });
});
