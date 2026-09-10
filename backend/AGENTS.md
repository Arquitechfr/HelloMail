# AGENTS.md — Backend HelloMail

API REST pour la gestion de comptes email (IMAP/SMTP) avec chiffrement des identifiants.

## Stack

Node.js ESM + Express 4 + MongoDB/Mongoose 9 + Zod 4 + JWT (jsonwebtoken) + bcryptjs + AES-256-GCM (node:crypto) + ImapFlow + Nodemailer + isomorphic-dompurify + Helmet + pino/pino-http + express-rate-limit + rate-limit-redis + ioredis + otplib + @simplewebauthn/server + qrcode + prom-client + Vitest.

## Commandes

```bash
pnpm --filter backend dev         # tsx watch src/app.ts
pnpm --filter backend build       # tsc → dist/
pnpm --filter backend typecheck   # tsc --noEmit
pnpm --filter backend start       # node dist/app.js
pnpm --filter backend test          # vitest run (404 tests, 43 fichiers)
pnpm --filter backend test:coverage # vitest run --coverage (thresholds 80%/75%)
```

## Structure

```
src/
├── config/         env.ts (validation Zod fail-fast) + constants.ts (cookies, JWT, rate limit, SMTP timeout) + logger.ts (pino + redaction)
├── utils/          AppError, asyncHandler, cookieHelpers, projections (ACCOUNT_SAFE_PROJECTION)
├── middleware/      errorHandler, notFound, auth (requireAuth JWT + requireAuthSse), rateLimit (global + auth + send via express-rate-limit + RedisStore Phase 7), validate (Zod), requestLogger (pino-http), metricsMiddleware (Prometheus instrumentation, Phase 6)
├── models/         User (2FA TOTP + WebAuthn, Phase 6, preferences Phase 9), RefreshToken (rotation + TTL), Account (multi-provider, hook pre-validate, OAuth Google & Microsoft XOAUTH2, signatures Phase 7), Message (inReplyTo, index textuel, indexes conversation, tags Phase 9, snoozedUntil Phase 9), Contact (index textuel + unique, Phase 6), Rule (moteur de tri, Phase 8), Tag (libellés colorés, Phase 9), Template (modèles d'emails & réponses types, Phase 9)
├── schemas/        commonSchemas, authSchemas (register, login, verify2FA, preferences Phase 9), accountSchemas (+ signature, autoconfig Phase 7), messageSchemas (list/send/flags/move/batch/search/fetchMore + receipt + snooze Phase 9), tagSchemas (Phase 9), templateSchemas (Phase 9), folderSchemas, draftSchemas, contactSchemas, ruleSchemas (Phase 8)
├── services/
│   ├── security/   encryptionService (AES-256-GCM, fail-fast si clé invalide)
│   ├── auth/       authService, twoFactorService (TOTP), webauthnService (passkeys), oauthService (Google XOAUTH2), microsoftOAuthService (Microsoft XOAUTH2, Phase 7)
│   ├── email/      connectionTest, imapPool (XOAUTH2 Google/Microsoft), sanitize, messageFetchService, attachmentService (PJ + stream RFC 822 .eml), threadService (regroupement inReplyTo + sujet), sendService (XOAUTH2 + MDN), receiptService (RFC 3798, Phase 8), ruleService (moteur de règles, Phase 8), tagService (gestion libellés & propagation cascade, Phase 9), snoozeService (mise en sommeil & boucle de réveil, Phase 9), folderService, specialFolders, messageActionService, searchService, draftService, fetchMoreService
│   ├── templates/  templateService (gestion modèles d'emails & réponses types, Phase 9)
│   ├── contacts/   contactService (CRUD + recherche/autocomplétion, Phase 6)
│   ├── observability/ metricsService (Prometheus prom-client, Phase 6)
│   ├── realtime/   eventPublisher (Redis Pub/Sub worker→API), eventSubscriber (filtrage par userId)
│   └── accounts/   accountService (create, list, delete, toggle, updateSignature Phase 7), autoconfigService (ISPDB / MX, Phase 7)
├── controllers/    authController (+ updatePreferences Phase 9), twoFactorController, oauthController (Google + Microsoft Phase 7), accountsController (signature, autoconfig Phase 7), messagesController (+ getRaw, getThread, sendReceipt, snooze Phase 9), tagsController (Phase 9), templatesController (Phase 9), rulesController (Phase 8), foldersController, draftsController, contactsController, healthController, eventsController
├── routes/         authRoutes (+ preferences Phase 9), twoFactorRoutes, accountsRoutes (+ autoconfig, signature Phase 7), messagesRoutes (+ raw, thread, receipt, snooze Phase 9), tagsRoutes (Phase 9), templatesRoutes (Phase 9), rulesRoutes (Phase 8), foldersRoutes, draftsRoutes, oauthRoutes (Google + Microsoft Phase 7), contactsRoutes, eventsRoutes
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

## Services email (Phase 6 & 7)

### fetchMoreService — Pagination arrière (Phase 6)

- `fetchMoreMessages(account, folder, lastUid, limit)` : fetch IMAP des messages plus anciens par UID range décroissant (PEEK respecté).
- Stocke les messages en base au fur et à mesure (upsert idempotent). `POST /api/accounts/:accountId/messages/fetch-more`.

### autoconfigService — Découverte paramètres email (Phase 7)

- `discoverEmailSettings(email)` : résolution automatique des serveurs IMAP/SMTP via base locale de domaines connus (`gmail.com`, `outlook.com`, `yahoo.com`, `orange.fr`, etc.), consultation Mozilla ISPDB XML (`autoconfig.thunderbird.net`), et résolution DNS MX fallback (`node:dns/promises`).
- Endpoint public authentifié : `GET /api/accounts/autoconfig?email=...`.

### microsoftOAuthService — OAuth Microsoft XOAUTH2 (Phase 7)

- Flux OAuth2 Microsoft Identity (scopes `offline_access`, `IMAP.AccessAsUser.All`, `SMTP.Send`).
- `exchangeCodeForTokens(code)` et `getValidMicrosoftAccessToken(account)`.
- Refresh token chiffré AES-256-GCM. Endpoints `/api/accounts/oauth/microsoft` et `/callback`.

### Signatures par compte (Phase 7)

- Champ `signature` (max 4000 car.) dans `Account`. Service `updateSignature(userId, accountId, signature)`.
- Endpoint `PATCH /api/accounts/:id/signature` avec validation Zod.

## Services contacts & observabilité (Phase 6)

### contactService — CRUD + autocomplétion
- Modèle `Contact` + index textuel + index unique `(userId, email)`. CRUD + recherche regex (limit 20).

### metricsService & healthController — Prometheus & Health
- `prom-client` v15, compteur requêtes, histogramme durées, jauges MongoDB/Redis/comptes.
- `GET /api/health` (enrichi MongoDB/Redis) + `GET /api/metrics` (Prometheus).
- `pollingSync` : connexion IMAP dédiée au polling des dossiers spéciaux.

## Sécurité & Performance

- **Chiffrement** : AES-256-GCM via node:crypto (`ENCRYPTION_KEY` 64 hex chars, IV 12 octets).
- **Refresh token** : cookie httpOnly (`sameSite: strict`, `path: /api/auth`). Rotation et détection de réutilisation.
- **Helmet** : activé, CSP désactivée (API REST), COEP désactivé pour pièces jointes.
- **Logger structuré** : `pino` + `pino-http` avec redaction des données sensibles.
- **Rate limiting distribué (Phase 7)** : `rateLimit.ts` avec `rate-limit-redis` (RedisStore) branché sur `ioredis` si disponible, avec fallback transparent in-memory. `globalRateLimit` (100 req/15 min), `authRateLimit` (10 req/15 min), `sendRateLimit` (20 req/min).
- **Typage strict (Dette D12 résolue)** : Zéro `as any` dans tout le backend. Typage strict Mongoose, Zod et Express.
- **JWT pinning** : `algorithms: ['HS256']` sur tous les `jwt.verify`.
- **trust proxy** : `app.set('trust proxy', 1)` en production.
- **CORS** : origin explicite `FRONTEND_URL` avec credentials.
- **Sanitization HTML** : `isomorphic-dompurify` sur tout corps de message.
- **Discipline PEEK** : `BODY.PEEK` systématique, `readOnly: true` en consultation.
- **Graceful shutdown** : fermeture propre API + worker (Mongo, Redis, pool IMAP).

## Modèles & Auth — conventions

- `select: false` sur les secrets (`passwordHash`, `encryptedPassword`, `encryptedRefreshToken`, `twoFactorSecret`).
- `timestamps: true` partout. Hook `pre('validate')` sur `Account`.
- User : 2FA TOTP (`twoFactorSecret`, `twoFactorBackupCodes`) et Passkeys WebAuthn (`webauthnCredentials`).
- Auth : Access token (15m) + Refresh token (30j en cookie). 2FA via token temporaire court si actif.
- Account : support provider `custom`, `google`, `microsoft` (XOAUTH2) + champ `signature`.

## Tests (Phases 3, 5, 6 & 7)

- **Vitest** 5.0.0 + `@vitest/coverage-v8` + `mongodb-memory-server` + `supertest`.
- **339 tests** (34 fichiers). Thresholds : 80% lignes/fonctions/statements, 75% branches.
- Nouveaux tests Phase 7 : `autoconfigService.test.ts`, `microsoftOAuthService.test.ts`, `accountSignature.test.ts`.
- Mocks propres : `ImapFlow`, `ioredis`, `otplib`, `rate-limit-redis` mockable / fallback.
- `fileParallelism: false` + `maxWorkers: 2` pour MongoMemoryServer.

## Règles

- Aucun fichier > 300 lignes (350 max).
- Messages d'erreur en français côté API.
- Jamais `req.body` dans les logs ni secrets en clair.
- Zéro `as any` toléré dans le code de production.
- OAuth : Google & Microsoft implémentés via XOAUTH2 (Phases 6 & 7).
- Variables d'env : schéma Zod dans `env.ts` + `.env`.
- Services agnostiques d'Express (pas de req/res).
- Libération systématique du pool IMAP en `finally`.
- Isolation des comptes par `userId` (accès non autorisé → 404).
- Événements Redis Pub/Sub sans métadonnées sensibles (pas de sujet ni corps).
