# AGENTS.md — Backend HelloMail

API REST pour la gestion de comptes email (IMAP/SMTP) avec chiffrement des identifiants.

## Stack

Node.js ESM + Express 4 + MongoDB/Mongoose 9 + Zod 4 + JWT (jsonwebtoken) + bcryptjs + AES-256-GCM (node:crypto) + ImapFlow + Nodemailer + isomorphic-dompurify + Helmet + pino/pino-http + express-rate-limit + ioredis + otplib + @simplewebauthn/server + qrcode + prom-client + Vitest.

## Commandes

```bash
pnpm --filter backend dev         # tsx watch src/app.ts
pnpm --filter backend build       # tsc → dist/
pnpm --filter backend typecheck   # tsc --noEmit
pnpm --filter backend start       # node dist/app.js
pnpm --filter backend test          # vitest run (323 tests, 31 fichiers)
pnpm --filter backend test:coverage # vitest run --coverage (thresholds 80%/75%)
```

## Structure

```
src/
├── config/         env.ts (validation Zod fail-fast) + constants.ts (cookies, JWT, rate limit, SMTP timeout) + logger.ts (pino + redaction)
├── utils/          AppError, asyncHandler, cookieHelpers, projections (ACCOUNT_SAFE_PROJECTION)
├── middleware/      errorHandler, notFound, auth (requireAuth JWT + requireAuthSse), rateLimit (global + auth + send via express-rate-limit), validate (Zod), requestLogger (pino-http), metricsMiddleware (Prometheus instrumentation, Phase 6)
├── models/         User (2FA TOTP + WebAuthn, Phase 6), RefreshToken (rotation + TTL), Account (multi-provider, hook pre-validate, OAuth Google XOAUTH2 Phase 6), Message (index textuel), Contact (index textuel + unique, Phase 6)
├── schemas/        commonSchemas, authSchemas (register, login, verify2FA Phase 6), accountSchemas, messageSchemas (list/send/flags/move/batch/search/fetchMore Phase 6), folderSchemas, draftSchemas, contactSchemas (Phase 6)
├── services/
│   ├── security/   encryptionService (AES-256-GCM, fail-fast si clé invalide)
│   ├── auth/       authService (register, login, refreshTokens, logout, generateTokens, 2FA challenge Phase 6), twoFactorService (TOTP + codes de secours, Phase 6), webauthnService (passkeys, Phase 6), oauthService (Google XOAUTH2, Phase 6)
│   ├── email/      connectionTest, imapPool (XOAUTH2 Phase 6), sanitize, messageFetchService, attachmentService,
│   │               sendService (XOAUTH2 Phase 6), folderService, specialFolders, messageActionService, searchService, draftService, fetchMoreService (pagination arrière, Phase 6)
│   ├── contacts/   contactService (CRUD + recherche/autocomplétion, Phase 6)
│   ├── observability/ metricsService (Prometheus prom-client, Phase 6)
│   ├── realtime/   eventPublisher (Redis Pub/Sub worker→API), eventSubscriber (filtrage par userId, isSubscriberConnected Phase 6)
│   └── accounts/   accountService (create, list, delete, toggle)
├── controllers/    authController, twoFactorController (Phase 6), oauthController (Phase 6), accountsController, messagesController (fetchMore Phase 6), foldersController, draftsController, contactsController (Phase 6), healthController (health enrichi + metrics, Phase 6), eventsController
├── routes/         authRoutes (+ 2FA Phase 6), twoFactorRoutes (Phase 6), accountsRoutes, messagesRoutes (+ fetchMore Phase 6), foldersRoutes, draftsRoutes, oauthRoutes (Phase 6), contactsRoutes (Phase 6), eventsRoutes
├── test/           globalSetup (MongoMemoryServer partagé), setup (clearDb)
└── app.ts          bootstrap Mongoose + Express + Helmet + pino-http + CORS + trust proxy + rate limit global + graceful shutdown + errorHandler
```

## Patterns

