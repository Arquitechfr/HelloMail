import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { authRoutes } from './routes/authRoutes.js';
import { accountsRoutes } from './routes/accountsRoutes.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

async function bootstrap(): Promise<void> {
  await mongoose.connect(env.MONGO_URI);
  console.log('Connecté à MongoDB');

  const app = express();

  // Trust proxy en production pour que req.ip reflète l'IP réelle derrière nginx.
  // Suppose un seul hop de proxy. Ajuster si la chaîne de proxy grandit.
  if (env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  app.use(express.json());
  app.use(cookieParser());
  app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/accounts', accountsRoutes);

  app.use(notFound);
  app.use(errorHandler);

  app.listen(env.PORT, () => {
    console.log(`HelloMail démarré sur le port ${env.PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error('Échec du démarrage du serveur :', error);
  process.exit(1);
});
