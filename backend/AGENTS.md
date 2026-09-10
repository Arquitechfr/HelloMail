# AGENTS.md — Backend HelloMail

API REST pour la gestion de comptes email (IMAP/SMTP) avec chiffrement des identifiants.

## Stack

Node.js ESM + Express 4 + MongoDB/Mongoose 9 + Zod 4 + JWT (jsonwebtoken) + bcryptjs + AES-256-GCM (node:crypto).

## Commandes

```bash
pnpm --filter backend dev         # tsx watch src/app.ts
pnpm --filter backend build       # tsc → dist/
pnpm --filter backend typecheck   # tsc --noEmit
pnpm --filter backend start       # node dist/app.js
```

## Structure

```
src/
├── config/         env.ts (validation Zod fail-fast) + constants.ts (cookies, JWT, rate limit)
├── utils/          AppError, asyncHandler, cookieHelpers, projections (ACCOUNT_SAFE_PROJECTION)
├── middleware/      errorHandler, notFound, auth (requireAuth JWT), rateLimit, validate (Zod)
├── models/         User (minimal), RefreshToken (rotation + TTL), Account (multi-provider, hook pre-validate)
├── schemas/        commonSchemas (email/password/objectId réutilisables), authSchemas, accountSchemas
├── services/
│   ├── security/   encryptionService (AES-256-GCM, fail-fast si clé invalide)
│   ├── auth/       authService (register, login, refreshTokens, logout, generateTokens)
│   ├── email/      connectionTest (testImapConnection + testSmtpConnection, 422 si échec)
│   └── accounts/   accountService (create, list, delete, toggle)
├── controllers/    authController, accountsController (handlers minces via asyncHandler)
├── routes/         authRoutes, accountsRoutes (requireAuth au niveau route)
└── app.ts          bootstrap Mongoose + Express + CORS + trust proxy + errorHandler
```

## Patterns

- **AppError** : toutes les erreurs métier héritent de `AppError` (utils/AppError.ts). Factory methods : `badRequest`, `unauthorized`, `notFound`, `conflict`, `unprocessable`, `tooManyRequests`.
- **errorHandler** : middleware centralisé en dernier. ZodError → 400, Mongoose ValidationError → 400, AppError → statusCode, sinon 500. Ne loggue jamais `req.body`.
- **asyncHandler** : wrapper générique qui élimine le try/catch dans les controllers. `router.post('/', asyncHandler(controller.create))`.
- **validate** : factory Zod pour body/params/query. Ne loggue que les issues Zod, jamais `req.body` brut.
- **requireAuth** : middleware JWT au niveau route (pas au niveau montage dans app.ts).
- **commonSchemas** : `emailSchema`, `passwordSchema`, `objectIdParamSchema` réutilisés entre authSchemas et accountSchemas.
- **ACCOUNT_SAFE_PROJECTION** : exclusion systématique des champs secrets (`encryptedPassword`, `encryptedRefreshToken`) des réponses API.

## Sécurité

- **Chiffrement** : AES-256-GCM via node:crypto. Clé `ENCRYPTION_KEY` (64 hex chars) en env. IV aléatoire 12 octets par appel. Fail-fast si clé invalide.
- **Refresh token** : cookie httpOnly (`sameSite: strict`, `path: /api/auth`). Rotation à chaque refresh. Détection de réutilisation → révocation globale.
- **Rate limiting** : `authRateLimit` (10 req/15 min/IP) sur `/login` + `/register`. In-memory (Map). Dépend de `trust proxy` en prod. Bypass en mode test. Dette : migrer vers Redis si scaling horizontal.
- **trust proxy** : `app.set('trust proxy', 1)` en production. Suppose un seul hop de proxy (nginx direct). Ajuster si la chaîne grandit (usurpation d'IP via X-Forwarded-For).
- **CORS** : `cors({ origin: env.FRONTEND_URL, credentials: true })`. Origin explicite obligatoire avec credentials.

## Flow comptes

1. Test connexion IMAP + SMTP **avant** toute écriture en base (jamais de persistance d'identifiants non vérifiés).
2. Chiffrement du mot de passe IMAP (AES-256-GCM).
3. Persistence via `new Account()` + `.save()` (pour que le hook `pre('validate')` s'exécute).
4. `ACCOUNT_SAFE_PROJECTION` exclut toujours `encryptedPassword` et `encryptedRefreshToken` des réponses API.
5. Doublon `(userId, emailAddress)` → 409.

## Modèles — conventions

- `select: false` sur tous les champs secrets (`passwordHash`, `encryptedPassword`, `encryptedRefreshToken`).
- `timestamps: true` partout.
- Hook `pre('validate')` sur Account : cohérence provider ↔ config. Ne s'exécute que sur `new Model()` + `.save()`, **pas** sur `findOneAndUpdate`.
- `toggleAccountActive` ne met à jour que `isActive` via schéma Zod strict `{ isActive: boolean }` — aucun autre champ modifiable.
- User minimal : `email` + `passwordHash` uniquement (pas de firstName/lastName/role).

## Auth — conventions

- Access token : JWT `JWT_ACCESS_SECRET`, payload `{ sub, email }`, durée 15m.
- Refresh token : JWT `JWT_REFRESH_SECRET`, payload `{ sub, tokenId }`, durée 30j. Stocké en base (hash sha256) avec flag `revoked`.
- Rotation : à chaque `refreshTokens`, l'ancien token est révoqué + nouveau émis.
- Détection de vol : token révoqué réutilisé → révocation globale de tous les tokens de l'utilisateur.
- Refresh lu exclusivement depuis `req.cookies[COOKIE_REFRESH_TOKEN]` — jamais depuis le body.

## Règles

- Aucun fichier > 300 lignes (350 max).
- Messages d'erreur en français.
- Jamais `req.body` dans les logs (contient des secrets en clair avant chiffrement).
- `toggleAccountActive` ne met à jour que `isActive` (schéma Zod strict).
- OAuth Google/Microsoft : structure seule dans `oauthConfig`, aucun flux implémenté (Phase 2).
- Toute nouvelle variable d'env doit être ajoutée au schéma Zod dans `env.ts` ET au `.env`/`.env.example`.
- Les services ne connaissent pas Express (pas de req/res) — c'est le rôle des controllers.
