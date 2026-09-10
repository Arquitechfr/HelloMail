import { Request, Response } from 'express';
import { getLogo, extractDomain } from '../services/logo/logoService.js';

/**
 * Endpoint GET /api/logos/:domain
 * Récupère le logo officiel d'un domaine ou d'une adresse email.
 *
 * Headers retournés :
 * - Cache-Control longue durée pour le navigateur (7 jours)
 * - Content-Type adapté (image/png)
 * - 404 propre si aucun logo n'est trouvé, permettant le fallback frontend sur les initiales.
 */
export async function getLogoHandler(req: Request, res: Response): Promise<void> {
  const rawParam = req.params.domain;
  const domain = extractDomain(rawParam);

  if (!domain) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.status(404).json({ message: 'Domaine invalide ou introuvable' });
    return;
  }

  const logo = await getLogo(domain);

  if (!logo) {
    // Cache négatif côté serveur (Redis/mémoire), mais pas de cache persistant côté navigateur
    // pour que l'ajout d'un logo local ou une correction de configuration soit immédiatement visible.
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.status(404).json({ message: 'Logo introuvable' });
    return;
  }

  res.setHeader('Content-Type', logo.contentType);
  res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.status(200).send(logo.buffer);
}
