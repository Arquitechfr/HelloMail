import express, { type Express } from 'express';

/**
 * Monte les body parsers JSON dans le bon ordre.
 *
 * Le parser 30 Mo pour l'envoi d'emails (pièces jointes base64) doit être
 * monté AVANT le parser global 100 Ko : body-parser pose `req._body` une fois
 * le body parsé, le parser global le sautera ensuite. Dans l'ordre inverse,
 * la limite 100 Ko rejetterait les envois avec pièces jointes (413) avant
 * d'atteindre le parser étendu.
 */
export function mountBodyParsers(app: Express): void {
  app.use('/api/accounts/:accountId/send', express.json({ limit: '30mb' }));
  app.use(express.json({ limit: '100kb' }));
}
