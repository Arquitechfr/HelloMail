# AGENTS.md — Sync Worker (services/sync)

Moteur de synchronisation IMAP IDLE. Tourne dans un process Node séparé (`worker.ts`).

## Règles de discipline (à respecter dans toute modification)

### Connexion read-write

INBOX est ouvert en **read-write** pour toute la session (initialSync + IDLE).
C'est nécessaire car IMAP n'envoie les notifications EXPUNGE qu'en mode SELECT
read-write. Le mode readOnly casserait la détection des suppressions.

**Contrainte critique** : aucune commande de fetch ne doit utiliser `BODY[]`,
`RFC822` ou `BODY[...]` sans `.PEEK`. Ces commandes marquent le message comme
`\Seen` côté serveur sans action explicite de l'utilisateur. Toute future
extension qui fetch le corps d'un message (phase de lecture d'email) doit
utiliser `BODY.PEEK[...]` — jamais `BODY[...]` ni `RFC822` sans PEEK.

Cette phase ne fetch que `envelope`, `flags`, `bodyStructure`, `size` : aucun
de ces éléments ne touche `\Seen`. La discipline PEEK doit être maintenue dans
tout code futur ajouté à ce dossier.

### Reconciliation bornée

`reconcileFolder` fetch **uniquement les UID connus en base** pour ce
compte/dossier (`UID FETCH <uids_connus> (UID)`), jamais `SEARCH ALL` sur la
mailbox entière. Le coût reste proportionnel au nombre de messages trackés
(~50 + nouveaux arrivés), pas à la taille totale de la boîte.

Ne pas "simplifier" cette fonction en scan complet sur une grosse boîte —
un `SEARCH ALL` sur une INBOX Gmail de 500k messages serait contre-productif.

### Logs

Aucun sujet ou corps d'email ne doit apparaître dans les logs en production
(`NODE_ENV=production`). Les sujets peuvent contenir des informations
sensibles. Logger uniquement des informations génériques (UID, compte,
nombre de messages, erreurs technique).

**Logger structuré** (Phase 5) : utiliser `logger` (pino) depuis
`config/logger.ts`, jamais `console.log`/`console.error`. La redaction
automatique retire les champs sensibles (`authorization`, `cookie`,
`password`, `token`, `encryptedPassword`, `encryptedRefreshToken`,
`req.body`). En développement, les logs sont prettifiés ; en production,
au format JSON.

### Séparation des responsabilités

Une classe/fonction par responsabilité, pas de logique éparpillée :
- `SyncManager` — cycle de vie d'un compte (connect, sync, idle, reconnexion, polling multi-dossiers Phase 6)
- `accountRegistry` — découverte des comptes actifs (polling)
- `initialSync` — fetch des 50 derniers messages, upsert idempotent
- `idleLoop` — boucle IDLE + handlers exists/expunge/flags (INBOX uniquement)
- `pollingSync` — polling des dossiers spéciaux via 2e connexion IMAP (Phase 6)
- `reconcileFolder` — reconciliation bornée sur expunge sans UID
- `reconcileAllFolders` — reconciliation multi-dossiers au démarrage (INBOX + dossiers spéciaux)
- `messageMapper` — transformation pure FetchMessageObject → MessageInput (inclut `inReplyTo` pour le threading Phase 8)

Garder cette séparation pour faciliter l'extraction future (Redis/BullMQ,
change streams, multi-dossiers, sharding multi-worker).

## Séparation API / Worker (Phase 3)

L'API (process `app.ts`) et le sync worker (process `worker.ts`) ont chacun
leurs propres connexions IMAP. Le worker gère l'IDLE et la sync ; l'API gère
la lecture, l'envoi, les dossiers et les actions via un pool dédié
(`services/email/imapPool.ts`). **Ne jamais partager une connexion ImapFlow
entre l'API et le worker** — ce sont des process séparés avec des cycles de
vie différents.

## Comportement IDLE (ImapFlow)