- **AppError** : toutes les erreurs métier héritent de `AppError` (utils/AppError.ts). Factory methods : `badRequest`, `unauthorized`, `notFound`, `conflict`, `unprocessable`, `tooManyRequests`.
- **errorHandler** : middleware centralisé en dernier. ZodError → 400 (avec `fieldErrors` détaillés), Mongoose ValidationError → 400, AppError → statusCode, sinon 500. Ne loggue jamais `req.body`.
- **asyncHandler** : wrapper générique qui élimine le try/catch dans les controllers. `router.post('/', asyncHandler(controller.create))`.
- **validate** : factory Zod pour body/params/query. Ne loggue que les issues Zod, jamais `req.body` brut. La `ZodError` est laissée passer au `errorHandler` (préserve les `fieldErrors` détaillés pour le frontend).
- **requireAuth** : middleware JWT au niveau route (pas au niveau montage dans app.ts). Pinning `algorithms: ['HS256']`.
- **requireAuthSse** : auth JWT via query param `?token=...` pour EventSource (ne supporte pas les headers custom). Même pinning HS256.
- **commonSchemas** : `emailSchema`, `passwordSchema`, `objectIdParamSchema` réutilisés entre authSchemas et accountSchemas.
- **ACCOUNT_SAFE_PROJECTION** : exclusion systématique des champs secrets (`encryptedPassword`, `encryptedRefreshToken`) des réponses API.

## Services email (Phase 3)

### imapPool — Pool IMAP API

- Pool lazy : une connexion `ImapFlow` par compte, créée à la demande.
- Verrou par compte (sérialise les accès concurrents sur un même compte).
- TTL d'inactivité 5 min → fermeture automatique des connexions inactives.
- `acquire(account)` → `ImapFlow` connecté. `release(accountId)` → libère le verrou.
- `closeAll()` pour shutdown propre.
- **Distinct du sync worker** : le worker a ses propres connexions, l'API a les siennes.

### sanitize — Sanitization HTML

- `isomorphic-dompurify` + `jsdom` pour neutraliser `<script>`, `javascript:`, event handlers, etc.
- Appliqué sur tout corps HTML d'email avant envoi au frontend.

### messageFetchService — Lecture d'un message

- `mailboxOpen(folder, { readOnly: true })` — lecture seule (préserve `\Seen`).
- `fetchOne` avec `BODY.PEEK` (via ImapFlow) — discipline PEEK maintenue.
- Retourne : envelope, headers (Buffer décodé), corps text/html, structure MIME, métadonnées PJ.
- Vérifie l'appartenance du compte (`userId`) avant tout accès.

### attachmentService — Streaming pièces jointes

- `client.download(uid, part, { uid: true })` → stream.
- Pipe vers la réponse Express via `PassThrough`.
- Libère le pool IMAP en fin de stream (finally).

### sendService — Envoi d'email

- Nodemailer avec `disableUrlAccess`/`disableFileAccess`, timeout SMTP 30s.
- `MailComposer` pour construire le raw MIME (RFC 822).
- Sauvegarde best-effort dans le dossier Sent détecté via `specialFolders.findSentFolder` (specialUse \\Sent + fallbacks).
- Une erreur de sauvegarde Sent ne fait pas échouer l'envoi SMTP.
- Rate limit : `sendRateLimit` (20 req/min/IP).

### folderService — CRUD dossiers IMAP

- `listFolders` (avec `status` pour compteurs), `createFolder`, `renameFolder`, `deleteFolder`.
- Invalide le cache `specialFolders` après toute modification (create/rename/delete).
- `findSpecialUseFolder` (legacy, préférer `specialFolders.findSpecialFolder`).

### specialFolders — Détection dossiers spéciaux

- Détection centralisée des dossiers \\Sent, \\Trash, \\Drafts, \\Junk, \\Archive.
- Stratégie : 1) flag `specialUse` IMAP, 2) fallback par nom (insensible à la casse, multilingue FR/EN).
- Cache par compte (TTL 5 min) — un seul `listFolders` résout tous les specialUse.
- `invalidateSpecialFolderCache(accountId)` après CRUD dossiers.
- Raccourcis : `findSentFolder`, `findTrashFolder`, `findDraftsFolder`, `findJunkFolder`, `findArchiveFolder`.

### messageActionService — Actions sur messages

- `updateFlags` : seen, flagged, answered (STORE ADD/REMOVE côté IMAP + sync DB).
- `deleteMessage` : déplace vers Trash (détecté via `findTrashFolder` + fallback "Trash") ou suppression permanente.
- `moveMessage` : déplace vers un dossier arbitraire.
- `markMessageAsJunk` : déplace vers Junk (détecté via `findJunkFolder` + fallback "Junk").
- `batchAction` : markRead, markUnread, flag, unflag, delete, move, markAsJunk (max 100 UIDs).
- Synchronise la base après chaque opération IMAP. Libère le pool en `finally`.

