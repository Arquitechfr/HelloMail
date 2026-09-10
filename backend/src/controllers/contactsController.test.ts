import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { setupTestDb, teardownTestDb, clearDb } from '../test/setup.js';
import { contactsRoutes } from '../routes/contactsRoutes.js';
import { authRoutes } from '../routes/authRoutes.js';
import { errorHandler } from '../middleware/errorHandler.js';

function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/contacts', contactsRoutes);
  app.use(errorHandler);
  return app;
}

async function registerAndLogin(app: express.Express, email: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'Password1' });
  return res.body.accessToken;
}

describe('Contacts routes (intégration)', () => {
  let app: express.Express;
  let token: string;

  beforeAll(async () => {
    await setupTestDb();
    app = createApp();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearDb();
    token = await registerAndLogin(app, 'contacts@test.com');
  });

  it('GET /api/contacts sans auth → 401', async () => {
    const res = await request(app).get('/api/contacts');
    expect(res.status).toBe(401);
  });

  it('GET /api/contacts vide → 200 avec tableau vide', async () => {
    const res = await request(app)
      .get('/api/contacts')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.contacts).toEqual([]);
  });

  it('POST /api/contacts crée un contact → 201', async () => {
    const res = await request(app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Alice Dupont', email: 'alice@example.com' });

    expect(res.status).toBe(201);
    expect(res.body.contact.name).toBe('Alice Dupont');
    expect(res.body.contact.email).toBe('alice@example.com');
    expect(res.body.contact.id).toBeDefined();
  });

  it('POST /api/contacts avec doublon email → 409', async () => {
    await request(app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Alice', email: 'alice@example.com' });

    const res = await request(app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Alice 2', email: 'alice@example.com' });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('existe déjà');
  });

  it('POST /api/contacts avec email invalide → 400', async () => {
    const res = await request(app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Alice', email: 'invalid' });

    expect(res.status).toBe(400);
  });

  it('POST /api/contacts sans nom → 400', async () => {
    const res = await request(app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '', email: 'alice@example.com' });

    expect(res.status).toBe(400);
  });

  it('GET /api/contacts liste les contacts triés par nom', async () => {
    await request(app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Zoé', email: 'zoe@example.com' });
    await request(app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Alice', email: 'alice@example.com' });

    const res = await request(app)
      .get('/api/contacts')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.contacts).toHaveLength(2);
    expect(res.body.contacts[0].name).toBe('Alice');
    expect(res.body.contacts[1].name).toBe('Zoé');
  });

  it('PATCH /api/contacts/:id met à jour un contact → 200', async () => {
    const createRes = await request(app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Alice', email: 'alice@example.com' });

    const res = await request(app)
      .patch(`/api/contacts/${createRes.body.contact.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Alice Dupont' });

    expect(res.status).toBe(200);
    expect(res.body.contact.name).toBe('Alice Dupont');
  });

  it('PATCH /api/contacts/:id avec doublon email → 409', async () => {
    const createRes = await request(app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Alice', email: 'alice@example.com' });
    await request(app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Bob', email: 'bob@example.com' });

    const res = await request(app)
      .patch(`/api/contacts/${createRes.body.contact.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'bob@example.com' });

    expect(res.status).toBe(409);
  });

  it('PATCH /api/contacts/:id inexistant → 404', async () => {
    const res = await request(app)
      .patch('/api/contacts/507f1f77bcf86cd799439011')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated' });

    expect(res.status).toBe(404);
  });

  it('DELETE /api/contacts/:id supprime un contact → 200', async () => {
    const createRes = await request(app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Alice', email: 'alice@example.com' });

    const res = await request(app)
      .delete(`/api/contacts/${createRes.body.contact.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('supprimé');

    // Vérifie que le contact n'existe plus.
    const listRes = await request(app)
      .get('/api/contacts')
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.body.contacts).toHaveLength(0);
  });

  it('DELETE /api/contacts/:id inexistant → 404', async () => {
    const res = await request(app)
      .delete('/api/contacts/507f1f77bcf86cd799439011')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('GET /api/contacts/search?q=alice → 200 avec résultats', async () => {
    await request(app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Alice Dupont', email: 'alice@example.com' });
    await request(app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Bob Martin', email: 'bob@example.com' });

    const res = await request(app)
      .get('/api/contacts/search?q=alice')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.contacts).toHaveLength(1);
    expect(res.body.contacts[0].name).toBe('Alice Dupont');
  });

  it('GET /api/contacts/search sans q → 400', async () => {
    const res = await request(app)
      .get('/api/contacts/search')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it("isolation : un utilisateur ne voit pas les contacts d'un autre", async () => {
    // Crée un contact avec l'utilisateur 1.
    await request(app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Alice', email: 'alice@example.com' });

    // Register un second utilisateur.
    const token2 = await registerAndLogin(app, 'user2@test.com');

    // L'utilisateur 2 ne doit pas voir le contact de l'utilisateur 1.
    const res = await request(app)
      .get('/api/contacts')
      .set('Authorization', `Bearer ${token2}`);

    expect(res.status).toBe(200);
    expect(res.body.contacts).toEqual([]);
  });
});
