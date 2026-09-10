# AGENTS.md — Backend HelloMail

API REST pour la gestion de comptes email (IMAP/SMTP) avec chiffrement des identifiants.

## Stack

Node.js ESM + Express 4 + MongoDB/Mongoose 9 + Zod 4 + JWT (jsonwebtoken) + bcryptjs + AES-256-GCM (node:crypto) + ImapFlow + Nodemailer + isomorphic-dompurify + Helmet + pino/pino-http + express-rate-limit + ioredis + Vitest.

## Commandes

```bash
pnpm --filter backend dev         # tsx watch src/app.ts
pnpm --filter backend build       # tsc → dist/
pnpm --filter backend typecheck   # tsc --noEmit
pnpm --filter backend start       # node dist/app.js
pnpm --filter backend test          # vitest run (227 tests)
pnpm --filter backend test:coverage # vitest run --coverage (thresholds 80%/75%)
```

## Structure

```
src/
├── config/         env.ts (validation Zod fail-fast) + constants.ts (cookies, JWT, rate limit, SMTP timeout) + logger.ts (pino + redaction)
├── utils/          AppError, asyncHandler, cookieHelpers, projections (ACCOUNT_SAFE_PROJECTION)
├── middleware/      errorHandler, notFound, auth (requireAuth JWT + requireAuthSse), rateLimit (global + auth + send via express-rate-limit), validate (Zod), requestLogger (pino-http)
├── models/         User (minimal), RefreshToken (rotation + TTL), Account (multi-provider, hook pre-validate), Message (index textuel)
├── schemas/        commonSchemas, authSchemas, accountSchemas, messageSchemas (list/send/flags/move/batch/search), folderSchemas, draftSchemas
├── services/
│   ├── security/   encryptionService (AES-256-GCM, fail-fast si clé invalide)
│   ├── auth/       authService (register, login, refreshTokens, logout, generateTokens)
│   ├── email/      connectionTest, imapPool, sanitize, messageFetchService, attachmentService,
│   │               sendService, folderService, specialFolders, messageActionService, searchService, draftService
│   ├── realtime/   eventPublisher (Redis Pub/Sub worker→API), eventSubscriber (filtrage par userId)
│   └── accounts/   accountService (create, list, delete, toggle)
├── controllers/    authController, accountsController, messagesController, foldersController, draftsController, eventsController
├── routes/         authRoutes, accountsRoutes, messagesRoutes, foldersRoutes, draftsRoutes, eventsRoutes
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
- **Redis** : dépendance d'infrastructure pour le temps réel (SSE). `REDIS_URL` en env. Connexions lazy (publisher côté worker, subscriber côté API). Best-effort : une panne Redis ne stoppe pas la synchronisation.

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

## Tests (Phase 3 + 5)

- **Vitest** 5.0.0 + `@vitest/coverage-v8` + `mongodb-memory-server` + `supertest`.
- **227 tests** (22 fichiers). Coverage : 88.92% lignes, 77.14% branches, 83.56% fonctions, 87.35% statements.
- **Thresholds** : 80% lignes/fonctions/statements, 75% branches.
- **globalSetup.ts** : démarre un seul `MongoMemoryServer` partagé entre tous les fichiers d'intégration.
- **setup.ts** : `clearDb()` vide les collections entre les tests (préserve les index).
- **Tests unitaires** : encryption, mapper, validate, errorHandler, sanitize, imapPool, messageFetch, attachment, send, folder, messageAction, specialFolders, messageSchemas, searchService (parser + recherche), draftService, eventPublisher, eventSubscriber.
- **Tests d'intégration** : auth, accounts, messages, folders, drafts (Supertest + Express + mongodb-memory-server).
- **Mocks ImapFlow** : classe constructable (pas de arrow function), `vi.hoisted()` pour éviter les problèmes de hoisting Vitest.
- **Mocks ioredis** : classe constructable (pas de arrow function). `closeSubscriber()` en `beforeEach` pour recréer l'instance singleton.
- **Coverage exclusions** : tests, app bootstrap, worker bootstrap, env config, test setup, et modules sync worker (Phase 2, hors scope Phase 3).
- **fileParallelism: false** + **maxWorkers: 2** pour éviter les conflits MongoMemoryServer.

## Règles

- Aucun fichier > 300 lignes (350 max).
- Messages d'erreur en français.
- Jamais `req.body` dans les logs (contient des secrets en clair avant chiffrement).
- `toggleAccountActive` ne met à jour que `isActive` (schéma Zod strict).
- OAuth Google/Microsoft : structure seule dans `oauthConfig`, aucun flux implémenté (Phase 6).
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