## Services email (Phase 5)

### searchService — Recherche de messages

- Index textuel MongoDB `{subject: 'text', 'from.address': 'text', 'to.address': 'text'}` avec poids (subject: 3, from: 2, to: 1).
- `parseSearchQuery(q)` : extrait les opérateurs (`from:alice`, `to:bob`, `subject:test`, `is:unread`/`is:read`/`is:flagged`/`is:unflagged`, `has:attachment`, `before:2026-01-01`, `since:2026-01-01`) et le texte libre restant.
- `searchMessages(account, query)` : combine `$text` (plein texte) + filtres structurés (folder, from, to, subject, seen, flagged, hasAttachments, since, before). Tri par score textuel si `$text`, sinon par date décroissante. Pagination via `skip`/`limit`.
- Les filtres explicites (query params) priment sur les opérateurs parsés de `q`.
- Les regex (`from`, `to`, `subject`) sont insensibles à la casse — l'index textuel ne gère pas les regex.

### draftService — Brouillons IMAP

- Stockage IMAP via `client.append(draftsPath, rawMime, ['\\Draft'])` dans le dossier Drafts.
- Dossier Drafts détecté via `specialFolders.findDraftsFolder` (specialUse \\Drafts + fallbacks) + fallback "Drafts".
- `saveDraft(account, input, existingUid?)` : création (append uniquement) ou modification (delete ancien + append nouveau).
- `deleteDraft(account, uid)` : suppression via `messageDelete(uid, { uid: true })`.
- `MailComposer` construit le raw MIME (RFC 822) avec `disableUrlAccess`/`disableFileAccess`.
- `append()` ne retourne pas toujours l'UID — le frontend doit refetch la liste si `uid` est absent.
- Réutilise `imapPool` avec release en `finally`. Vérifie l'appartenance du compte côté controller.

## Services realtime (Phase 5)

### eventPublisher — Publisher Redis Pub/Sub (worker→API)

- Publie sur le canal `hellomail:events` via `ioredis`.
- Types d'événements : `message:new`, `message:deleted`, `message:flags`, `account:syncError`.
- Les événements ne contiennent **jamais** de sujet/corps d'email (uniquement UID, folder, flags, errorMsg).
- Non bloquant : une erreur Redis n'interrompt pas la synchronisation (best-effort).
- Bypass en mode test (aucune connexion Redis).
- `closePublisher()` à appeler au shutdown du worker.

### eventSubscriber — Subscriber Redis (côté API)

- Une seule connexion Redis en mode subscribe (ne peut pas publier sur la même connexion).
- Filtrage par `userId` côté API (le canal Redis est global).
- `subscribeToUserEvents(userId, callback)` → retourne une fonction de désinscription.
- `closeSubscriber()` à appeler au shutdown de l'API.
- Nettoyage automatique des callbacks quand le client SSE se déconnecte.

## Services auth (Phase 6)

### twoFactorService — 2FA TOTP + codes de secours

- `otplib` pour la génération/vérification des codes TOTP (6 chiffres, 30s).
- Secret TOTP chiffré AES-256-GCM (stocké dans `User.twoFactorSecret`, `select: false`).
- Codes de secours : 10 codes à usage unique, hashés bcrypt (`User.twoFactorBackupCodes`).
- `enableTOTP(userId, token)` : vérifie le code, active 2FA, génère les codes de secours.
- `disable2FA(userId, password)` : vérifie le mot de passe, réinitialise tous les champs 2FA.
- `verifyBackupCode(userId, code)` : valide et consomme un code de secours.
- `verify2FALogin(userId, code)` : valide un code TOTP ou un code de secours pour le login.

### webauthnService — Passkeys WebAuthn

- `@simplewebauthn/server` v11 pour l'enregistrement et la vérification de passkeys.
- `generateRegistrationOptions(userId)` : options d'enregistrement (challenge, RP, user).
- `verifyRegistration(userId, response)` : vérifie la réponse d'enregistrement, stocke le credential.
- `generateLoginOptions(email)` : options de login (challenge, allowCredentials).
- `verifyLogin(response)` : vérifie l'assertion WebAuthn.
- Credentials stockés dans `User.webauthnCredentials` (id, publicKey, counter, transports, deviceType).

