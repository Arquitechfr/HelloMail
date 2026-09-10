import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from '../test/setup.js';
import { authRoutes } from '../routes/authRoutes.js';
import { errorHandler } from '../middleware/errorHandler.js';

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use(errorHandler);
  return app;
}

describe('Auth routes (intégration)', () => {
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

  it('register → 201 avec accessToken + cookie refresh', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@test.com', password: 'Password1' });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user).toEqual({ id: expect.any(String), email: 'test@test.com' });
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('register avec un doublon → 409', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@test.com', password: 'Password1' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@test.com', password: 'Password1' });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('déjà');
  });

  it('register avec un email invalide → 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'invalid', password: 'Password1' });

    expect(res.status).toBe(400);
  });

  it('login avec bons identifiants → 200', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'login@test.com', password: 'Password1' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@test.com', password: 'Password1' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it('login avec mauvais mot de passe → 401', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'wrong@test.com', password: 'Password1' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'wrong@test.com', password: 'WrongPass1' });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toContain('invalides');
  });

  it('me avec un token valide → 200', async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'me@test.com', password: 'Password1' });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${registerRes.body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('me@test.com');
  });

  it('me sans token → 401', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
  });

  it('refresh avec un cookie valide → 200 avec nouveau accessToken', async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'refresh@test.com', password: 'Password1' });

    const cookies = registerRes.headers['set-cookie'];
    const cookieHeader = Array.isArray(cookies) ? cookies[0] : cookies;

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it('refresh sans cookie → 401', async () => {
    const res = await request(app).post('/api/auth/refresh');

    expect(res.status).toBe(401);
  });

  it('logout → 200', async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'logout@test.com', password: 'Password1' });

    const cookies = registerRes.headers['set-cookie'];
    const cookieHeader = Array.isArray(cookies) ? cookies[0] : cookies;

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookieHeader);

    expect(res.status).toBe(200);
  });
});
