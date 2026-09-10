import fs from 'node:fs';
import path from 'node:path';
import Redis from 'ioredis';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

export interface LogoResult {
  buffer: Buffer;
  contentType: string;
}

interface MemoryCacheEntry {
  buffer?: Buffer;
  contentType?: string;
  is404?: boolean;
  expiresAt: number;
}

/** Cache mémoire in-process (domaine -> entrée). */
const memoryCache = new Map<string, MemoryCacheEntry>();
const MAX_MEMORY_ENTRIES = 1000;

/** TTL en millisecondes */
const TTL_SUCCESS_MS = 24 * 60 * 60 * 1000; // 24 heures
const TTL_404_MS = 2 * 60 * 60 * 1000;       // 2 heures
const TTL_REDIS_SEC = 7 * 24 * 60 * 60;     // 7 jours
const TTL_REDIS_404_SEC = 2 * 60 * 60;      // 2 heures

let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (env.NODE_ENV === 'test') {
    return null;
  }

  if (!redisClient) {
    try {
      redisClient = new Redis({
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD,
        maxRetriesPerRequest: 2,
        enableReadyCheck: true,
        lazyConnect: true,
      });

      redisClient.on('error', (err) => {
        logger.warn({ error: err.message }, 'Erreur Redis logoService (fallback mémoire actif)');
      });
    } catch {
      redisClient = null;
    }
  }

  return redisClient;
}

/**
 * Extrait et valide un nom de domaine depuis une adresse email ou un domaine brut.
 * Exemples : "billing@stripe.com" -> "stripe.com", "GITHUB.COM" -> "github.com".
 */