### oauthService — OAuth Google XOAUTH2

- Génération de l'URL d'autorisation Google (scope `https://mail.google.com/`).
- `exchangeCodeForTokens(code)` : échange le code contre access + refresh token.
- `getValidGoogleAccessToken(account)` : renouvelle l'access token expiré via le refresh token (cache + TTL).
- Refresh token chiffré AES-256-GCM dans `Account.oauthConfig.encryptedRefreshToken`.
- Intégré dans `syncManager` (IMAP XOAUTH2) et `sendService` (SMTP XOAUTH2 via Nodemailer OAuth2).
- Variables d'env : `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.

## Services email (Phase 6)

### fetchMoreService — Pagination arrière

- `fetchMoreMessages(account, folder, lastUid, limit)` : fetch IMAP des messages plus anciens par UID range décroissant.
- Utilise `client.fetch(searchRange, ...)` avec `uid: true` pour respecter la discipline PEEK.
- Stocke les messages en base au fur et à mesure (upsert idempotent).
- Endpoint `POST /api/accounts/:accountId/messages/fetch-more` avec validation Zod.

## Services contacts (Phase 6)

### contactService — CRUD + autocomplétion

- Modèle `Contact` (userId, name, email, phone, notes) + index textuel + index unique `(userId, email)`.
- `listContacts(userId)` : liste triée par nom.
- `createContact(userId, input)` : création avec vérification de doublon (409 si existe).
- `updateContact(userId, contactId, input)` : mise à jour avec vérification d'appartenance (404 si introuvable).
- `deleteContact(userId, contactId)` : suppression avec vérification d'appartenance.
- `searchContacts(userId, query)` : recherche par regex sur name + email (limit 20, autocomplétion).

## Services observability (Phase 6)

### metricsService — Métriques Prometheus

- `prom-client` v15 avec registry personnalisé (isolation des métriques HelloMail).
- Métriques par défaut Node.js (GC, event loop, memory) via `collectDefaultMetrics`.
- Compteur `hellomail_http_requests_total` (method, route, status).
- Histogramme `hellomail_http_request_duration_seconds` (method, route, status, buckets 5ms→10s).
- Jauges `hellomail_mongodb_connected`, `hellomail_redis_connected`, `hellomail_active_accounts`, `hellomail_imap_pool_size`.
- `getMetrics()` : retourne le texte Prometheus (async — `registry.metrics()` est une Promise en v15).

### metricsMiddleware — Instrumentation HTTP

- Enregistre le compteur + histogramme pour chaque requête (sur `res.on('finish')`).
- Normalise les routes : remplace les ObjectId (24 hex) et IDs numériques par `:id` (évite la cardinalité excessive).
- Monté dans `app.ts` avant les routes, après le rate limit global.

### healthController — Health check enrichi

- `GET /api/health` : retourne `{ status, uptime, version, node, services: { mongodb, redis } }`.
- HTTP 200 si MongoDB connecté, HTTP 503 si dégradé.
- Met à jour les jauges `mongodbConnectedGauge` et `redisConnectedGauge`.
- `GET /api/metrics` : expose les métriques Prometheus (Content-Type `text/plain; version=0.0.4`).

## Services sync (Phase 6)

### pollingSync — Polling multi-dossiers

- Seconde connexion IMAP dédiée au polling des dossiers spéciaux (Sent, Drafts, Trash, Junk, Archive).
- Tourne en parallèle de l'IDLE INBOX (pas de conflit — 2 connexions distinctes).
- Polling périodique avec intervalle configurable (`POLLING_INTERVAL_MS`, défaut 60s).
- Reconnexion avec backoff exponentiel en cas d'erreur.
- Arrêt propre via `AbortSignal` (intégré dans `syncManager.stop()`).
- Démarre après `runInitialSyncAll` et `reconcileAllFolders`.

## Sécurité

