# AGENTS.md — Backend HelloMail

API REST pour la gestion de comptes email (IMAP/SMTP) avec chiffrement des identifiants.

## Stack

Node.js ESM + Express 4 + MongoDB/Mongoose 9 + Zod 4 + JWT (jsonwebtoken) + bcryptjs + AES-256-GCM (node:crypto) + ImapFlow + Nodemailer + isomorphic-dompurify + Vitest.

## Commandes

```bash
pnpm --filter backend dev         # tsx watch src/app.ts
pnpm --filter backend build       # tsc → dist/
pnpm --filter backend typecheck   # tsc --noEmit
pnpm --filter backend start       # node dist/app.js
pnpm --filter backend test          # vitest run (187 tests)
pnpm --filter backend test:coverage # vitest run --coverage (thresholds 80%/75%)
```

## Structure

```
src/
├── config/         env.ts (validation Zod fail-fast) + constants.ts (cookies, JWT, rate limit, SMTP timeout)
├── utils/          AppError, asyncHandler, cookieHelpers, projections (ACCOUNT_SAFE_PROJECTION)
├── middleware/      errorHandler, notFound, auth (requireAuth JWT), rateLimit (auth + send), validate (Zod)
├── models/         User (minimal), RefreshToken (rotation + TTL), Account (multi-provider, hook pre-validate), Message
├── schemas/        commonSchemas, authSchemas, accountSchemas, messageSchemas (list/send/flags/move/batch), folderSchemas
├── services/
│   ├── security/   encryptionService (AES-256-GCM, fail-fast si clé invalide)
│   ├── auth/       authService (register, login, refreshTokens, logout, generateTokens)
│   ├── email/      connectionTest, imapPool, sanitize, messageFetchService, attachmentService,
│   │               sendService, folderService, specialFolders, messageActionService
│   └── accounts/   accountService (create, list, delete, toggle)
├── controllers/    authController, accountsController, messagesController, foldersController
├── routes/         authRoutes, accountsRoutes, messagesRoutes, foldersRoutes
├── test/           globalSetup (MongoMemoryServer partagé), setup (clearDb)
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

## Sécurité

- **Chiffrement** : AES-256-GCM via node:crypto. Clé `ENCRYPTION_KEY` (64 hex chars) en env. IV aléatoire 12 octets par appel. Fail-fast si clé invalide.
- **Refresh token** : cookie httpOnly (`sameSite: strict`, `path: /api/auth`). Rotation à chaque refresh. Détection de réutilisation → révocation globale.
- **Rate limiting** : `authRateLimit` (10 req/15 min/IP) sur `/login` + `/register`. `sendRateLimit` (20 req/min/IP) sur `/send`. In-memory (Map). Dépend de `trust proxy` en prod. Bypass en mode test. Dette : migrer vers Redis si scaling horizontal.
- **trust proxy** : `app.set('trust proxy', 1)` en production. Suppose un seul hop de proxy (nginx direct). Ajuster si la chaîne grandit (usurpation d'IP via X-Forwarded-For).
- **CORS** : `cors({ origin: env.FRONTEND_URL, credentials: true })`. Origin explicite obligatoire avec credentials.
- **Sanitization HTML** : tout corps HTML d'email est sanitizé via `isomorphic-dompurify` avant envoi au frontend.
- **Pool IMAP** : `readOnly: true` pour la lecture (préserve `\Seen`). `BODY.PEEK` via ImapFlow. Verrou par compte.

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

## Tests (Phase 3)

- **Vitest** 5.0.0 + `@vitest/coverage-v8` + `mongodb-memory-server` + `supertest`.
- **187 tests** (16 fichiers). Coverage : 86.93% lignes, 75.52% branches, 89.21% fonctions, 87.82% statements.
- **Thresholds** : 80% lignes/fonctions/statements, 75% branches.
- **globalSetup.ts** : démarre un seul `MongoMemoryServer` partagé entre tous les fichiers d'intégration.
- **setup.ts** : `clearDb()` vide les collections entre les tests (préserve les index).
- **Tests unitaires** : encryption, mapper, validate, errorHandler, sanitize, imapPool, messageFetch, attachment, send, folder, messageAction, specialFolders, messageSchemas.
- **Tests d'intégration** : auth, accounts, messages, folders (Supertest + Express + mongodb-memory-server).
- **Mocks ImapFlow** : classe constructable (pas de arrow function), `vi.hoisted()` pour éviter les problèmes de hoisting Vitest.
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