export function extractDomain(input?: string | null): string | null {
  if (!input || typeof input !== 'string') return null;

  let domain = input.trim().toLowerCase();

  // Enlever le protocole éventuel (ex: https://)
  domain = domain.replace(/^https?:\/\//i, '');

  // Si c'est une adresse email, prendre la partie après @
  const atIndex = domain.lastIndexOf('@');
  if (atIndex !== -1) {
    domain = domain.slice(atIndex + 1);
  }

  // Enlever le www. éventuel
  domain = domain.replace(/^www\./i, '');

  // Enlever les slashes de chemin (ex: example.com/page -> example.com)
  domain = domain.split('/')[0].trim();

  // Enlever le port éventuel (ex: example.com:8080 -> example.com)
  domain = domain.split(':')[0].trim();

  // Validation du format de domaine DNS (RFC 1035 / RFC 1123)
  // Rejette les localhost, IP locales ou domaines sans TLD
  const domainRegex = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
  if (!domainRegex.test(domain)) {
    return null;
  }

  return domain;
}

let resolvedPublishableKey: string | null = null;

/**
 * Retourne la clé publiable pour img.logo.dev.
 * Si l'utilisateur a configuré une clé secrète (sk_...), interroge l'API Logo.dev
 * pour récupérer automatiquement sa clé publiable correspondante (pk_...).
 */
export async function getPublishableKey(): Promise<string | null> {
  const token = env.LOGO_DEV_TOKEN?.trim();
  if (!token) return null;

  // Si c'est déjà une Publishable Key (pk_...)
  if (token.startsWith('pk_')) {
    return token;
  }

  // Si c'est une Secret Key (sk_...), on résout automatiquement la clé publiable
  if (token.startsWith('sk_')) {
    if (resolvedPublishableKey) return resolvedPublishableKey;

    try {
      const res = await fetch('https://api.logo.dev/search?q=google', {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = (await res.json()) as Array<{ logo_url?: string }>;
        const logoUrl = data?.[0]?.logo_url;
        if (logoUrl) {
          const parsed = new URL(logoUrl);
          const pk = parsed.searchParams.get('token');
          if (pk && pk.startsWith('pk_')) {
            resolvedPublishableKey = pk;
            logger.info({ pk }, 'Clé publiable Logo.dev résolue automatiquement depuis la clé secrète');
            return pk;
          }
        }
      }
    } catch (err) {
      logger.warn({ err }, 'Échec de la résolution de la clé publiable Logo.dev depuis sk_');
    }
  }

  return token;
}

function getLocalLogo(domain: string): LogoResult | null {
  const extensions = [
    { ext: '.png', type: 'image/png' },
    { ext: '.svg', type: 'image/svg+xml' },
    { ext: '.jpg', type: 'image/jpeg' },
    { ext: '.webp', type: 'image/webp' },
  ];

  const searchDirs = [
    path.resolve(process.cwd(), 'public/logos'),
    path.resolve(process.cwd(), 'backend/public/logos'),
  ];

  for (const dir of searchDirs) {
    for (const { ext, type } of extensions) {
      const filePath = path.join(dir, `${domain}${ext}`);
      try {
        if (fs.existsSync(filePath)) {
          const buffer = fs.readFileSync(filePath);
          return { buffer, contentType: type };
        }
      } catch {
        // Ignorer les erreurs d'accès disque
      }
    }
  }

  return null;
}

/**
 * Récupère le logo d'un domaine ou email depuis le cache ou Logo.dev.
 */
export async function getLogo(domainOrEmail: string): Promise<LogoResult | null> {
  const domain = extractDomain(domainOrEmail);
  if (!domain) {
    return null;
  }

  // 0. Vérification d'un logo local personnalisé (ex: public/logos/arquitech.fr.png)
  const localLogo = getLocalLogo(domain);
  if (localLogo) {
    return localLogo;
  }

  const now = Date.now();

  // 1. Vérification du cache mémoire in-process
  const memEntry = memoryCache.get(domain);
  if (memEntry && memEntry.expiresAt > now) {
    if (memEntry.is404) return null;
    if (memEntry.buffer && memEntry.contentType) {
      return { buffer: memEntry.buffer, contentType: memEntry.contentType };
    }
  }

  // 2. Vérification du cache Redis (best-effort)
  const redis = getRedisClient();
  const redisKey = `hellomail:logo:${domain}`;

  if (redis) {
    try {
      const cached = await redis.get(redisKey);
      if (cached) {
        if (cached === '404') {
          setMemoryCache(domain, { is404: true, expiresAt: now + TTL_404_MS });
          return null;
        }

        const colonIndex = cached.indexOf(':');
        if (colonIndex > 0) {
          const contentType = cached.slice(0, colonIndex);
          const base64 = cached.slice(colonIndex + 1);
          const buffer = Buffer.from(base64, 'base64');
          setMemoryCache(domain, { buffer, contentType, expiresAt: now + TTL_SUCCESS_MS });
          return { buffer, contentType };
        }
      }
    } catch (err) {
      logger.debug({ err }, 'Erreur lecture cache Redis logo');
    }
  }

  // 3. Récupération de la clé publiable Logo.dev (directe ou résolue depuis sk_)
  const token = await getPublishableKey();
  if (!token) {
    setMemoryCache(domain, { is404: true, expiresAt: now + TTL_404_MS });
    return null;
  }

  // 4. Appel de l'API Logo.dev d'après la documentation officielle :
  // Endpoint img.logo.dev avec token, format=png, size=128 et fallback=404
  const logoDevUrl = `https://img.logo.dev/${encodeURIComponent(domain)}?token=${encodeURIComponent(
    token,
  )}&size=128&format=png&fallback=404`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(logoDevUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'image/png,image/*;q=0.8',
        'User-Agent': 'HelloMail/1.0',
      },
    });
    clearTimeout(timeout);

    if (response.status === 200) {
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const contentType = response.headers.get('content-type') || 'image/png';

      // Mise en cache mémoire
      setMemoryCache(domain, { buffer, contentType, expiresAt: now + TTL_SUCCESS_MS });

      // Mise en cache Redis (best-effort)
      if (redis) {
        redis
          .set(redisKey, `${contentType}:${buffer.toString('base64')}`, 'EX', TTL_REDIS_SEC)
          .catch(() => {});
      }

      return { buffer, contentType };
    }

    if (response.status === 404) {
      const text = await response.text().catch(() => '');
      if (text.includes('invalid api token') || text.includes('publishable key')) {
        logger.error({ domain, text }, 'Erreur clé Logo.dev (clé publiable invalide ou manquante)');
        return null;
      }

      // Repli sur le domaine parent pour les sous-domaines (ex: notif.laposte.fr -> laposte.fr)
      const parts = domain.split('.');
      if (parts.length > 2) {
        const parentLogo = await getLogo(parts.slice(1).join('.'));
        if (parentLogo) {
          setMemoryCache(domain, { buffer: parentLogo.buffer, contentType: parentLogo.contentType, expiresAt: now + TTL_SUCCESS_MS });
          return parentLogo;
        }
      }

      setMemoryCache(domain, { is404: true, expiresAt: now + TTL_404_MS });
      if (redis) {
        redis.set(redisKey, '404', 'EX', TTL_REDIS_404_SEC).catch(() => {});
      }
      return null;
    }

    // Autres statuts (401, 403, 500)
    logger.warn({ status: response.status, domain }, 'Réponse inattendue de Logo.dev');
    setMemoryCache(domain, { is404: true, expiresAt: now + 10 * 60 * 1000 });
    return null;
  } catch (error) {
    logger.debug({ error, domain }, 'Erreur lors de la récupération du logo');
    setMemoryCache(domain, { is404: true, expiresAt: now + 5 * 60 * 1000 });
    return null;
  }
}

function setMemoryCache(key: string, entry: MemoryCacheEntry): void {
  if (memoryCache.size >= MAX_MEMORY_ENTRIES) {
    // Éviction du premier élément entré
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) memoryCache.delete(oldestKey);
  }
  memoryCache.set(key, entry);
}

/** Vide le cache mémoire (principalement utile pour les tests). */
export function clearLogoMemoryCache(): void {
  memoryCache.clear();
  resolvedPublishableKey = null;
}