- **Chiffrement** : AES-256-GCM via node:crypto. Clé `ENCRYPTION_KEY` (64 hex chars) en env. IV aléatoire 12 octets par appel. Fail-fast si clé invalide.
- **Refresh token** : cookie httpOnly (`sameSite: strict`, `path: /api/auth`). Rotation à chaque refresh. Détection de réutilisation → révocation globale.
- **Helmet** : `helmet()` activé sur l'app Express. `contentSecurityPolicy: false` (API REST, pas de HTML rendu côté serveur). `crossOriginEmbedderPolicy: false` (compatibilité pièces jointes).
- **Logger structuré** : `pino` + `pino-http`. Redaction automatique des champs sensibles (`authorization`, `cookie`, `password`, `token`, `encryptedPassword`, `encryptedRefreshToken`, `req.body`). Logs JSON en production, prettifiés en développement. `LOG_LEVEL` configurable via env.
- **Rate limiting** : `globalRateLimit` (100 req/15 min/IP) sur toute l'API. `authRateLimit` (10 req/15 min/IP) sur `/login` + `/register`. `sendRateLimit` (20 req/min/IP) sur `/send`. Via `express-rate-limit` v7, headers `RateLimit-*` (draft-7). In-memory (Map). Dépend de `trust proxy` en prod. Bypass en mode test. Dette : migrer le store vers Redis si scaling horizontal.
- **JWT pinning** : `algorithms: ['HS256']` sur tous `jwt.verify` (auth + authService). Empêche l'algorithme confusion (RS256 → HS256).
- **trust proxy** : `app.set('trust proxy', 1)` en production. Suppose un seul hop de proxy (nginx direct). Ajuster si la chaîne grandit (usurpation d'IP via X-Forwarded-For).
- **CORS** : `cors({ origin: env.FRONTEND_URL, credentials: true })`. Origin explicite obligatoire avec credentials.
- **Sanitization HTML** : tout corps HTML d'email est sanitizé via `isomorphic-dompurify` avant envoi au frontend.
- **Pool IMAP** : `readOnly: true` pour la lecture (préserve `\Seen`). `BODY.PEEK` via ImapFlow. Verrou par compte.
- **Redis** : dépendance d'infrastructure pour le temps réel (SSE). Variables `REDIS_HOST` + `REDIS_PORT` + `REDIS_PASSWORD` (optionnel) en env. Connexions lazy (publisher côté worker, subscriber côté API). Best-effort : une panne Redis ne stoppe pas la synchronisation.

## Graceful shutdown (Phase 5)

- **API** (`app.ts`) : handler `SIGTERM`/`SIGINT` → `server.close()` + `imapPool.closeAll()` + `mongoose.disconnect()` + `closeSubscriber()`. Safety net de 10s pour forcer l'arrêt. Évite les arrêts multiples via flag `isShuttingDown`.
- **Worker** (`worker.ts`) : `accountRegistry.shutdown()` (stop tous les `SyncManager`) + `closePublisher()` + `mongoose.disconnect()`.
- Logs de shutdown via `logger` (pino), jamais `console.log`.

## Flow comptes

1. Test connexion IMAP + SMTP **avant** toute écriture en base (jamais de persistance d'identifiants non vérifiés).
2. Chiffrement du mot de passe IMAP (AES-256-GCM).
3. Persistence via `new Account()` + `.save()` (pour que le hook `pre('validate')` s'exécute).
4. `ACCOUNT_SAFE_PROJECTION` exclut toujours `encryptedPassword` et `encryptedRefreshToken` des réponses API.
5. Doublon `(userId, emailAddress)` → 409.

## Modèles — conventions

- `select: false` sur tous les champs secrets (`passwordHash`, `encryptedPassword`, `encryptedRefreshToken`, `twoFactorSecret` Phase 6).
- `timestamps: true` partout.
- Hook `pre('validate')` sur Account : cohérence provider ↔ config. Ne s'exécute que sur `new Model()` + `.save()`, **pas** sur `findOneAndUpdate`.
- `toggleAccountActive` ne met à jour que `isActive` via schéma Zod strict `{ isActive: boolean }` — aucun autre champ modifiable.
- User : `email` + `passwordHash` + 2FA (Phase 6) : `twoFactorEnabled`, `twoFactorSecret` (chiffré), `twoFactorBackupCodes` (bcrypt), `webauthnCredentials` (tableau).
- Contact (Phase 6) : index textuel `{name: 'text', email: 'text'}` + index unique `{userId, email}` (doublons interdits par utilisateur).

## Auth — conventions

- Access token : JWT `JWT_ACCESS_SECRET`, payload `{ sub, email }`, durée 15m.
- Refresh token : JWT `JWT_REFRESH_SECRET`, payload `{ sub, tokenId }`, durée 30j. Stocké en base (hash sha256) avec flag `revoked`.
- Rotation : à chaque `refreshTokens`, l'ancien token est révoqué + nouveau émis.
- Détection de vol : token révoqué réutilisé → révocation globale de tous les tokens de l'utilisateur.
- Refresh lu exclusivement depuis `req.cookies[COOKIE_REFRESH_TOKEN]` — jamais depuis le body.
- **2FA (Phase 6)** : si `twoFactorEnabled` est true, le login retourne `{ requiresTwoFactor: true, twoFactorTempToken }` au lieu des tokens complets. Le `twoFactorTempToken` est un JWT court signé `JWT_ACCESS_SECRET` limité au flux verify. `POST /api/auth/verify-2fa` valide le code TOTP ou un code de secours et émet les tokens complets.

## Tests (Phase 3 + 5 + 6)

- **Vitest** 5.0.0 + `@vitest/coverage-v8` + `mongodb-memory-server` + `supertest`.
- **323 tests** (31 fichiers). Thresholds : 80% lignes/fonctions/statements, 75% branches.
- **globalSetup.ts** : démarre un seul `MongoMemoryServer` partagé entre tous les fichiers d'intégration.
- **setup.ts** : `clearDb()` vide les collections entre les tests (préserve les index).
- **Tests unitaires** : encryption, mapper, validate, errorHandler, sanitize, imapPool, messageFetch, attachment, send, folder, messageAction, specialFolders, messageSchemas, searchService (parser + recherche), draftService, eventPublisher, eventSubscriber, twoFactorService (Phase 6), oauthService (Phase 6), fetchMoreService (Phase 6), pollingSync (Phase 6).
- **Tests d'intégration** : auth, auth2FA (Phase 6), accounts, messages, folders, drafts, contacts (Phase 6), health/metrics (Phase 6) (Supertest + Express + mongodb-memory-server).
- **Mocks ImapFlow** : classe constructable (pas de arrow function), `vi.hoisted()` pour éviter les problèmes de hoisting Vitest.
- **Mocks ioredis** : classe constructable (pas de arrow function). `closeSubscriber()` en `beforeEach` pour recréer l'instance singleton.
- **Mocks otplib** : mock de `authenticator.generateSecret` et `authenticator.verify` pour les tests 2FA (Phase 6).
- **Coverage exclusions** : tests, app bootstrap, worker bootstrap, env config, test setup, et modules sync worker (Phase 2, hors scope Phase 3).
- **fileParallelism: false** + **maxWorkers: 2** pour éviter les conflits MongoMemoryServer.

## Règles

- Aucun fichier > 300 lignes (350 max).
- Messages d'erreur en français.
- Jamais `req.body` dans les logs (contient des secrets en clair avant chiffrement).
- `toggleAccountActive` ne met à jour que `isActive` (schéma Zod strict).
- OAuth Google : implémenté via XOAUTH2 (Phase 6) — service OAuth + callback + refresh token chiffré + IMAP/SMTP. OAuth Microsoft : structure seule dans `oauthConfig`, non implémenté.
- Toute nouvelle variable d'env doit être ajoutée au schéma Zod dans `env.ts` ET au `.env`/`.env.example`.
- Les services ne connaissent pas Express (pas de req/res) — c'est le rôle des controllers.
- Discipline PEEK : `BODY.PEEK` obligatoire pour tout fetch de corps (ImapFlow le gère automatiquement).
- `readOnly: true` pour la lecture (préserve `\Seen`), `readOnly: false` pour les actions (flags, delete, move).
- Libération du pool IMAP en `finally` pour garantir la libération du verrou.
- Vérifier l'appartenance du compte (`userId`) avant tout accès aux messages/dossiers.
- Les comptes d'autrui retournent 404 (pas 403, pour éviter la fuite d'information).
- **Logger** : utiliser `logger` (pino) partout, jamais `console.log`/`console.error`. Redaction automatique des champs sensibles.
- **JWT** : toujours `algorithms: ['HS256']` sur `jwt.verify`.
- **Événements temps réel** : ne jamais inclure de sujet/corps d'email dans les payloads Redis (uniquement UID, folder, flags, errorMsg).
- **Redis best-effort** : une panne Redis ne doit jamais stopper la synchronisation — `publishEvent` catch ses erreurs.
- **SSE** : auth via `requireAuthSse` (token en query param). Mitigation future : token SSE à courte durée via endpoint dédié.