ImapFlow gère l'auto-IDLE en interne. Quand un handler d'événement appelle
`fetch`/`fetchOne`, la lib envoie `DONE` en coulisses, exécute la commande,
puis re-rentre en IDLE auto après `autoIdleDelay` (15s). Ne pas improviser
ce comportement — consulter la doc officielle (https://imapflow.com) en cas
de doute.

## QRESYNC

`qresync: true` est activé sur le client ImapFlow. Si le serveur ne supporte
pas QRESYNC, ImapFlow fait un fallback gracieux. Sans QRESYNC, les événements
EXPUNGE ne contiennent pas d'UID — `reconcileFolder` prend le relais.

## Publication d'événements temps réel (Phase 5)

Le worker publie des événements vers l'API via Redis Pub/Sub pour alimenter
le SSE côté frontend. La publication se fait via `publishEvent()` depuis
`services/realtime/eventPublisher.ts`.

### Points de publication

- `idleLoop.ts` (handler `exists`) → `message:new` après upsert d'un nouveau message.
- `idleLoop.ts` (handler `expunge`) → `message:deleted` après suppression en base.
- `idleLoop.ts` (handler `flags`) → `message:flags` après mise à jour des flags.
- `syncManager.ts` (désactivation auto) → `account:syncError` quand un compte est désactivé après trop d'échecs.

### Paramètre `userId`

`runIdleLoop` reçoit maintenant `userId` en paramètre (en plus de `accountId`
et `folder`). Ce `userId` est inclus dans chaque événement publié pour que
l'API puisse router l'événement vers le bon client SSE (filtrage par
`userId` côté `eventSubscriber`).

### Discipline des payloads

Les payloads d'événements ne contiennent **jamais** de sujet ou corps
d'email — uniquement des métadonnées minimales (UID, folder, flags, errorMsg).
Cette discipline est cohérente avec la règle de logs ci-dessus.

### Best-effort

La publication est best-effort : `publishEvent` catch ses propres erreurs et
n'interrompt jamais la synchronisation. Une panne Redis ne doit pas stopper
le worker. En mode test, aucune connexion Redis n'est établie (bypass).

## Polling multi-dossiers (Phase 6)

L'IDLE reste sur INBOX uniquement (une seule mailbox sélectionnée à la fois
en IMAP). Pour détecter les changements sur les dossiers spéciaux (Sent,
Drafts, Trash, Junk, Archive), `pollingSync.ts` ouvre une **seconde connexion
IMAP dédiée** au polling périodique de ces dossiers.

### Architecture

- `SyncManager` gère désormais **2 connexions IMAP** par compte actif :
  1. Connexion principale : IDLE INBOX (read-write, auto-IDLE ImapFlow).
  2. Connexion polling : `pollingSync` (read-write, polling périodique).
- Les deux connexions sont indépendantes (pas de conflit de sélection de
  mailbox). Elles partagent le même `AbortSignal` pour l'arrêt propre.
- `pollingSync` démarre après `runInitialSyncAll` + `reconcileAllFolders`.

### Polling

- Intervalle configurable via `POLLING_INTERVAL_MS` (défaut 60s).
- Pour chaque dossier spécial, fetch les UID récents (depuis le dernier UID
  connu en base) et upsert les nouveaux messages.
- Reconnexion avec backoff exponentiel en cas d'erreur IMAP.
- Arrêt propre via `AbortSignal` (intégré dans `syncManager.stop()`).

### Discipline PEEK maintenue

Le polling fetch uniquement `envelope`, `flags`, `bodyStructure`, `size` —
jamais `BODY[]` ni `RFC822` sans PEEK. La discipline PEEK de la connexion
principale s'applique identiquement à la connexion de polling.

### OAuth Google & Microsoft XOAUTH2 (Phases 6 & 7)

Si le compte a `provider: 'google_oauth'` ou `provider: 'microsoft_oauth'`, le `SyncManager` authentifie
IMAP via XOAUTH2 (access token à la place du mot de passe). L'access token
est renouvelé automatiquement via `oauthService.getValidGoogleAccessToken` ou
`microsoftOAuthService.getValidMicrosoftAccessToken` (qui utilisent le refresh token chiffré stocké en base). La connexion de
polling utilise le même mécanisme d'authentification XOAUTH2.

