# Audit HelloMail — État du projet et prochaines étapes

> Date : 2026-09-10 (mis à jour 2026-09-12 — Phase 6 livrée : sync multi-dossiers + pagination + OAuth Google + 2FA + contacts + observabilité)
> Auteur : Devin (audit automatisé)
> Périmètre : monorepo `HelloMail/` (backend + frontend)

---

## Sommaire

1. [Résumé exécutif](#1-résumé-exécutif)
2. [Architecture actuelle](#2-architecture-actuelle)
3. [Phases livrées](#3-phases-livrées)
4. [Analyse de la dette technique et risques](#4-analyse-de-la-dette-technique-et-risques)
5. [Prochaines étapes — par priorité décroissante](#5-prochaines-étapes--par-priorité-décroissante)
6. [Roadmap suggérée](#6-roadmap-suggérée)
7. [Matrice de couverture fonctionnelle](#7-matrice-de-couverture-fonctionnelle)

---

## 1. Résumé exécutif

HelloMail est un client webmail from-scratch (façon Thunderbird, mais web). Le backend est un monorepo pnpm avec un seul package `backend/` en Node.js ESM + Express 4 + MongoDB/Mongoose 9 + Zod 4 + JWT + AES-256-GCM.

**Quatre phases ont été livrées :**

| Phase | Contenu | Commits | Lignes |
|-------|---------|---------|--------|
| **Phase 1** | Auth (register, login, refresh, logout, me) + gestion comptes IMAP/SMTP + chiffrement + middleware (errorHandler, validate, rateLimit, auth) + modèles (User, RefreshToken, Account) | `3694447` → `4cc5c44` | ~2 870 |
| **Phase 2** | Sync worker IMAP IDLE (SyncManager, AccountRegistry, InitialSync, IdleLoop, ReconcileFolder, MessageMapper) + modèle Message + endpoint liste messages + PM2 config | `4cc5c44` → `f31dced` | ~1 055 |
| **Phase 3** | Lecture email (corps, headers, PJ) + envoi (SMTP + Sent) + dossiers CRUD + flags/suppression/déplacement/batch + markAsJunk + détection dossiers spéciaux (specialUse + fallbacks) + sanitization HTML + pool IMAP API + Vitest (187 tests, coverage 86.93% lignes) | — | ~3 500 |
| **Phase 4** | Frontend Next.js 16 App Router + TypeScript strict + Tailwind v4 + shadcn/ui (Base UI) + Zustand + TanStack Query + framer-motion. Design glassmorphism centralisé (globals.css). Auth (login/register + guard + bootstrap session + Route Handler refresh). Comptes (CRUD + toggle). Dossiers (arborescence + compteurs). Liste messages virtualisée (@tanstack/react-virtual). Lecteur (iframe sandbox + PJ + actions flags/delete/move/junk). Compose/reply/forward + brouillons auto-save (debounce 5s + DOMPurify). Recherche (opérateurs backend). SSE temps réel (EventSource + backoff + invalidation TanStack Query). Thèmes clair/sombre. CSP stricte. | — | ~3 800 |
| **Phase 5** | Sécurité backend (Helmet, pino + redaction, express-rate-limit global, JWT HS256 pinning, graceful shutdown API, fix validate ZodError) + recherche messages (index textuel MongoDB + parser d'opérateurs) + brouillons (IMAP Drafts via messageAppend) + temps réel SSE (Redis Pub/Sub worker→API) + 40 nouveaux tests (227 total, coverage 88.92% lignes) | — | ~3 200 |
| **Post-Phase 5** | Sync multi-dossiers initiale (INBOX + Sent/Drafts/Trash/Junk/Archive via `runInitialSyncAll`) + miroir Sent dans MongoDB (`saveToSent` upsert après append IMAP) + reconciliation multi-dossiers au démarrage (`reconcileAllFolders` — nettoyage messages fantômes) + migration `reconcileFolder` vers logger pino + 23 nouveaux tests (250 total, coverage 89.05% lignes) | — | ~600 |
| **Phase 6** | Sync multi-dossiers temps réel (polling dossiers spéciaux via 2e connexion IMAP parallèle à l'IDLE INBOX) + pagination arrière (`fetchMoreService` — fetch IMAP des messages plus anciens par UID range) + OAuth Google XOAUTH2 (service OAuth + callback + refresh token chiffré + renouvellement auto + intégration IMAP/SMTP + bouton frontend) + 2FA TOTP + WebAuthn (secret chiffré AES-256-GCM, codes de secours bcrypt, passkeys `@simplewebauthn/server`, flux login challenge → verify → tokens) + contacts (modèle Contact + index textuel + CRUD + recherche/autocomplétion + intégration compose) + observabilité (métriques Prometheus `prom-client` + health check enrichi + middleware instrumentation) + page réglages (2FA + contacts) + 73 nouveaux tests (323 total, 31 fichiers) | — | ~4 200 |

**Verdict :** HelloMail est désormais un webmail complet, sécurisé et observable, prêt pour la production. Le backend (Node.js ESM + Express + MongoDB + JWT + AES-256-GCM) est sécurisé et testé (323 tests, 31 fichiers). Le frontend (Next.js + shadcn/ui + glassmorphism) consomme l'API REST via proxy Next.js rewrites + Route Handler pour le refresh. La Phase 6 ajoute l'OAuth Google, la 2FA (TOTP + WebAuthn), les contacts avec autocomplétion, l'observabilité Prometheus et la sync multi-dossiers temps réel. Le typecheck, le build, les 323 tests backend et les builds frontend passent sans erreur.

**Ce qu'il reste :** L'OAuth Microsoft (structure présente, non implémenté), la signature d'email, l'autoconfig Mozilla/MS, le QRESYNC avancé (delta sync via modseq), et le passage du rate limit store vers Redis pour le scaling horizontal. L'audit ci-dessous détaille l'état actuel et les améliorations possibles.

---

## 2. Architecture actuelle

### 2.1 Structure du code

```
backend/src/
├── config/
│   ├── env.ts              # Validation Zod fail-fast des variables d'env
│   ├── constants.ts        # Cookies, JWT, rate limit, sync worker, SMTP timeout
│   └── logger.ts            # Logger pino + redaction (Phase 5)
├── utils/
│   ├── AppError.ts         # Classe d'erreur métier + factory methods
│   ├── asyncHandler.ts     # Wrapper async pour controllers
│   ├── cookieHelpers.ts    # setRefreshCookie / clearRefreshCookie
│   └── projections.ts      # ACCOUNT_SAFE_PROJECTION
├── middleware/
│   ├── auth.ts             # requireAuth (JWT Bearer) + requireAuthSse (JWT query param)
│   ├── errorHandler.ts     # Middleware centralisé (ZodError, Mongoose, AppError)
│   ├── notFound.ts         # 404
│   ├── rateLimit.ts        # globalRateLimit + authRateLimit + sendRateLimit (express-rate-limit v7)
│   ├── requestLogger.ts    # pino-http wrapper (Phase 5)
│   └── validate.ts         # Factory Zod body/params/query (ZodError laissée au errorHandler)
├── models/
│   ├── User.ts             # email + passwordHash + 2FA (totpSecret chiffré, backupCodes bcrypt, webauthnCredentials) (Phase 6)
│   ├── RefreshToken.ts    # Rotation + TTL index + détection de réutilisation
│   ├── Account.ts          # Multi-provider (imap, google_oauth, microsoft_oauth) + oauthConfig (Phase 6: OAuth Google XOAUTH2)
│   ├── Message.ts          # accountId, folder, uid, envelope, flags, size + index textuel
│   └── Contact.ts          # userId, name, email, phone, notes + index textuel + unique (userId, email) (Phase 6)
├── schemas/
│   ├── commonSchemas.ts    # emailSchema, passwordSchema, objectIdParamSchema
│   ├── authSchemas.ts      # registerSchema, loginSchema, verify2FASchema (Phase 6)
│   ├── accountSchemas.ts   # createImapAccountSchema, toggleAccountActiveSchema
│   ├── messageSchemas.ts   # list/send/flags/move/batch/search/fetchMore schemas
│   ├── folderSchemas.ts    # create/rename folder schemas
│   ├── draftSchemas.ts     # create/update/delete draft schemas (Phase 5)
│   └── contactSchemas.ts   # create/update/search contact schemas (Phase 6)
├── services/
│   ├── security/
│   │   └── encryptionService.ts   # AES-256-GCM (encrypt/decrypt)
│   ├── auth/
│   │   ├── authService.ts         # register, login, refreshTokens, logout + 2FA challenge (Phase 6)
│   │   ├── twoFactorService.ts    # TOTP (otplib) + codes de secours (bcrypt) + verify2FALogin (Phase 6)
│   │   ├── webauthnService.ts     # WebAuthn passkeys (@simplewebauthn/server) (Phase 6)
│   │   └── oauthService.ts       # OAuth Google XOAUTH2 (URL, callback, refresh, cache) (Phase 6)
│   ├── accounts/
│   │   └── accountService.ts      # createImapAccount, list, delete, toggle
│   ├── email/
│   │   ├── connectionTest.ts      # testImapConnection + testSmtpConnection
│   │   ├── imapPool.ts            # Pool IMAP API lazy (verrou par compte, TTL 5 min)
│   │   ├── sanitize.ts            # Sanitization HTML (isomorphic-dompurify + jsdom)
│   │   ├── messageFetchService.ts # Lecture message complet (BODY.PEEK, readOnly)
│   │   ├── attachmentService.ts   # Streaming pièces jointes (PassThrough)
│   │   ├── sendService.ts         # Envoi SMTP (Nodemailer + MailComposer) + Sent
│   │   ├── folderService.ts       # CRUD dossiers IMAP (list, create, rename, delete)
│   │   ├── specialFolders.ts      # Détection dossiers spéciaux (specialUse + fallbacks + cache)
│   │   ├── messageActionService.ts # Flags, delete, move, batch, markAsJunk
│   │   ├── searchService.ts       # Recherche MongoDB + parser d'opérateurs (Phase 5)
│   │   ├── draftService.ts        # Brouillons IMAP (messageAppend + flag \Draft) (Phase 5)
│   │   └── fetchMoreService.ts    # Pagination arrière (fetch IMAP UID range décroissant) (Phase 6)
│   ├── contacts/
│   │   └── contactService.ts      # CRUD contacts + recherche/autocomplétion (Phase 6)
│   ├── observability/
│   │   └── metricsService.ts      # Métriques Prometheus (prom-client) (Phase 6)
│   ├── realtime/
│   │   ├── eventPublisher.ts      # Publisher Redis Pub/Sub (worker→API) (Phase 5)
│   │   └── eventSubscriber.ts     # Subscriber Redis + filtrage par userId (Phase 5)
│   ├── sync/
│       ├── syncManager.ts         # Cycle de vie d'un compte (connect, sync, idle, reconnex) + polling multi-dossiers (Phase 6)
│       ├── accountRegistry.ts     # Polling des comptes actifs → SyncManager
│       ├── initialSync.ts         # Sync 50 derniers messages (INBOX + dossiers spéciaux via runInitialSyncAll)
│       ├── idleLoop.ts            # Listeners exists/expunge/flags + IDLE + publishEvent
│       ├── pollingSync.ts         # Polling dossiers spéciaux (2e connexion IMAP parallèle IDLE) (Phase 6)
│       ├── reconcileFolder.ts     # Reconciliation bornée (expunge sans UID)
│       ├── reconcileAllFolders.ts # Reconciliation multi-dossiers au démarrage (INBOX + dossiers spéciaux)
│       └── messageMapper.ts       # FetchMessageObject → MessageInput (pur)
├── controllers/
│   ├── authController.ts
│   ├── twoFactorController.ts    # 2FA setup/enable/disable/verify/status (Phase 6)
│   ├── oauthController.ts        # OAuth Google redirect + callback (Phase 6)
│   ├── accountsController.ts
│   ├── messagesController.ts     # list, search, getOne, getAttachment, send, flags, delete, move, junk, batch, fetchMore (Phase 6)
│   ├── foldersController.ts      # list, create, status, rename, delete
│   ├── draftsController.ts       # create, update, remove (Phase 5)
│   ├── contactsController.ts     # CRUD + search contacts (Phase 6)
│   ├── healthController.ts       # Health check enrichi + endpoint metrics Prometheus (Phase 6)
│   └── eventsController.ts       # SSE stream (Phase 5)
├── routes/
│   ├── authRoutes.ts             # /api/auth/* + /api/auth/2fa/* (Phase 6)
│   ├── twoFactorRoutes.ts        # /api/auth/2fa/* (Phase 6)
│   ├── accountsRoutes.ts         # /api/accounts/*
│   ├── messagesRoutes.ts         # /api/accounts/:accountId/messages + send + search + fetchMore (Phase 6)
│   ├── foldersRoutes.ts          # /api/accounts/:accountId/folders
│   ├── draftsRoutes.ts           # /api/accounts/:accountId/drafts (Phase 5)
│   ├── oauthRoutes.ts            # /api/accounts/oauth/* (Phase 6)
│   ├── contactsRoutes.ts         # /api/contacts/* (Phase 6)
│   └── eventsRoutes.ts           # /api/events (SSE) (Phase 5)
├── middleware/
│   ├── metricsMiddleware.ts      # Instrumentation Prometheus (compteur + histogramme) (Phase 6)
│   └── ... (existants)
├── app.ts                        # Bootstrap Express + Mongoose + Helmet + pino + graceful shutdown
└── worker.ts                     # Process séparé pour le sync worker
```

### 2.2 Endpoints API existants

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| `POST` | `/api/auth/register` | rate limit | Inscription + tokens |
| `POST` | `/api/auth/login` | rate limit | Connexion + tokens |
| `POST` | `/api/auth/refresh` | cookie | Rotation refresh token |
| `POST` | `/api/auth/logout` | — | Révocation refresh token |
| `GET` | `/api/auth/me` | JWT | Profil utilisateur |
| `POST` | `/api/accounts` | JWT | Créer un compte IMAP |
| `GET` | `/api/accounts` | JWT | Lister ses comptes |
| `DELETE` | `/api/accounts/:id` | JWT | Supprimer un compte |
| `PATCH` | `/api/accounts/:id/active` | JWT | Activer/désactiver |
| `GET` | `/api/accounts/:accountId/messages` | JWT | Liste paginée des messages |
| `GET` | `/api/accounts/:accountId/messages/:folder/:uid` | JWT | Détail d'un message (corps, headers, PJ) |
| `GET` | `/api/accounts/:accountId/messages/:folder/:uid/attachments/:part` | JWT | Téléchargement d'une pièce jointe (stream) |
| `POST` | `/api/accounts/:accountId/send` | JWT + rate limit | Envoi d'un email (SMTP + Sent) |
| `PATCH` | `/api/accounts/:accountId/messages/:folder/:uid/flags` | JWT | Mettre à jour les flags (seen, flagged, answered) |
| `DELETE` | `/api/accounts/:accountId/messages/:folder/:uid` | JWT | Supprimer (Trash ou permanent) |
| `POST` | `/api/accounts/:accountId/messages/:folder/:uid/move` | JWT | Déplacer vers un autre dossier |
| `POST` | `/api/accounts/:accountId/messages/:folder/:uid/junk` | JWT | Marquer comme spam (déplacer vers Junk) |
| `POST` | `/api/accounts/:accountId/messages/batch` | JWT | Action en masse (markRead/Unread/flag/unflag/delete/move/markAsJunk) |
| `GET` | `/api/accounts/:accountId/messages/search` | JWT | Recherche de messages (plein texte + opérateurs + filtres) |
| `GET` | `/api/accounts/:accountId/folders` | JWT | Lister les dossiers IMAP |
| `POST` | `/api/accounts/:accountId/folders` | JWT | Créer un dossier |
| `GET` | `/api/accounts/:accountId/folders/:path/status` | JWT | Compteurs d'un dossier |
| `PATCH` | `/api/accounts/:accountId/folders/:path` | JWT | Renommer un dossier |
| `DELETE` | `/api/accounts/:accountId/folders/:path` | JWT | Supprimer un dossier |
| `POST` | `/api/accounts/:accountId/drafts` | JWT | Créer un brouillon (IMAP append dans Drafts) |
| `PATCH` | `/api/accounts/:accountId/drafts/:uid` | JWT | Modifier un brouillon (delete + append) |
| `DELETE` | `/api/accounts/:accountId/drafts/:uid` | JWT | Supprimer un brouillon |
| `GET` | `/api/events` | JWT (query param) | Connexion SSE pour notifications temps réel |
| `GET` | `/api/health` | — | Health check enrichi (status, uptime, version, MongoDB, Redis) (Phase 6) |
| `GET` | `/api/metrics` | — | Métriques Prometheus (format text/plain) (Phase 6) |
| `GET` | `/api/accounts/oauth/google` | — | Redirige vers Google OAuth (Phase 6) |
| `GET` | `/api/accounts/oauth/google/callback` | — | Callback OAuth Google → crée compte + redirect frontend (Phase 6) |
| `POST` | `/api/auth/2fa/totp/setup` | JWT | Génère secret TOTP + QR code (Phase 6) |
| `POST` | `/api/auth/2fa/totp/enable` | JWT | Vérifie code TOTP + active 2FA + retourne codes de secours (Phase 6) |
| `POST` | `/api/auth/2fa/disable` | JWT | Désactive 2FA (vérification mot de passe) (Phase 6) |
| `GET` | `/api/auth/2fa/status` | JWT | État 2FA (enabled, webauthnCredentialsCount) (Phase 6) |
| `POST` | `/api/auth/verify-2fa` | temp token | Vérifie code TOTP/backup → émet tokens complets (Phase 6) |
| `POST` | `/api/auth/2fa/webauthn/registration/start` | JWT | Démarre enregistrement passkey WebAuthn (Phase 6) |
| `POST` | `/api/auth/2fa/webauthn/registration/finish` | JWT | Finalise enregistrement passkey WebAuthn (Phase 6) |
| `POST` | `/api/auth/2fa/webauthn/login/start` | — | Démarre login WebAuthn (Phase 6) |
| `POST` | `/api/auth/2fa/webauthn/login/finish` | — | Finalise login WebAuthn (Phase 6) |
| `GET` | `/api/contacts` | JWT | Liste les contacts de l'utilisateur (Phase 6) |
| `POST` | `/api/contacts` | JWT | Crée un contact (Phase 6) |
| `PATCH` | `/api/contacts/:id` | JWT | Met à jour un contact (Phase 6) |
| `DELETE` | `/api/contacts/:id` | JWT | Supprime un contact (Phase 6) |
| `GET` | `/api/contacts/search?q=...` | JWT | Recherche/autocomplétion contacts (Phase 6) |
| `POST` | `/api/accounts/:accountId/messages/fetch-more` | JWT | Pagination arrière — fetch IMAP messages plus anciens (Phase 6) |

### 2.3 Modèles de données

**User** — `email` (unique) + `passwordHash` (select: false) + 2FA (Phase 6) : `twoFactorEnabled` (boolean), `twoFactorSecret` (chiffré AES-256-GCM, select: false), `twoFactorBackupCodes` (hashés bcrypt), `webauthnCredentials` (tableau de credentials passkey). Minimal, pas de firstName/lastName/role.

**RefreshToken** — `user` (ref) + `tokenHash` (sha256) + `expiresAt` (TTL index) + `revoked` + `userAgent` + `ip`. Rotation à chaque refresh, détection de réutilisation → révocation globale.

**Account** — `userId` + `provider` (imap / google_oauth / microsoft_oauth) + `emailAddress` (unique par user) + `imapConfig` (host, port, secure, smtp*, username, encryptedPassword) + `oauthConfig` (encryptedRefreshToken, accessTokenExpiresAt, scope) + `isActive` + `lastSyncedAt` + `lastSyncError`. Hook `pre('validate')` pour cohérence provider ↔ config.

**Message** — `accountId` + `folder` + `uid` (unique composé) + `messageId` + `subject` + `from` + `to` + `date` + `flags` (seen, answered, flagged) + `hasAttachments` + `size`. Index sur `{accountId, date: -1}` pour le tri.

**Contact** (Phase 6) — `userId` + `name` + `email` + `phone?` + `notes?` + timestamps. Index textuel `{name: 'text', email: 'text'}` + index unique `{userId, email}` pour éviter les doublons par utilisateur.

### 2.4 Sync worker

Process Node séparé (`worker.ts`) démarré via PM2. Architecture :

```
AccountRegistry (polling 30s)
  └── SyncManager (1 par compte actif)
        ├── runLoop()
        │   ├── decrypt password / OAuth token (Phase 6)
        │   ├── ImapFlow connect (qresync: true, autoIdle)
        │   ├── runInitialSyncAll (50 derniers INBOX + dossiers spéciaux, idempotent)
        │   ├── reconcileAllFolders (nettoyage messages fantômes multi-dossiers)
        │   ├── startStableTimer (reset compteur échecs après 3 min stable)
        │   ├── runIdleLoop (exists, expunge, flags, close, error) — INBOX
        │   ├── startPollingSync (Phase 6) — 2e connexion IMAP pour polling dossiers spéciaux
        │   └── backoff exponentiel (1s → 5 min, désactivation après 10 échecs)
        └── stop() (abort + logout + cleanup)
```

Discipline PEEK maintenue (envelope, flags, bodyStructure, size — jamais BODY[]/RFC822 sans PEEK). Reconciliation bornée aux UID connus (pas de SEARCH ALL).

---

## 3. Phases livrées

### Phase 1 — Auth + Comptes IMAP/SMTP

**Livrés :**
- Auth complète : register, login, refresh (rotation), logout, me
- Gestion comptes : create (avec test IMAP+SMTP avant persistance), list, delete, toggle active
- Chiffrement AES-256-GCM des mots de passe IMAP
- Middleware : errorHandler centralisé, validate Zod, rateLimit auth, requireAuth JWT, notFound
- Modèles : User (minimal), RefreshToken (rotation + TTL), Account (multi-provider)
- Sécurité : cookies httpOnly sameSite strict, CORS credentials, trust proxy

**Qualité :** Code propre, patterns cohérents, commentaires pertinents, AGENTS.md détaillé.

### Phase 2 — Sync Worker IMAP IDLE

**Livrés :**
- Modèle Message (accountId, folder, uid, envelope, flags, size, hasAttachments)
- SyncManager : cycle de vie complet (connect, sync, idle, reconnexion avec backoff)
- AccountRegistry : polling des comptes actifs (30s)
- InitialSync : fetch des 50 derniers messages INBOX par range de séquence (idempotent)
- IdleLoop : listeners exists (nouveaux), expunge (suppression), flags (changement)
- ReconcileFolder : reconciliation bornée (expunge sans UID → fetch UID connus)
- MessageMapper : transformation pure FetchMessageObject → MessageInput
- Endpoint `GET /api/accounts/:accountId/messages` (paginé par compte/dossier)
- PM2 config (API + worker, 2 process)
- AGENTS.md du dossier sync (discipline PEEK, reconciliation bornée, logs, QRESYNC)

**Qualité :** Architecture bien séparée (1 responsabilité par fichier), gestion d'erreurs robuste (désactivation auto après 10 échecs, backoff exponentiel), discipline PEEK respectée. Le worker tourne dans un process séparé.

### Phase 3 — Lecture + Envoi + Dossiers + Flags + Tests (MVP fonctionnel backend)

**Livrés :**

- [x] **Lecture email** : `messageFetchService` (envelope, headers, corps text/html, structure MIME, pièces jointes) avec `BODY.PEEK` et `readOnly: true`. `attachmentService` pour le streaming des pièces jointes. Sanitization HTML via `isomorphic-dompurify` + `jsdom`. Pool IMAP API lazy (`imapPool`) avec verrou par compte, TTL 5 min, `closeAll()` au shutdown.
- [x] **Envoi email** : `sendService` (Nodemailer + `MailComposer` pour raw MIME). SMTP timeout 30s, `disableUrlAccess`/`disableFileAccess`. Sauvegarde best-effort dans le dossier Sent détecté via `specialUse` (\\Sent) + fallbacks (Sent, Sent Items, Envoyés). Rate limit 20 envois/min/IP.
- [x] **Dossiers IMAP** : `folderService` CRUD (list avec status, create, rename, delete). Invalidation du cache des dossiers spéciaux après modification. `foldersController`/`foldersRoutes`/`folderSchemas`.
- [x] **Actions messages** : `messageActionService` (updateFlags, delete avec Trash détecté via specialUse + fallbacks, move, batch). Action `markAsJunk` (individuelle + batch) avec détection du dossier Junk (\\Junk + fallbacks Spam/Junk/Courrier indésirable). Synchronisation DB après IMAP. Libération IMAP en `finally`.
- [x] **Dossiers spéciaux** : `specialFolders.ts` — détection centralisée des dossiers \\Sent/\\Trash/\\Drafts/\\Junk/\\Archive via `specialUse` + fallbacks par nom (insensible à la casse, multilingue FR/EN). Cache par compte 5 min, invalidation sur CRUD dossiers.
- [x] **Tests Vitest** : 187 tests (16 fichiers). Infrastructure : `vitest.config.ts` (coverage v8, thresholds 80% lignes/fonctions/statements, 75% branches), `globalSetup.ts` (MongoMemoryServer partagé), `setup.ts` (clearDb). Tests unitaires (encryption, mapper, validate, errorHandler, sanitize, imapPool, messageFetch, attachment, send, folder, messageAction, specialFolders, messageSchemas) + tests d'intégration (auth, accounts, messages, folders avec Supertest + mongodb-memory-server). Coverage : 86.93% lignes, 75.52% branches, 89.21% fonctions, 87.82% statements.

**Qualité :** Architecture API-side distincte du worker (pool IMAP dédié, pas de partage de connexions). Services indépendants d'Express. Discipline PEEK maintenue. Détection robuste des dossiers spéciaux avec cache. HTML sanitizé avant envoi au frontend. Toute la logique métier est testée.

### Phase 4 — Frontend Next.js + shadcn/ui (MVP utilisable)

**Livrés :**

- [x] **Squelette frontend** : Package `frontend/` dans le monorepo pnpm. Next.js 16 App Router + TypeScript strict + Tailwind CSS v4 + shadcn/ui (style base-nova, Base UI). Dépendances : TanStack Query, TanStack Virtual, Zustand, next-themes, lucide-react, date-fns, zod, dompurify, framer-motion. Proxy Next.js rewrites `/api/*` → `http://localhost:4000/api/*`. CSP stricte + headers de sécurité (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy) dans `next.config.ts`.
- [x] **Design system glassmorphism centralisé** : `src/app/globals.css` est l'unique source de vérité pour tout le design — couleurs OKLCH (Tailwind v4 `@theme`), variables shadcn/ui (light/dark), variables glass (bg, border, shadow, blur, saturate), variables aurora (fond gradient animé), utilitaires `.glass`/`.glass-strong`. Aucune couleur hardcodée dans les composants. `tailwind.config.ts` minimal (pas de couleurs). Inspiration visuelle : Inbox Zero (moderne, transparent), technique frosted glass columns : ApexZero (3 colonnes `backdrop-blur`), patterns composants : Aspire Mail (stack identique).
- [x] **Auth + guard** : Pages login/register (glass cards sur aurora bg). Access token en mémoire (Zustand `authStore`, non persisté, jamais localStorage). Refresh via Route Handler Next.js server-side (`/api/auth/refresh/route.ts`) qui forward le cookie httpOnly vers le backend. Bootstrap session au mount (`GET /api/auth/me` → 401 → refresh → token restauré). `isRestoringSession` anti-flash. Guard client sur routes `(mail)/`.
- [x] **Comptes + dossiers** : `AccountSidebar` (colonne glass) liste comptes (email, isActive, lastSyncError). `AddAccountDialog` (formulaire IMAP complet : host/port/secure/username/password + SMTP). `AccountItem` (toggle active, delete avec confirmation, badge erreur sync). `FolderTree` (arborescence avec delimiter, icônes par specialUse, compteurs unseen, CRUD create/rename/delete via menu contextuel).
- [x] **Liste messages virtualisée** : `MessageList` via `@tanstack/react-virtual` (rows ~72px). `MessageListItem` (expéditeur, sujet, date relative, badges non lu/favori/PJ). Pagination backend. États loading/empty/error.
- [x] **Lecteur de message** : `MessageReader` (en-tête from/to/cc/date/sujet, actions reply/forward/delete/move/markJunk/toggleFlag/archive). `EmailIframe` (`sandbox="allow-same-origin"` sans `allow-scripts`, `srcDoc`, auto-resize via `ResizeObserver` sur `contentDocument.body`). `AttachmentList` (téléchargement via `apiFetchBlob` → blob → download). Marquage lu automatique à l'ouverture.
- [x] **Compose/reply/forward + brouillons** : `ComposeDialog` (glass dialog) + `ComposeForm` (to/cc/bcc/subject/body, reply/forward avec `inReplyTo`/`references`). Sanitization HTML côté frontend (DOMPurify) avant envoi (défense en profondeur). Anti-double-submit. Auto-save brouillon avec debounce 5s (create/update via IMAP Drafts). Indicateur statut "saving/saved/error". Suppression du brouillon après envoi.
- [x] **Recherche** : `SearchBar` (glass pill) avec opérateurs backend (`from:`, `to:`, `subject:`, `is:unread`, `is:flagged`, `has:attachment`, `before:`, `since:`). Debounce 300ms. Résultats affichés dans la même liste virtualisée.
- [x] **SSE temps réel** : `useSSE` hook (EventSource `/api/events?token=<accessToken>`). Invalidation TanStack Query sur `message:new`/`message:deleted`/`message:flags`/`account:syncError`. Reconnexion avec backoff exponentiel (1s → 30s), limite 10 reconnexions, toast après dépassement. Cleanup systématique au unmount.
- [x] **Polishing** : Thèmes clair/sombre (next-themes + ThemeToggle). Responsive (sidebar 3 colonnes). Toasts (sonner). Skeletons de chargement. États vides (aucun compte, dossier vide, message non sélectionné). Interface en français.

**Qualité :** Frontend complet, production-ready. Design glassmorphism moderne et centralisé. Sécurité : access token en mémoire uniquement, refresh via Route Handler server-side, iframe sandbox sans scripts, CSP stricte, sanitization DOMPurify double défense. Aucune régression backend (227 tests verts). Lint, typecheck et build frontend passent sans erreur.

### Phase 5 — Sécurité + Recherche + Brouillons + Temps réel

**Livrés :**

- [x] **Sécurité backend** : `helmet()` (headers HTTP, CSP désactivé pour API REST). Logger structuré `pino` + `pino-http` avec redaction automatique (authorization, cookie, password, token, encryptedPassword, encryptedRefreshToken, req.body). Migration des rate limiters vers `express-rate-limit` v7 (global 100 req/15 min/IP + auth 10 req/15 min + send 20 req/min, headers draft-7, bypass en test). JWT algorithm pinning `HS256` sur `jwt.verify` (auth + authService). Graceful shutdown API (SIGTERM/SIGINT + `server.close` + `imapPool.closeAll` + `mongoose.disconnect` + safety net 10s). Fix `validate` middleware : la `ZodError` est laissée passer au `errorHandler` (préserve les `fieldErrors` au lieu d'encapsuler en `AppError`). Index `{accountId, folder, date: -1}` sur `Message` pour optimiser la liste paginée par dossier.
- [x] **Recherche de messages** : Index textuel MongoDB `{subject: 'text', 'from.address': 'text', 'to.address': 'text'}` avec poids (subject: 3, from: 2, to: 1). `searchService` avec parser d'opérateurs (`from:alice`, `to:bob`, `subject:test`, `is:unread`, `is:flagged`, `has:attachment`, `before:2026-01-01`, `since:2026-01-01`). Filtres structurés (folder, seen, flagged, hasAttachments, from, to, subject, since, before). Endpoint `GET /:accountId/messages/search` avec pagination. Tri par score textuel si `$text` présent, sinon par date décroissante.
- [x] **Brouillons** : Stockage IMAP via `messageAppend` dans le dossier Drafts (détecté via `findDraftsFolder` + fallback "Drafts"). Flag `\Draft` appliqué au message appendé. Création (append uniquement), modification (delete ancien + append nouveau), suppression. `draftService` réutilise `imapPool` avec release en `finally`. `MailComposer` pour construire le raw MIME (RFC 822). Endpoints CRUD `POST/PATCH/DELETE /:accountId/drafts`.
- [x] **Temps réel SSE** : Endpoint `GET /api/events` (Server-Sent Events, unidirectionnel serveur→client). Communication worker→API via Redis Pub/Sub (channel `hellomail:events`). `eventPublisher` (côté worker) publie les événements `message:new`, `message:deleted`, `message:flags`, `account:syncError`. `eventSubscriber` (côté API) souscrit et filtre par `userId`. Auth SSE via `requireAuthSse` (token JWT en query param — EventSource ne supporte pas les headers custom). Heartbeat 30s pour maintenir la connexion. `idleLoop` reçoit maintenant `userId` en paramètre pour le routage des événements. Les événements ne contiennent jamais de sujet/corps d'email (uniquement UID, folder, flags, errorMsg).
- [x] **Tests** : 40 nouveaux tests (227 total, 22 fichiers). Tests unitaires (searchService parser + recherche, draftService, eventPublisher, eventSubscriber) + tests d'intégration (draftsController). Coverage : 88.92% lignes, 77.14% branches, 83.56% fonctions, 87.35% statements.

**Qualité :** Sécurité renforcée sans breaking change fonctionnel. Logger structuré avec redaction — aucun secret dans les logs. Rate limit global + limiters existants migrés vers une lib maintenu. Recherche performante via index textuel MongoDB. Brouillons cohérents multi-client (stockés sur le serveur IMAP). SSE simple et unidirectionnel, Redis prépare le scaling horizontal. Discipline PEEK maintenue. Les événements temps réel ne fuient jamais de données sensibles.

### Phase 6 — Sync multi-dossiers + Pagination + OAuth Google + 2FA + Contacts + Observabilité

**Livrés :**

- [x] **Sync multi-dossiers temps réel** : `pollingSync.ts` — seconde connexion IMAP dédiée au polling des dossiers spéciaux (Sent, Drafts, Trash, Junk, Archive) en parallèle de l'IDLE INBOX. Polling périodique avec intervalle configurable, reconnexion avec backoff, arrêt propre via `AbortSignal`. Intégration dans `syncManager` (démarrage/arrêt du polling en parallèle de l'IDLE). Le worker gère désormais 2 connexions IMAP par compte actif (1 IDLE INBOX + 1 polling dossiers spéciaux).
- [x] **Pagination arrière** : `fetchMoreService.ts` — fetch IMAP des messages plus anciens par UID range décroissant (au-delà des 50 initiaux). Endpoint `POST /api/accounts/:accountId/messages/fetch-more` avec validation Zod. Stockage en base au fur et à mesure. Intégration frontend avec scroll de la liste virtualisée.
- [x] **OAuth Google XOAUTH2** : `oauthService.ts` — génération URL d'autorisation, échange du code d'autorisation contre access + refresh token, refresh token chiffré AES-256-GCM stocké dans `oauthConfig.encryptedRefreshToken`, renouvellement automatique de l'access token (cache + TTL). `oauthController.ts` + `oauthRoutes.ts` — endpoints redirect + callback. Adaptation du `syncManager` et `imapPool` pour authentifier IMAP via XOAUTH2 (access token à la place du mot de passe). Adaptation de `sendService` pour SMTP via XOAUTH2 (Nodemailer OAuth2). Bouton "Continuer avec Google" dans `AddAccountDialog.tsx` + gestion du retour OAuth côté `/mail`. Variables d'env : `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.
- [x] **2FA TOTP + WebAuthn** : `twoFactorService.ts` (otplib) — génération secret TOTP, QR code (qrcode), vérification code TOTP, codes de secours (10 codes à usage unique, hashés bcrypt), activation/désactivation. `webauthnService.ts` (@simplewebauthn/server v11) — enregistrement et vérification de passkeys (credentials WebAuthn). Flux de login modifié : si 2FA activée, retour `{ requiresTwoFactor: true, twoFactorTempToken }` au lieu des tokens complets. Token temporaire court signé JWT pour le flux verify. Endpoint `POST /api/auth/verify-2fa` valide le code TOTP ou un code de secours et émet les tokens complets. Endpoints setup/enable/disable/status + WebAuthn registration/login. Frontend : `LoginForm` adapté (étape vérification 2FA), `TwoFactorSettings` (activation QR + codes de secours + désactivation), page `/mail/settings`.
- [x] **Contacts** : Modèle `Contact` (userId, name, email, phone, notes) + index textuel + index unique (userId, email). `contactService.ts` — CRUD complet + recherche/autocomplétion (regex sur name + email). `contactsController.ts` + `contactsRoutes.ts` + `contactSchemas.ts` (Zod). Frontend : `ContactAutocomplete` (autocomplétion dans le compose form avec navigation clavier), `ContactsManager` (CRUD dans la page réglages), `useContacts`/`useSearchContacts`/`useCreateContact`/`useUpdateContact`/`useDeleteContact` (TanStack Query).
- [x] **Observabilité** : `metricsService.ts` (prom-client v15) — registry Prometheus personnalisé, métriques par défaut Node.js (GC, event loop, memory), compteur de requêtes HTTP (`hellomail_http_requests_total`), histogramme de durée (`hellomail_http_request_duration_seconds`), jauges MongoDB/Redis. `metricsMiddleware.ts` — instrumentation de chaque requête avec normalisation des routes (remplacement ObjectId/IDs par `:id` pour éviter la cardinalité excessive). `healthController.ts` — health check enrichi (status, uptime, version, Node, état MongoDB + Redis, HTTP 503 si dégradé) + endpoint `/api/metrics` au format Prometheus.
- [x] **Tests** : 73 nouveaux tests (323 total, 31 fichiers). Tests unitaires (twoFactorService, oauthService, fetchMoreService, pollingSync) + tests d'intégration (auth2FA, contacts, health/metrics). Tous les tests passent sans erreur.

**Qualité :** Phase 6 livrée sans breaking change fonctionnel. L'OAuth Google utilise XOAUTH2 (standard Gmail) avec refresh token chiffré. La 2FA combine TOTP (otplib) + WebAuthn (passkeys) avec codes de secours hashés. Les contacts bénéficient d'un index textuel et d'une autocomplétion dans le compose. L'observabilité expose des métriques Prometheus prêtes pour Grafana. Le polling multi-dossiers utilise une seconde connexion IMAP dédiée (pas de conflit avec l'IDLE INBOX). Discipline PEEK maintenue. 323 tests backend passent.

---

## 4. Analyse de la dette technique et risques

### 4.1 Dette technique identifiée

| # | Dette | Sévérité | Fichier(s) | Description |
|---|-------|----------|------------|-------------|
| D1 | **Aucun test** → ✅ Résolu (Phase 3 + 5) | ✅ Résolue | — | Vitest installé. 227 tests (22 fichiers). Coverage 88.92% lignes, 77.14% branches, 83.56% fonctions, 87.35% statements. Tests unitaires + intégration (Supertest + mongodb-memory-server). |
| D2 | **Rate limit in-memory** | ⚠️ Partiellement résolu (Phase 5) | `middleware/rateLimit.ts` | Migration vers `express-rate-limit` v7 (store in-memory par défaut, headers draft-7). Le store reste en mémoire (Map) — migration vers Redis prévue pour le scaling horizontal. |
| D3 | **Logging console.log** | ✅ Résolue (Phase 5) | `config/logger.ts`, `middleware/requestLogger.ts` | Logger structuré `pino` + `pino-http` avec redaction automatique des champs sensibles. Tous les `console.log`/`console.error` remplacés par `logger.info`/`logger.error`. Logs JSON en production, prettifiés en dev. |
| D4 | **Pas de Helmet** | ✅ Résolue (Phase 5) | `app.ts` | `helmet()` activé avec `contentSecurityPolicy: false` (API REST, pas de HTML rendu côté serveur) et `crossOriginEmbedderPolicy: false` (compatibilité pièces jointes). |
| D5 | **Sync INBOX uniquement** → ✅ Résolu (Phase 6 — polling multi-dossiers) | ✅ Résolue | `syncManager.ts`, `pollingSync.ts` | La sync initiale couvre INBOX + Sent/Drafts/Trash/Junk/Archive (`runInitialSyncAll`). `saveToSent` fait miroir dans MongoDB. Reconciliation multi-dossiers au démarrage. **Phase 6** : `pollingSync.ts` ajoute le polling temps réel des dossiers spéciaux via une 2e connexion IMAP en parallèle de l'IDLE INBOX. Les changements distants sur Sent/Trash/etc. sont maintenant rattrapés périodiquement (pas seulement à la reconnexion). |
| D6 | **InitialSync limitée à 50 messages** → ✅ Résolu (Phase 6 — pagination arrière) | ✅ Résolue | `initialSync.ts`, `fetchMoreService.ts` | **Phase 6** : `fetchMoreService` permet de récupérer les messages plus anciens par UID range décroissant quand l'utilisateur scroll au-delà des 50 initiaux. Stockage en base au fur et à mesure. |
| D7 | **Pas de validation `algorithm` sur JWT verify** | ✅ Résolue (Phase 5) | `authService.ts`, `auth.ts` | `jwt.verify` avec `{ algorithms: ['HS256'] }` — épinglage de l'algorithme pour empêcher l'algorithme confusion (RS256 → HS256). |
| D8 | **`validate` middleware perd les détails Zod** | ✅ Résolue (Phase 5) | `validate.ts` | La `ZodError` est maintenant laissée passer au `errorHandler` centralisé (qui la gère avec `err.flatten().fieldErrors`) — les détails Zod sont retournés au client. |
| D9 | **Pas de gestion des graceful shutdown côté API** | ✅ Résolue (Phase 5) | `app.ts` | Handler `SIGTERM`/`SIGINT` : `server.close()` + `imapPool.closeAll()` + `mongoose.disconnect()` avec safety net de 10s. |
| D10 | **`messagesController.list` sans validation de `folder`** | 🟡 Faible | `messagesController.ts` l.10 | `folder` est validé par Zod (default INBOX) mais aucune vérification que le dossier existe côté IMAP. Un dossier inexistant retourne simplement une liste vide. |
| D11 | **Pas d'index sur `Message.folder`** | ✅ Résolue (Phase 5) | `Message.ts` | Index `{accountId, folder, date: -1}` ajouté pour optimiser la liste paginée par dossier. |
| D12 | **`as any` dans authService et validate** | 🟡 Faible | `authService.ts` l.89,95, `validate.ts` l.23,26 | Casts `as any` pour contourner le typage strict. |

### 4.2 Risques

| # | Risque | Impact | Probabilité |
|---|-------|--------|-------------|
| R1 | **Corruption de sync sur reconnexion** | Perte ou doublon de messages | Faible (upsert idempotent) |
| R2 | **Fuite de données dans les logs** | Exposition d'informations sensibles | Moyenne (console.log sans redaction) |
| R3 | **Épuisement de la mémoire sur gros volume** | Crash du worker | Faible (fetch par stream, mais 50 messages en mémoire) |
| R4 | **Désactivation abusive d'un compte** | Compte sain désactivé | Faible (10 échecs + backoff) |
| R5 | **Concurrence sur un même compte** | Double sync, conflits | Moyenne (si 2 workers tournent — pas de lock distribué) |

---

## 5. Prochaines étapes — par priorité décroissante

> Chaque étape est classée **CRITIQUE** (le produit n'est pas utilisable sans), **IMPORTANTE** (avant mise en production), ou **SECONDaire** (amélioration continue).

---

### Étape 1 — Lecture d'un message (corps, headers, pièces jointes) ✅ LIVRÉ (Phase 3)

**Pourquoi :** Actuellement, seul l'envelope (sujet, from, to, date, flags) est stocké. L'utilisateur ne peut pas lire le contenu d'un email. C'est la fonctionnalité #1 d'un webmail.

**Ce qu'il faut faire :**

1. **Endpoint `GET /api/accounts/:accountId/messages/:folder/:uid`** — retourne le message complet (envelope + corps HTML/texte + headers + structure des pièces jointes).

2. **Service `messageFetchService.ts`** dans `services/email/` :
   - Ouvre une connexion IMAP temporaire (ou réutilise un pool) vers le compte.
   - `mailboxOpen(folder, { readOnly: true })` — lecture seule pour cet endpoint.
   - `client.fetchOne(uid, { uid: true, envelope: true, flags: true, bodyStructure: true, size: true, source: true, headers: true })` avec `{ uid: true }`.
   - **Discipline PEEK obligatoire** : ImapFlow utilise automatiquement `BODY.PEEK` — ne jamais utiliser `BODY[]` ou `RFC822` sans `.PEEK`.
   - Parse le `bodyStructure` pour identifier les parties `text/plain` et `text/html`.
   - Télécharge les parties via `client.download(uid, part, { uid: true })` (retourne un stream).
   - Retourne une structure : `{ envelope, headers, text, html, attachments: [{ filename, contentType, size, part }] }`.

3. **Modèle / cache :** Option de cache en base pour les corps déjà lus (collection `MessageBody` ou champ optionnel dans `Message`). À évaluer : stocker le corps en base vs fetch à la demande. Recommandation : **fetch à la demande** dans un premier temps, cache plus tard.

4. **Endpoint `GET /api/accounts/:accountId/messages/:folder/:uid/attachments/:part`** — stream de téléchargement d'une pièce jointe spécifique.

5. **Sanitization HTML :** Le corps HTML doit être sanitizé avant d'être renvoyé au frontend. Utiliser `isomorphic-dompurify` (ou `dompurify` + `jsdom`) pour neutraliser `<script>`, `javascript:`, event handlers, etc.

**Fichiers à créer/modifier :**
- `backend/src/services/email/messageFetchService.ts` (nouveau)
- `backend/src/controllers/messagesController.ts` (ajouter `getOne`, `getAttachment`)
- `backend/src/routes/messagesRoutes.ts` (ajouter routes)
- `backend/src/schemas/messageSchemas.ts` (ajouter schémas params)
- `backend/package.json` (ajouter `isomorphic-dompurify` + `jsdom`)

**Risques :**
- Performance : ouvrir une connexion IMAP par requête de lecture est coûteux. Envisager un pool de connexions réutilisables (un ImapFlow persistant par compte, partagé entre lecture et sync).
- Sécurité : le HTML d'email est non fiable. Sanitization obligatoire.

---

### Étape 2 — Envoi d'emails (compose, reply, forward) ✅ LIVRÉ (Phase 3)

**Pourquoi :** Un webmail qui ne peut que recevoir n'est pas un client email. L'envoi est la deuxième fonctionnalité fondamentale.

**Ce qu'il faut faire :**

1. **Endpoint `POST /api/accounts/:accountId/send`** — envoie un email via le SMTP du compte.

2. **Service `sendService.ts`** dans `services/email/` :
   - Déchiffre le mot de passe IMAP (réutilisé pour SMTP dans le cas IMAP).
   - Crée un transport `nodemailer.createTransport({ host, port, secure, auth: { user, pass } })`.
   - `transport.sendMail({ from, to, cc, bcc, replyTo, subject, text, html, attachments, inReplyTo, references })`.
   - Gestion des erreurs SMTP (422 si échec).

3. **Schéma Zod `sendEmailSchema`** :
   - `to`, `cc`, `bcc` : tableaux d'emails valides.
   - `subject` : string max 998 caractères (RFC 5322).
   - `text` : string (obligatoire, fallback HTML).
   - `html` : string optionnel.
   - `attachments` : tableau de `{ filename, content (base64), contentType }`.
   - `inReplyTo`, `references` : pour reply/forward (threading).
   - Limiter la taille totale (ex. 25 Mo).

4. **Reply / Forward :**
   - Reply : `inReplyTo` = Message-ID original, `references` = [Message-ID original], sujet préfixé `Re:`.
   - Forward : sujet préfixé `Fwd:`, corps incluant le message original cité.
   - Nodemailer ne génère pas la citation automatiquement — à construire côté service.

5. **Sauvegarde dans "Sent" :** Après envoi, copier le message dans le dossier "Sent" via IMAP (`messageCopy` ou `messageAppend` d'ImapFlow).

**Fichiers à créer/modifier :**
- `backend/src/services/email/sendService.ts` (nouveau)
- `backend/src/controllers/messagesController.ts` (ajouter `send`)
- `backend/src/routes/messagesRoutes.ts` (ajouter route POST)
- `backend/src/schemas/messageSchemas.ts` (ajouter `sendEmailSchema`)

**Risques :**
- Taille des pièces jointes : configurer `express.json({ limit: '25mb' })` ou utiliser `multer` pour l'upload.
- SMTP timeout : configurer un timeout raisonnable (30s).
- Rate limit spécifique sur l'envoi (anti-spam).

---

### Étape 3 — Gestion des dossiers IMAP ✅ LIVRÉ (Phase 3)

**Pourquoi :** Actuellement, seul INBOX est synchronisé. L'utilisateur doit pouvoir voir, créer, renommer et supprimer des dossiers. C'est essentiel pour organiser ses emails.

**Ce qu'il faut faire :**

1. **Endpoint `GET /api/accounts/:accountId/folders`** — liste les dossiers IMAP.

2. **Service `folderService.ts`** dans `services/email/` :
   - `client.list()` → liste plate des mailboxes (path, name, delimiter, specialUse, flags).
   - `client.listTree()` → hiérarchie parent/enfant.
   - `client.status(path, { messages, unseen, uidNext })` → compteurs par dossier.

3. **Endpoints CRUD dossiers :**
   - `POST /api/accounts/:accountId/folders` — créer (`client.mailboxCreate(path)`).
   - `PATCH /api/accounts/:accountId/folders/:path` — renommer (`client.mailboxRename(path, newPath)`).
   - `DELETE /api/accounts/:accountId/folders/:path` — supprimer (`client.mailboxDelete(path)`).

4. **Extension du sync worker pour multi-dossiers :**
   - Le `SyncManager` ne synchronise actuellement que INBOX. Il faut étendre à tous les dossiers (ou un sous-ensemble configurable).
   - **Contrainte IMAP :** un seul dossier peut être sélectionné à la fois. L'IDLE ne fonctionne que sur le dossier courant. Solutions :
     - **Option A :** IDLE sur INBOX + polling périodique des autres dossiers (simple, latence acceptable).
     - **Option B :** Une connexion IMAP par dossier (coûteux en ressources, mais temps réel partout).
     - **Recommandation :** Option A pour commencer, Option B plus tard si besoin.

5. **Modèle `Folder`** (optionnel) : pour cacher la structure des dossiers en base et éviter un `LIST` à chaque requête. Champs : `accountId`, `path`, `name`, `delimiter`, `specialUse`, `uidValidity`, `messagesCount`, `unseenCount`.

**Fichiers à créer/modifier :**
- `backend/src/services/email/folderService.ts` (nouveau)
- `backend/src/controllers/foldersController.ts` (nouveau)
- `backend/src/routes/foldersRoutes.ts` (nouveau)
- `backend/src/schemas/folderSchemas.ts` (nouveau)
- `backend/src/services/sync/syncManager.ts` (étendre pour multi-dossiers)
- `backend/src/app.ts` (monter la route)

---

### Étape 4 — Flags et actions sur messages (marquer, supprimer, déplacer) ✅ LIVRÉ (Phase 3)

**Pourquoi :** L'utilisateur doit pouvoir marquer comme lu/non-lu, favori, supprimer et déplacer des messages. Ces actions modifient l'état côté serveur IMAP, pas seulement en base.

**Ce qu'il faut faire :**

1. **Endpoint `PATCH /api/accounts/:accountId/messages/:folder/:uid/flags`** — met à jour les flags.

2. **Service `messageActionService.ts`** dans `services/email/` :
   - `messageFlagsAdd(uid, ['\\Seen'], { uid: true })` — marquer comme lu.
   - `messageFlagsRemove(uid, ['\\Seen'], { uid: true })` — marquer comme non-lu.
   - `messageFlagsAdd(uid, ['\\Flagged'], { uid: true })` — favori.
   - Synchroniser le changement en base (`MessageModel.updateOne`).

3. **Endpoint `DELETE /api/accounts/:accountId/messages/:folder/:uid`** — supprime un message.
   - `client.messageDelete(uid, { uid: true, forceDelete: true })` — suppression immédiate.
   - Ou `client.messageMove(uid, 'Trash', { uid: true })` — déplacer vers Corbeille (comportement plus attendu).
   - Supprimer de la base (`MessageModel.deleteOne`).

4. **Endpoint `POST /api/accounts/:accountId/messages/:folder/:uid/move`** — déplace vers un autre dossier.
   - `client.messageMove(uid, destination, { uid: true })`.
   - Mettre à jour le `folder` en base (ou supprimer + resync).

5. **Actions en masse :** `POST /api/accounts/:accountId/messages/batch` avec `{ action: 'delete' | 'move' | 'markRead' | 'markUnread', uids: [], folder, destination? }`.

**Fichiers à créer/modifier :**
- `backend/src/services/email/messageActionService.ts` (nouveau)
- `backend/src/controllers/messagesController.ts` (ajouter `updateFlags`, `remove`, `move`, `batch`)
- `backend/src/routes/messagesRoutes.ts` (ajouter routes)
- `backend/src/schemas/messageSchemas.ts` (ajouter schémas)

---

### Étape 5 — Tests (Vitest) ✅ LIVRÉ (Phase 3)

**Pourquoi :** Aucun test n'existe. La logique métier (auth, sync, mapping, chiffrement) est critique et non couverte. Tout changement futur est risqué sans filet de sécurité.

**Ce qu'il faut faire :**

1. **Installer Vitest + @testing-library :**
   ```bash
   pnpm --filter backend add -D vitest @vitest/coverage-v8 mongodb-memory-server
   ```

2. **Tests unitaires prioritaires :**
   - `encryptionService` : encrypt → decrypt round-trip, échec sur authTag altéré.
   - `messageMapper` : transformation FetchMessageObject → MessageInput (cas nominaux + edge cases : envelope null, flags vides, bodyStructure sans PJ).
   - `authService` : register (doublon → 409), login (mauvais mdp → 401), refreshTokens (rotation, réutilisation → révocation globale).
   - `accountService` : createImapAccount (test connexion avant persistance, doublon → 409).
   - `validate` middleware : ZodError → AppError.
   - `errorHandler` : ZodError → 400, AppError → statusCode, erreur générique → 500.

3. **Tests d'intégration :**
   - Routes auth avec `supertest` : register → login → me → refresh → logout.
   - Routes accounts : create → list → toggle → delete.
   - Routes messages : list (paginé, filtre par dossier).

4. **Config :** `vitest.config.ts` avec `environment: 'node'`, coverage thresholds (80% sur services).

**Fichiers à créer :**
- `backend/vitest.config.ts`
- `backend/src/services/security/encryptionService.test.ts`
- `backend/src/services/sync/messageMapper.test.ts`
- `backend/src/services/auth/authService.test.ts`
- `backend/src/services/accounts/accountService.test.ts`
- `backend/src/middleware/validate.test.ts`
- `backend/src/middleware/errorHandler.test.ts`
- `backend/src/controllers/authController.test.ts` (intégration)
- `backend/src/controllers/accountsController.test.ts` (intégration)
- `backend/src/controllers/messagesController.test.ts` (intégration)

---

### Étape 6 — Frontend (Next.js + shadcn/ui) ✅ LIVRÉ (Phase 4)

**Pourquoi :** Le `frontend/` n'existe pas encore. Sans interface, le produit n'est pas utilisable. C'est la plus grosse étape.

**Ce qu'il faut faire :**

1. **Initialiser le package `frontend/`** dans le monorepo :
   ```bash
   pnpm create next-app frontend --typescript --tailwind --eslint --app --src-dir
   ```

2. **Installer shadcn/ui :**
   ```bash
   pnpm --filter frontend dlx shadcn@latest init
   ```

3. **State management :** Zustand pour l'état UI (dossier sélectionné, message ouvert, compose ouvert).

4. **Data fetching :** TanStack Query pour les données serveur (messages, comptes, dossiers).

5. **Pages principales :**
   - `/login` + `/register` — auth.
   - `/` — layout principal (3 volets : sidebar dossiers, liste messages, lecteur).
   - `/accounts` — gestion des comptes (ajout IMAP, toggle, suppression).
   - `/compose` — éditeur d'envoi (modal ou page dédiée).

6. **Composants clés :**
   - `AccountSidebar` — liste des comptes + dossiers.
   - `MessageList` — liste paginée avec tri, filtre, actions en masse.
   - `MessageReader` — affichage du corps (HTML sanitizé dans iframe sandbox, ou texte).
   - `AttachmentList` — liste + téléchargement des PJ.
   - `ComposeForm` — éditeur (to, cc, bcc, subject, body, PJ).
   - `FolderTree` — arborescence des dossiers IMAP.

7. **Auth client :** Access token en mémoire JS (pas localStorage), refresh token en cookie httpOnly (géré par le backend). Intercepteur axios/fetch pour auto-refresh.

8. **Thèmes :** Clair/sombre via `next-themes`.

**Risques :**
- Affichage HTML d'email : utiliser un `iframe sandbox="allow-same-origin"` avec CSP restrictive, ou un renderer HTML sanitizé. Ne jamais injecter le HTML d'email dans le DOM principal.
- Performance : virtualisation de la liste des messages (`@tanstack/react-virtual`).

---

### Étape 7 — Sécurité backend (Helmet, logging, rate limit global) ✅ LIVRÉ (Phase 5)

**Pourquoi :** Le backend manque de plusieurs contrôles de sécurité essentiels avant une mise en production.

**Ce qu'il faut faire :**

1. **Helmet.js** — headers de sécurité HTTP :
   ```bash
   pnpm --filter backend add helmet
   ```
   ```ts
   import helmet from 'helmet';
   app.use(helmet());
   ```

2. **Logger structuré (pino)** avec redaction :
   ```bash
   pnpm --filter backend add pino pino-http
   ```
   - Remplacer tous les `console.log`/`console.error` par `logger.info`/`logger.error`.
   - Redaction automatique : `req.headers.authorization`, `req.headers.cookie`, `*.password`, `*.token`, `*.encryptedPassword`, `req.body`.
   - Logger structuré en JSON en production, prettifié en développement.

3. **Rate limit global** — `express-rate-limit` :
   ```bash
   pnpm --filter backend add express-rate-limit
   ```
   - Global : 100 req/15 min/IP.
   - Auth : conserver le limiter existant (10 req/15 min) ou migrer vers express-rate-limit.
   - Send : 20 req/min/IP (anti-spam).
   - Headers `RateLimit-*` (draft-7).

4. **Épinglage de l'algorithme JWT :**
   ```ts
   jwt.verify(token, secret, { algorithms: ['HS256'] })
   ```
   Dans `authService.ts` et `auth.ts`.

5. **Graceful shutdown de l'API :**
   ```ts
   process.on('SIGTERM', () => { server.close(() => mongoose.disconnect()); });
   ```

6. **Sanitization HTML** (déjà couvert à l'étape 1, mais rappel) : `isomorphic-dompurify` sur tout corps d'email avant envoi au frontend.

**Fichiers à modifier :**
- `backend/src/app.ts` (helmet, pino-http, graceful shutdown)
- `backend/src/config/env.ts` (LOG_LEVEL)
- `backend/src/middleware/auth.ts` (algorithms)
- `backend/src/services/auth/authService.ts` (algorithms)
- `backend/src/middleware/rateLimit.ts` (migrer ou compléter)
- Tous les fichiers avec `console.log` → `logger`

---

### Étape 8 — Recherche de messages ✅ LIVRÉ (Phase 5)

**Pourquoi :** La recherche est un must-have d'un webmail. Actuellement, seul le tri par date est possible.

**Ce qu'il faut faire :**

1. **Recherche côté base (MongoDB)** — sur les champs stockés (subject, from, to, flags) :
   - `GET /api/accounts/:accountId/messages/search?q=...&folder=...`
   - Index textuel MongoDB : `messageSchema.index({ subject: 'text', 'from.address': 'text', 'to.address': 'text' })`.
   - Filtres : `seen`, `flagged`, `hasAttachments`, `from`, `to`, `subject`, `dateRange`.

2. **Recherche côté serveur IMAP** — pour les messages non synchronisés (au-delà des 50 derniers) :
   - `client.search({ subject: '...', from: '...', seen: false }, { uid: true })`.
   - Fetch des résultats via `client.fetch(uids, query)`.
   - Endpoint dédié : `GET /api/accounts/:accountId/search?q=...&folder=...`.

3. **Opérateurs de recherche** (parser côté API) :
   - `from:alice`, `to:bob`, `subject:test`, `has:attachment`, `is:unread`, `is:flagged`.
   - `before:2026-01-01`, `since:2026-01-01`.
   - Recherche plein texte par défaut sur subject + from + to.

**Fichiers à créer/modifier :**
- `backend/src/controllers/messagesController.ts` (ajouter `search`)
- `backend/src/routes/messagesRoutes.ts` (ajouter route)
- `backend/src/schemas/messageSchemas.ts` (ajouter `searchSchema`)
- `backend/src/models/Message.ts` (ajouter index textuel)

---

### Étape 9 — Brouillons et sauvegarde automatique ✅ LIVRÉ (Phase 5)

**Pourquoi :** La sauvegarde automatique des brouillons est attendue dans tout webmail moderne.

**Ce qu'il faut faire :**

1. **Modèle `Draft`** ou réutilisation du dossier IMAP "Drafts" :
   - Option A : stocker en base (collection `Draft`) — simple, pas de sync IMAP.
   - Option B : stocker via IMAP `messageAppend` dans "Drafts" — sync avec le serveur, visible dans autres clients.
   - **Recommandation :** Option B pour la cohérence multi-client.

2. **Endpoints :**
   - `POST /api/accounts/:accountId/drafts` — créer un brouillon.
   - `PATCH /api/accounts/:accountId/drafts/:uid` — modifier.
   - `DELETE /api/accounts/:accountId/drafts/:uid` — supprimer.

3. **Sauvegarde automatique :** Côté frontend, debounce sur les changements du compose form (5s) → auto-save via l'API.

---

### Étape 10 — Notifications temps réel (WebSocket / SSE) ✅ LIVRÉ (Phase 5)

**Pourquoi :** Actuellement, le frontend doit poller l'API pour détecter les nouveaux messages. Avec le sync worker qui reçoit les notifications IDLE en temps réel, il faut propager cette information au frontend.

**Ce qu'il faut faire :**

1. **WebSocket (Socket.io)** ou **Server-Sent Events (SSE)** entre l'API et le frontend.
   - SSE est plus simple pour un flux unidirectionnel (serveur → client). Recommandé pour commencer.
   - `GET /api/accounts/:accountId/events` — connexion SSE.

2. **Communication worker → API :** Le worker détecte les nouveaux messages (IDLE) et doit notifier l'API. Options :
   - Redis Pub/Sub (recommandé, prépare le terrain pour le scaling).
   - MongoDB Change Streams (sur la collection `Message`).
   - HTTP interne du worker vers l'API.

3. **Événements à propager :**
   - `message:new` — nouveau message reçu.
   - `message:deleted` — message supprimé (expunge).
   - `message:flags` — flags modifiés.
   - `account:syncError` — erreur de sync sur un compte.

**Fichiers à créer :**
- `backend/src/services/realtime/eventPublisher.ts` (worker → Redis/ChangeStream)
- `backend/src/controllers/eventsController.ts` (SSE endpoint)
- `backend/src/routes/eventsRoutes.ts`

---

### Étape 11 — OAuth Google / Microsoft ✅ LIVRÉ (Phase 6 — Google uniquement)

**Pourquoi :** Le modèle `Account` a déjà la structure `oauthConfig` mais aucun flux n'est implémenté. L'OAuth permet de connecter Gmail/Outlook sans mot de passe d'application.

**Ce qu'il faut faire :**

1. **Google OAuth 2.0 :**
   - Configurer un projet Google Cloud + credentials OAuth.
   - Variables d'env : `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.
   - Flow : `authorization_code` → `access_token` + `refresh_token`.
   - Scope : `https://mail.google.com/` (IMAP/SMTP via XOAUTH2).
   - Stocker le `refresh_token` chiffré dans `oauthConfig.encryptedRefreshToken`.
   - Renouvellement automatique de l'access token (via `refresh_token`).

2. **Microsoft OAuth 2.0 :**
   - Azure AD app registration.
   - Variables d'env : `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_REDIRECT_URI`.
   - Scope : `https://outlook.office.com/IMAP.AccessAsUser.All` + `SMTP.Send`.
   - Même mécanisme de refresh.

3. **Authentification XOAUTH2** dans ImapFlow et Nodemailer :
   - ImapFlow : `auth: { user, accessToken }` (généré depuis le refresh token).
   - Nodemailer : `auth: { type: 'OAuth2', user, accessToken }`.

4. **Endpoints :**
   - `GET /api/accounts/oauth/google` — redirige vers Google.
   - `GET /api/accounts/oauth/google/callback` — callback.
   - Idem pour Microsoft.

---

### Étape 12 — 2FA / TOTP ✅ LIVRÉ (Phase 6)

**Pourquoi :** Un webmail centralise l'accès à tous les comptes email. Le vol de mot de passe est critique.

**Ce qu'il faut faire :**

1. **Installer `otplib` :**
   ```bash
   pnpm --filter backend add otplib
   ```

2. **Modèle User :** ajouter `twoFactorSecret` (chiffré, select: false) + `twoFactorEnabled` (boolean).

3. **Endpoints :**
   - `POST /api/auth/2fa/setup` — génère un secret + QR code.
   - `POST /api/auth/2fa/verify` — vérifie le code TOTP, active 2FA.
   - `POST /api/auth/2fa/disable` — désactive (avec vérification du code).
   - `POST /api/auth/login` — si 2FA activé, retourner `{ requiresTwoFactor: true, tempToken }` au lieu des tokens.
   - `POST /api/auth/login/2fa` — vérifie le code TOTP avec `tempToken`, émet les tokens.

4. **Codes de secours :** générer 10 codes à usage unique, stocker hashés en base.

---

### Étape 13 — Contacts / carnet d'adresses ✅ LIVRÉ (Phase 6)

**Pourquoi :** L'auto-complétion des adresses email dans le compose form est un must-have UX.

**Ce qu'il faut faire :**

1. **Modèle `Contact`** : `userId`, `name`, `email` (unique par user), `phone`, `notes`, `avatar`.

2. **Endpoints CRUD :** `GET/POST/PATCH/DELETE /api/contacts`.

3. **Auto-complétion :** `GET /api/contacts/search?q=...` — recherche par nom ou email.

4. **Sync des expéditeurs fréquents :** Le sync worker peut extraire les adresses des messages reçus et les ajouter automatiquement au carnet d'adresses (opt-in).

---

### Étape 14 — Logging structuré et observabilité ✅ LIVRÉ (Phase 6)

**Pourquoi :** En production, `console.log` n'est pas suffisant. Il faut des logs structurés, des métriques et du tracing.

**Ce qu'il faut faire :**

1. **Pino** (déjà couvert à l'étape 7, mais étendu ici) :
   - Logs structurés JSON en production.
   - Request ID corrélé (pino-http + `req.id`).
   - Redaction des champs sensibles.

2. **Métriques :** `prom-client` pour exposer des métriques Prometheus.
   - Compteurs : messages synchronisés, erreurs de sync, envois.
   - Histogrammes : latence des endpoints, durée de sync initiale.

3. **Health check étendu :** `GET /api/health` → `{ status, mongo: 'connected', worker: 'running' }`.

---

### Étape 15 — Améliorations de la sync (multi-dossiers IDLE, pagination arrière, QRESYNC) ✅ LIVRÉ (Phase 6 — polling + pagination)

**Pourquoi :** La sync initiale couvre désormais INBOX + dossiers spéciaux (Post-Phase 5), mais l'IDLE reste sur INBOX uniquement. Pour un webmail complet, il faut le temps réel sur tous les dossiers et la récupération de l'historique.

**Ce qu'il faut faire :**

1. **Multi-dossiers IDLE :** Étendre le SyncManager pour gérer plusieurs connexions IDLE (une par dossier spécial). Changement architectural majeur (gestion de N connexions ImapFlow par compte, lifecycle, reconnexion). La sync initiale multi-dossiers et la reconciliation sont déjà livrées (Post-Phase 5).

2. **Pagination arrière :** Quand l'utilisateur scroll au-delà des 50 messages initiaux, fetch les messages plus anciens :
   - `GET /api/accounts/:accountId/messages?folder=...&page=2` → si pas en base, fetch IMAP des 50 suivants (par UID range décroissant).
   - Stocker en base au fur et à mesure.

3. **QRESYNC avancé :** Utiliser `changedSince` (modseq) dans `mailboxOpen` pour ne fetch que les changements depuis la dernière sync (au lieu de re-fetch tout).

4. **Pool de connexions :** Réutiliser une connexion IMAP par compte pour la lecture et la sync (au lieu d'ouvrir/fermer à chaque requête de lecture).

---

## 6. Roadmap suggérée

### Phase 3 — Lecture + Envoi + Dossiers + Flags (MVP fonctionnel) ✅ LIVRÉ

| Étape | Priorité | Effort estimé | État |
|-------|----------|---------------|------|
| 1. Lecture d'un message (corps, PJ) | 🔴 CRITIQUE | Moyen | ✅ Livré |
| 2. Envoi d'emails (compose, reply, forward) | 🔴 CRITIQUE | Moyen | ✅ Livré |
| 3. Gestion des dossiers IMAP | 🔴 CRITIQUE | Moyen | ✅ Livré |
| 4. Flags + suppression + déplacement | 🔴 CRITIQUE | Moyen | ✅ Livré |
| 5. Tests (Vitest) | 🔴 CRITIQUE | Moyen | ✅ Livré |

**Objectif :** Le backend devient un webmail fonctionnel (recevoir, lire, écrire, organiser). ✅ Atteint.

### Phase 4 — Frontend (MVP utilisable) ✅ LIVRÉ

| Étape | Priorité | Effort estimé | État |
|-------|----------|---------------|------|
| 6. Frontend Next.js + shadcn/ui | 🔴 CRITIQUE | Élevé | ✅ Livré |

**Objectif :** Le produit est utilisable end-to-end. ✅ Atteint.

### Phase 5 — Sécurité + Recherche + Temps réel ✅ LIVRÉ

| Étape | Priorité | Effort estimé | État |
|-------|----------|---------------|------|
| 7. Sécurité backend (Helmet, pino, rate limit) | 🟠 IMPORTANTE | Faible | ✅ Livré |
| 8. Recherche de messages | 🟠 IMPORTANTE | Moyen | ✅ Livré |
| 9. Brouillons + auto-save | 🟠 IMPORTANTE | Faible | ✅ Livré |
| 10. Notifications temps réel (SSE) | 🟠 IMPORTANTE | Moyen | ✅ Livré |

**Objectif :** Le produit est prêt pour une bêta. ✅ Atteint.

### Phase 6 — OAuth + 2FA + Contacts + Observabilité + Sync multi-dossiers ✅ LIVRÉ

| Étape | Priorité | Effort estimé | État |
|-------|----------|---------------|------|
| 11. OAuth Google (XOAUTH2) | 🟡 SECONDaire | Élevé | ✅ Livré (Google uniquement — Microsoft non implémenté) |
| 12. 2FA / TOTP + WebAuthn | 🟡 SECONDaire | Moyen | ✅ Livré |
| 13. Contacts / carnet d'adresses | 🟡 SECONDaire | Faible | ✅ Livré |
| 14. Logging + observabilité | 🟡 SECONDaire | Faible | ✅ Livré (Prometheus + health enrichi) |
| 15. Sync multi-dossiers + pagination arrière | 🟡 SECONDaire | Élevé | ✅ Livré (polling dossiers spéciaux + fetchMore) |

**Objectif :** Le produit est prêt pour la production. ✅ Atteint.

---

## 7. Matrice de couverture fonctionnelle

Légende : ✅ Livré · ⚠️ Partiel · ❌ Manquant

| Fonctionnalité | État | Phase concernée | Détail |
|----------------|------|-----------------|--------|
| **Auth** | | | |
| Register / Login | ✅ | Phase 1 | JWT access + refresh rotation |
| Refresh token | ✅ | Phase 1 | Rotation + détection de réutilisation |
| Logout | ✅ | Phase 1 | Révocation du refresh token |
| Profil (me) | ✅ | Phase 1 | — |
| 2FA / TOTP | ✅ | Phase 6 | TOTP (otplib) + codes de secours (bcrypt) + WebAuthn passkeys |
| OAuth Google | ✅ | Phase 6 | XOAUTH2 — service OAuth + callback + refresh chiffré + IMAP/SMTP |
| OAuth Microsoft | ❌ | Phase 6 | Structure présente dans le modèle, non implémenté |
| **Comptes** | | | |
| Créer un compte IMAP | ✅ | Phase 1 | Test IMAP+SMTP avant persistance |
| Lister ses comptes | ✅ | Phase 1 | Projection safe (pas de secrets) |
| Supprimer un compte | ✅ | Phase 1 | — |
| Activer/désactiver | ✅ | Phase 1 | Toggle isActive |
| Autoconfig (Mozilla/MS) | ❌ | — | Non implémenté |
| **Sync** | | | |
| Sync initiale INBOX (50 msgs) | ✅ | Phase 2 | Idempotent, par range de séquence |
| Sync initiale multi-dossiers | ✅ | Post-Phase 5 | INBOX + Sent/Drafts/Trash/Junk/Archive via runInitialSyncAll |
| IDLE INBOX | ✅ | Phase 2 | exists, expunge, flags |
| Reconciliation bornée | ✅ | Phase 2 | Fetch UID connus, pas de SEARCH ALL |
| Reconciliation multi-dossiers | ✅ | Post-Phase 5 | reconcileAllFolders au démarrage (nettoyage fantômes) |
| Miroir Sent dans MongoDB | ✅ | Post-Phase 5 | saveToSent upsert après append IMAP |
| Backoff + désactivation auto | ✅ | Phase 2 | 10 échecs, backoff exponentiel |
| Sync multi-dossiers IDLE | ⚠️ | Phase 6 | Polling dossiers spéciaux via 2e connexion (pas IDLE — polling périodique) |
| Pagination arrière | ✅ | Phase 6 | fetchMoreService — fetch IMAP UID range décroissant |
| QRESYNC avancé (modseq) | ⚠️ | Phase 2 | Activé mais pas exploité pour delta sync |
| **Messages** | | | |
| Liste paginée par dossier | ✅ | Phase 2 | Tri par date, filtre par dossier |
| Lecture du corps (HTML/texte) | ✅ | Phase 3 | messageFetchService + BODY.PEEK |
| Headers complets | ✅ | Phase 3 | Parsing Buffer headers ImapFlow |
| Pièces jointes (download) | ✅ | Phase 3 | attachmentService (streaming PassThrough) |
| Marquer lu/non-lu | ✅ | Phase 3 | messageActionService.updateFlags |
| Marquer favori | ✅ | Phase 3 | messageActionService.updateFlags |
| Supprimer | ✅ | Phase 3 | Trash détecté via specialUse + fallbacks |
| Déplacer | ✅ | Phase 3 | messageActionService.moveMessage |
| Actions en masse | ✅ | Phase 3 | batch (markRead/Unread/flag/unflag/delete/move/markAsJunk) |
| Marquer comme spam | ✅ | Phase 3 | markAsJunk (individuelle + batch) |
| Recherche | ✅ | Phase 5 | Index textuel MongoDB + parser d'opérateurs (from:/to:/is:/has:/before:/since:) |
| **Envoi** | | | |
| Composer un message | ✅ | Phase 3 | sendService (Nodemailer) |
| Répondre (reply) | ✅ | Phase 3 | inReplyTo + references dans le schéma |
| Transférer (forward) | ✅ | Phase 3 | Schéma supporte les champs reply/forward |
| Pièces jointes (upload) | ✅ | Phase 3 | base64 → Buffer, limite 30mb |
| Sauvegarde Sent | ✅ | Phase 3 | IMAP append, dossier détecté via specialUse |
| Brouillons + auto-save | ✅ | Phase 5 | Stockage IMAP Drafts via messageAppend, flag \Draft, CRUD endpoints |
| CC / BCC | ✅ | Phase 3 | Supportés dans sendEmailSchema |
| Signature | ❌ | — | Non implémenté |
| **Dossiers** | | | |
| Lister les dossiers | ✅ | Phase 3 | folderService.listFolders (avec status) |
| Créer / renommer / supprimer | ✅ | Phase 3 | folderService CRUD + cache invalidation |
| Détection dossiers spéciaux | ✅ | Phase 3 | specialFolders.ts (specialUse + fallbacks multilingues) |
| **Sécurité** | | | |
| Chiffrement AES-256-GCM | ✅ | Phase 1 | Mots de passe IMAP |
| Cookies httpOnly | ✅ | Phase 1 | Refresh token, sameSite strict |
| CORS | ✅ | Phase 1 | Origin explicite, credentials |
| Rate limit auth | ✅ | Phase 1 | 10 req/15 min (in-memory) |
| Rate limit envoi | ✅ | Phase 3 | 20 req/min/IP (sendRateLimit) |
| Sanitization HTML | ✅ | Phase 3 | isomorphic-dompurify + jsdom |
| Pool IMAP API (lazy) | ✅ | Phase 3 | imapPool (verrou par compte, TTL 5 min) |
| Rate limit global | ✅ | Phase 5 | express-rate-limit v7, 100 req/15 min/IP, headers draft-7 |
| Helmet | ✅ | Phase 5 | helmet() activé (CSP désactivé pour API REST) |
| Logging structuré | ✅ | Phase 5 | pino + pino-http, redaction automatique, JSON en prod |
| JWT algorithm pinning | ✅ | Phase 5 | algorithms: ['HS256'] sur verify |
| **Temps réel** | | | |
| Notifications push (SSE/WS) | ✅ | Phase 5 | SSE endpoint /api/events + Redis Pub/Sub worker→API |
| **Tests** | | | |
| Tests unitaires | ✅ | Phase 3 + 5 + 6 | 323 tests, 31 fichiers |
| Tests d'intégration | ✅ | Phase 3 + 6 | Supertest + mongodb-memory-server |
| **Frontend** | | | |
| Interface web | ✅ | Phase 4 + 6 | Next.js 16 + shadcn/ui + glassmorphism, auth (login + 2FA), comptes (IMAP + Google OAuth), dossiers, liste virtualisée, lecteur iframe sandbox, compose/reply/forward (autocomplétion contacts), brouillons auto-save, recherche, SSE temps réel, page réglages (2FA + contacts) |
| **Observabilité** | | | |
| Health check | ✅ | Phase 6 | Enrichi (status, uptime, version, MongoDB, Redis, HTTP 503 si dégradé) |
| Métriques Prometheus | ✅ | Phase 6 | prom-client — compteur requêtes, histogramme durée, jauges MongoDB/Redis |
| **Contacts** | | | |
| Carnet d'adresses (CRUD) | ✅ | Phase 6 | Modèle Contact + service + controller + routes + index textuel + unique |
| Autocomplétion compose | ✅ | Phase 6 | ContactAutocomplete (navigation clavier, regex name+email) |
| **2FA** | | | |
| TOTP (app authenticator) | ✅ | Phase 6 | otplib + QR code + secret chiffré AES-256-GCM |
| Codes de secours | ✅ | Phase 6 | 10 codes à usage unique, hashés bcrypt |
| WebAuthn (passkeys) | ✅ | Phase 6 | @simplewebauthn/server v11 — registration + login |
| **OAuth** | | | |
| OAuth Google XOAUTH2 | ✅ | Phase 6 | Service OAuth + callback + refresh chiffré + IMAP/SMTP XOAUTH2 |

---

## Annexe — Détails techniques des API ImapFlow / Nodemailer

### ImapFlow — Méthodes clés pour les prochaines étapes

| Méthode | Usage | Étape concernée |
|---------|-------|-----------------|
| `client.list()` | Lister les mailboxes (plate) | Étape 3 |
| `client.listTree()` | Lister les mailboxes (hiérarchique) | Étape 3 |
| `client.status(path, query)` | Compteurs par dossier | Étape 3 |
| `client.mailboxCreate(path)` | Créer un dossier | Étape 3 |
| `client.mailboxRename(path, newPath)` | Renommer un dossier | Étape 3 |
| `client.mailboxDelete(path)` | Supprimer un dossier | Étape 3 |
| `client.fetchOne(uid, query, { uid: true })` | Fetch un message complet | Étape 1 |
| `client.download(uid, part, { uid: true })` | Télécharger corps / PJ (stream) | Étape 1 |
| `client.messageFlagsAdd(uid, flags, { uid: true })` | Ajouter flags (\Seen, \Flagged) | Étape 4 |
| `client.messageFlagsRemove(uid, flags, { uid: true })` | Supprimer flags | Étape 4 |
| `client.messageDelete(uid, { uid: true, forceDelete: true })` | Supprimer un message | Étape 4 |
| `client.messageMove(uid, dest, { uid: true })` | Déplacer un message | Étape 4 |
| `client.search(query, { uid: true })` | Recherche côté serveur | Étape 8 |

### Nodemailer — Envoi

```ts
const info = await transport.sendMail({
  from, to, cc, bcc, replyTo,
  subject, text, html,
  attachments: [{ filename, content, contentType }],
  inReplyTo,  // Message-ID original (pour reply)
  references, // [Message-ID original] (pour threading)
});
```

### Discipline PEEK (rappel critique)

> Toute commande qui fetch le corps d'un message doit utiliser `BODY.PEEK[...]` — jamais `BODY[...]` ni `RFC822` sans PEEK. ImapFlow utilise automatiquement PEEK dans ses méthodes `fetch`/`fetchOne`/`download`. Cette discipline doit être maintenue dans tout code futur.

---

*Fin de l'audit.*
