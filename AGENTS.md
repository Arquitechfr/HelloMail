# AGENTS.md — HelloMail Workspace

Client webmail from-scratch (façon Thunderbird, mais web).

## Stack

- **Monorepo pnpm** : `backend/` (Node.js ESM + Express + MongoDB/Mongoose + Zod), `frontend/` (Next.js 16 App Router + TypeScript + Tailwind v4 + shadcn/ui + Zustand + TanStack Query).
- **TypeScript strict**, ESM (`"type": "module"`), imports `.js` obligatoires côté backend.
- **pnpm exclusif**.

## Commandes

```bash
pnpm dev                          # Démarre le backend (tsx watch)
pnpm dev:all                      # Démarre backend + worker + frontend en parallèle
pnpm dev:backend                  # Démarre backend + worker en parallèle
pnpm build                        # Compile le backend (tsc → dist/)
pnpm typecheck                    # Vérification des types backend (tsc --noEmit)
pnpm start                         # Démarre le backend en production (node dist/app.js)
pnpm --filter backend test          # Lance les tests Vitest backend
pnpm --filter backend test:coverage # Lance les tests avec couverture
pnpm --filter backend dev:worker    # Démarre le sync worker (tsx watch)
pnpm --filter frontend dev          # Démarre le frontend (next dev, port 3001)
pnpm --filter frontend build        # Build production Next.js
pnpm --filter frontend lint         # ESLint frontend
pnpm --filter frontend test         # Tests Vitest frontend (Testing Library + jsdom)
pnpm --filter frontend typecheck    # tsc --noEmit frontend
```

## Conventions globales

- **Répondre en français** toujours.
- **Sécurité** : jamais de secret/clé/token en clair dans le code, les logs ou les commits. `.env` non committé.
- **300 lignes max par fichier** (350 toléré si impossible à découper).
- **Messages d'erreur en français** côté API.
- **Conventional Commits** : `type(scope): description`.
- **Tests obligatoires** : Vitest (748 tests, 106 fichiers — 593 backend + 155 frontend). Ne pas livrer sans `pnpm test`.
- **Design frontend centralisé** : `frontend/src/app/globals.css` est l'unique source de vérité pour le design. Aucune couleur hardcodée dans les composants.
- **Header fixe, Hub de réglages Master-Detail, Rédaction & Recherche universelles** : Header permanent unifié (`AppHeader`), navigation modulaire responsive avec détection de résolution d'écran (`/mail/settings`), fenêtre de rédaction universelle flottante (`ComposePanel`), recherche globale Spotlight (`GlobalSearchDialog` Cmd+K) et autoconfiguration email épurée (`AddAccountDialog`).

## Structure

```
HelloMail/
├── backend/     # API REST (Express + MongoDB) — Phases 1-16 livrées
├── frontend/    # Web client (Next.js + shadcn/ui) — Phases 1-16 livrées
└── pnpm-workspace.yaml
```

## État d'avancement

- **Phase 1** ✅ — Auth + comptes IMAP/SMTP + chiffrement + middleware
- **Phase 2** ✅ — Sync worker IMAP IDLE + modèle Message
- **Phase 3** ✅ — Lecture email + envoi + dossiers CRUD + flags/actions + markAsJunk + dossiers spéciaux + sanitization HTML + pool IMAP API + Vitest (187 tests)
- **Phase 4** ✅ — Frontend Next.js 16 + shadcn/ui + glassmorphism + auth + comptes + dossiers + liste virtualisée + lecteur iframe sandbox + compose/reply/forward + brouillons auto-save + recherche + SSE temps réel
- **Phase 5** ✅ — Sécurité backend (Helmet, pino, rate limit global) + recherche + brouillons + temps réel (SSE)
- **Phase 6** ✅ — Sync multi-dossiers (polling dossiers spéciaux) + pagination arrière + OAuth Google XOAUTH2 + 2FA (TOTP + WebAuthn) + contacts + observabilité (Prometheus + health enrichi)
- **Phase 7 & Refonte UI Pro** ✅ — Refonte Header fixe compact (actions rapides, recherche, menu profil complet) + sous-pages dédiées (paramètres, sécurité 2FA, carnet d'adresses) + autoconfiguration email (ISPDB / MX) + OAuth Microsoft XOAUTH2 + signatures d'email personnalisées par compte + rate limiting distribué Redis (RedisStore) + drag & drop pièces jointes (`AttachmentDropzone`) + élimination totale des `as any`.
- **Phase 8 (Lots 8.1 à 8.5 — Intégralité livrée)** ✅ :
  - **Lot 8.1** : Threading & Vue Conversation (`inReplyTo` + `messageId` + normalisation sujet, endpoint `GET /thread`, timeline & accordéon `MessageThreadView`, réponse rapide `QuickReplyBar`).
  - **Lot 8.2** : Export d'emails bruts RFC 822 (`.eml`, streaming PassThrough PEEK) + Impression dédiée (`@media print`, masquage navigation/header, raccourci P).
  - **Lot 8.3** : Notifications bureau natives (`Notification` Web API avec permission dynamique) + Carillon audio Web Audio API synthétisé (zéro asset externe) + bascule dans les réglages et réaction SSE `message:new`.
  - **Lot 8.4** : Moteur de Règles & Filtres automatiques (Modèle `Rule`, validation Zod, service d'évaluation et d'actions moveToFolder/markAsRead/markAsFlagged/markAsJunk/delete, intégration temps réel dans `idleLoop.ts`, page UI dédiée `/mail/settings/rules`, ordonnancement par priorité).
  - **Lot 8.5** : Accusés de lecture (MDN RFC 3798 — demande à l'envoi `Disposition-Notification-To`, détection à la lecture, bannière discrète `ReadReceiptBanner` avec confirmation/ignorance et émission du rapport MIME `multipart/report; report-type=disposition-notification`).
- **Phase 9 : Productivité & Organisation (Intégralité livrée)** ✅ :
  - **Lot 9.1** : Étiquettes & Libellés colorés (Modèle `Tag`, validation Zod, service avec renommage/suppression en cascade, routes `/api/tags` et `/api/accounts/:accountId/messages/:folder/:uid/tags`, composant `TagBadge`, composant `TagSelectPopover`, gestionnaire complet `TagManager` dans `/mail/settings`, filtrage dynamique dans `MessageList` et `AccountSidebar`, action `applyTag` dans le moteur de règles).
  - **Lot 9.2** : Annulation d'envoi ("Undo Send" 5s-30s) (Préférence configurable 0-30s via `PATCH /api/auth/preferences`, dock interactif `UndoSendDock` avec compte à rebours en direct, jauge animée fluide, bouton "Annuler" et raccourci clavier `Z`, envoi immédiat anticipé, réouverture intégrale du formulaire avec destinataires, CC/BCC, sujet, HTML et pièces jointes intactes, protection `beforeunload`).
  - **Lot 9.3** : Modèles d'emails & Réponses types (Modèle `Template`, validation Zod, service multi-tenant & routes `/api/templates`, composant `TemplateInsertDropdown` intégré dans `ComposeForm` et `QuickReplyBar`, gestionnaire complet `TemplateManager` dans `/mail/settings`).
  - **Lot 9.5** : Système de Logos Logo.dev (Endpoint `https://img.logo.dev/:domain` proxifié côté backend `/api/logos/:domain`, format PNG transparent, résolution retina 128px, fallback 404, cache bi-niveau mémoire in-process + Redis 7 jours, composant unifié `EmailAvatar` avec repli instantané sur les initiales, appliqué à la liste d'emails `MessageListItem`, au header utilisateur `UserDropdown`, aux comptes `AccountItem`, aux réglages `SettingsAccountsSection`, au lecteur `MessageMetadataHeader` et aux contacts `ContactsManager`, 0 clé exposée côté frontend).
  - **Lot 9.6** : Contenu prédéfini (presets) — seed automatique à l'inscription et lazy au login/refresh pour les comptes existants (flag `defaultsSeededAt` sur `User`, jamais re-semé après suppression). 8 libellés colorés, 4 règles de tri actives à actions sûres (`applyTag`/`markAsRead`/`markAsFlagged`), 6 modèles d'emails FR avec raccourcis. Champ `isPreset` sur `Tag`/`Rule`/`Template` + badge « Prédéfini » dans `TagManager`, `RulesList` et `TemplateManager`.
  - Couverture : **422 tests Vitest, 45 fichiers, 0 `as any`**.
- **Phase 10 : Durcissement post-audit (Intégralité livrée)** ✅ :
  - Sync des comptes OAuth dans `accountRegistry` (tous providers), parser `/send` 30 Mo monté avant le global (erreurs body-parser → 413), logger pino partout dans le worker.
  - **Lock distribué Redis** (`syncLock.ts`) : `SET NX PX` + token propriétaire + renouvellement de bail + arrêt auto si lock perdu + fail-open si Redis down ; intégré au cycle de vie `accountRegistry`.
  - **Heartbeat worker** : clé Redis TTL 90 s écrite toutes les 30 s par `worker.ts` ; `/api/health` expose `services.worker` (`running`/`stale`/`unknown`, 503 si stale).
  - **Cache `Folder` en base** (TTL 5 min, invalidation CRUD, refresh par le worker) + validation d'existence du `folder` dans `messagesController.list` (404 si inconnu, bypass `Snoozed`).
  - **Recherche IMAP serveur** en fallback automatique (`imapSearchService` — critères SEARCH, import PEEK borné à 200 UID, repli sans `TEXT`, fusion via re-requête locale) + badge "serveur" dans `SearchBar`/`GlobalSearchDialog`.
  - **QRESYNC delta sync** : modèle `FolderSyncState` (uidValidity + highestModseq), `changedSince` dans `runInitialSyncForFolder`, purge sur changement d'UIDVALIDITY, fallback sync classique.
  - **Sync expéditeurs → contacts** : préférence opt-in `autoAddContacts` (`PATCH /api/auth/preferences`), `addSenderContactIfEnabled` dans `idleLoop` (best-effort), toggle `AutoContactsSettings`.
  - **Cache corps de messages** : modèle `MessageBody` (TTL 30 j, cap 2 Mo, purge sur delete/move/expunge) intégré à `messageFetchService`.
  - **Socle de tests frontend** : Vitest + Testing Library + jsdom (`pnpm --filter frontend test`), stub lucide-react, 27 tests (stores, utils, SearchBar, AutoContactsSettings).
- **Phase 11 : Parachèvement Webmail & Interopérabilité (Intégralité livrée)** ✅ :
  - **Lot 11.1** : Authentification WebAuthn / Passkeys de bout en bout — Méthode `completeWebAuthnLogin`, émission des tokens JWT access + refresh cookie httpOnly, protection `authRateLimit` sur `login/start` et `login/finish`, seed lazy des presets utilisateur, bouton "Se connecter avec une Passkey" sur `LoginForm` et enregistrement de clé dans `TwoFactorSettings`.
  - **Lot 11.2** : Synchronisation multi-dossiers dynamique complète — Découverte en temps réel de tous les dossiers IMAP du compte (`client.list()`, cache `FolderModel` et résolveurs `specialFolders`), exclusion `INBOX` et `\Noselect`, émission SSE ciblée `{ folder: path }`.
  - **Lot 11.3** : Carnet d'adresses — Import / Export — Service `contactImportExportService` (vCard `.vcf` RFC 6350 & CSV RFC 4180), déduplication stricte par email, endpoints `GET /api/contacts/export` et `POST /api/contacts/import`, modale d'import `ContactImportDialog`, actions Exporter/Importer dans `ContactsManager`.
  - **Lot 11.5** : Gestion des dossiers et sous-dossiers (CRUD complet) — Sécurisation backend (`folderProtection.ts`, interdiction 403 de modification/suppression pour `INBOX` et dossiers système, cascade de mise à jour/purge des messages et caches), helpers de hiérarchie délimités (`folder-utils.ts`), menu contextuel au clic droit (`FolderContextMenu`) et menu à 3 points verticaux (`FolderActionsMenu`, `MoreVertical`) avec raccourcis (`⇧N`, `F2`, `Suppr`), dialogue de création/renommage (`FolderFormDialog`), confirmation de suppression (`FolderDeleteDialog`), bouton création racine dans `FolderTree` et mise à jour du dialogue des raccourcis.
  - **Lot 11.6** : Raccourcis rapides, Menu contextuel (Clic droit) & Actions d'emails — Primitives UI `ContextMenu` (`@base-ui/react/context-menu`), menu contextuel complet au clic droit (`MessageContextMenu`), barre d'actions rapides au survol (`MessageQuickActions` avec Lu/Non-lu, Étoile, Archive, Supprimer, et menu 3 points `MoreVertical`), hook réutilisable d'actions (`useMessageActions`), gestionnaire universel de raccourcis clavier (`useEmailShortcuts` — R, Shift+R, F, U, S, E, !, Suppr, P avec garde-fou input/modal), actualisation du dialogue d'aide des raccourcis (`KeyboardShortcutsDialog`).
  - Couverture : **428+ tests Vitest backend, 56 tests Vitest frontend (12 fichiers), 0 `as any`**.
- **Phase 12 : Dossiers Unifiés, Mise en avant (Pin) & Couleurs de Compte (Intégralité livrée)** ✅ :
  - **Couleurs de compte & héritage** : Palette harmonieuse de 12 teintes (`accountColors.ts`), attribution sans doublon à l'enregistrement (`getNextAccountColor`), synchronisation avec `FolderTree` et `FolderNodeItem` (`accountColor={account.color}`), sélecteur interactif `AccountColorPicker` dans `AccountItem`.
  - **Mise en avant des emails (Pin / Épinglage)** : Champs `isPinned` et `pinnedAt` sur `MessageModel`, index composé `{ accountId: 1, isPinned: -1, date: -1 }` maintenant les emails épinglés en haut des listes, route `PATCH /:accountId/messages/:folder/:uid/pin`, actions contextuelles et barre d'outils (`Pin`, raccourci clavier `H`), mise en valeur visuelle subtile dans `MessageListItem`.
  - **Dossiers unifiés (Unified Folders)** : Modèle de préférences `unifiedFoldersEnabled` et `unifiedFolders` (`IUnifiedFolderConfig`), moteur d'agrégation `unifiedMessagesService.ts` (`GET /api/unified/messages`, `GET /api/unified/status`), modale complète de gestion et réordonnancement `ManageUnifiedFoldersDialog`, section dédiée `UnifiedFolderList` dans `AccountSidebar`, vue unifiée complète `/mail/unified/[type]`, identification des comptes d'origine par pastille de couleur.
  - Couverture : **478 tests Vitest backend (55 fichiers), 84 tests Vitest frontend (21 fichiers) — 562 tests au total, 0 `as any`**.
- **Phase 13 : Envoi Programmé (Send Later) & Persistance des Pièces Jointes en Brouillon (Intégralité livrée)** ✅ :
  - **Lot 13.1 : Persistance des pièces jointes dans les brouillons IMAP** : Schéma `draftAttachmentSchema` (validation filename, content base64, contentType), composition MIME multipart/mixed via `MailComposer` dans `draftService.saveDraft`, gestion des pièces jointes dans les auto-saves et chargements de brouillons, libération stricte des connexions pool.
  - **Lot 13.2 : Envoi programmé d'emails ("Send Later") de bout en bout** : Modèle `ScheduledMessage` avec index `{ scheduledAt: 1, status: 1 }` et états `pending | processing | sent | failed | cancelled`, schéma Zod `scheduleEmailSchema` avec validation stricte de date future (>1 min), service `scheduledEmailService` (programmation, listing, annulation), exécuteur périodique sécurisé `scheduledEmailRunner` dans le sync worker (verrou atomique `findOneAndUpdate`, retry exponentiel 3 tentatives max, publication temps réel SSE `scheduled:sent`), routes REST `/api/accounts/:accountId/scheduled`, Split Button "Envoyer / Programmer" (`ComposeActions`), dialogue de presets intelligents + date/heure personnalisée (`ScheduleSendDialog`), dialogue de consultation et d'annulation des envois programmés (`ScheduledMessagesDialog`), hook dédié `useScheduleSend`.
  - Couverture : **496 tests Vitest backend (58 fichiers), 90 tests Vitest frontend (23 fichiers) — 586 tests au total, 0 `as any`**.
- **Phase 14 : Multi-identités & Alias d'expédition ("Send As") (Intégralité livrée)** ✅ :
  - **Sous-document d'alias dans `Account`** : sous-document `aliases: [{ _id, name, email, isDefault, createdAt }]` avec validation Zod d'email, unicité par compte, interdiction de l'adresse principale comme alias et bascule exclusive de l'état `isDefault`.
  - **CRUD sécurisé des alias** : endpoints `GET /api/accounts/:id/aliases`, `POST`, `PATCH /:aliasId`, `DELETE /:aliasId`, schémas Zod `aliasSchemas.ts` et service transactionnel `aliasService.ts`.
  - **Expédition avec alias conforme RFC 5322 & Anti-spoofing** : méthode `verifySenderIdentity` rejetant toute identité non configurée pour le compte (400), entête SMTP `Sender: account.emailAddress` quand un alias est employé avec en-tête `From: alias.name <alias.email>`, intégration directe dans `sendEmail`, `scheduleEmail` et les brouillons.
  - **Interface utilisateur de gestion et sélection d'alias** : dialogue de gestion `AccountAliasesDialog` accessible depuis `AccountItem` (ajout, modification, suppression, désignation comme expéditeur par défaut), sélecteur d'identité réactif "De :" dans `ComposeRecipients`, et persistance de l'expéditeur lors de l'annulation d'envoi ("Undo Send") dans `undoSendStore`.
  - Couverture : **511 tests Vitest backend (60 fichiers), 103 tests Vitest frontend (25 fichiers) — 614 tests au total, 0 `as any`**.
- **Phase 15 : Sécurité Avancée & Chiffrement de bout en bout OpenPGP (E2EE) (Intégralité livrée)** ✅ :
  - **Moteur cryptographique client OpenPGP** : bibliothèque `openpgp` (RFC 4880 / RFC 9580), support des clés Curve25519 (Ed25519/Cv25519) et RSA 4096-bit, fonctions de génération de paires avec passphrase optionnelle, inspection de blocs ASCII-armor, signature claire (`cleartextStream`), chiffrement asymétrique multi-destinataires, déchiffrement et vérification d'authenticité (`pgpCrypto.ts`).
  - **Gestion backend des clés OpenPGP** : modèle `PgpKey` avec index composés `{ userId: 1, isOwnKey: 1 }` et `{ userId: 1, email: 1 }`, validation Zod stricte `pgpSchemas.ts`, service transactionnel `pgpKeyService.ts` assurant le stockage des clés personnelles de l'utilisateur (avec clé privée chiffrée par passphrase ou publique seule) et l'annuaire des clés publiques de correspondants, routes REST sécurisées `/api/pgp`.
  - **Interface utilisateur de gestion des clés dans les Réglages** : section Dédiée OpenPGP dans `/mail/settings` (onglet Sécurité), dialogue assisté de génération de clé locale Web Crypto (`PgpGenerateKeyDialog`), dialogue d'import ASCII-armor (`PgpImportKeyDialog`), copie d'empreinte formatée et téléchargement `.asc`, gestion et suppression des clés de correspondants.
  - **Déchiffrement et vérification de signature dans le lecteur de message** : composant `PgpMessageBanner` détectant instantanément les messages chiffrés (`-----BEGIN PGP MESSAGE-----`) et signés en clair (`-----BEGIN PGP SIGNED MESSAGE-----`), invite de déchiffrement avec déverrouillage de passphrase locale si requise, affichage immédiat du texte déchiffré sécurisé et badge d'intégrité de la signature dans `MessageReader`.
  - **Chiffrement et signature à l'expédition** : hook `useComposePgp`, boutons basculables "Chiffrer" et "Signer" dans `ComposeActions`, recherche automatique de la clé publique du destinataire ou avertissement proactif, chiffrement/signature à la volée avant transmission SMTP ou mise en file d'attente dans `ComposeForm`.
  - Couverture : **520 tests Vitest backend (61 fichiers), 114 tests Vitest frontend (28 fichiers) — 634 tests au total, 0 `as any`**.
- **Stabilisation & Correctifs critiques (Accusés de réception MDN & Auto-enregistrement Contacts)** ✅ :
  - **Résolution de la boucle infinie d'accusé de réception (MDN)** : Ajout du champ `readReceiptSentAt` dans `MessageModel`, persistance à l'envoi de l'accusé via `receiptService`, injection dans `MessageDetail`, et bascule immédiate en état confirmé (coche verte) dans `ReadReceiptBanner`.
  - **Délivrance universelle des demandes d'accusé** : Formatage standardisé RFC 2822 / 3798 `formattedFrom` / `<email>`, émission des en-têtes universels `Disposition-Notification-To`, `Return-Receipt-To` et `X-Confirm-Reading-To` dans `sendService`, et parsing multi-plateforme avec repli regex `\r?\n` et dépliage des en-têtes multilignes (folded headers) dans `messageFetchService`.
  - **Auto-enregistrement robuste des contacts expéditeurs** : Cast de l'identifiant utilisateur `new Types.ObjectId(userId)` pour l'upsert MongoDB dans `contactService`, extraction propre des adresses sans chevrons, filtrage des expéditeurs automatiques et robots (`noreply`, `mailer-daemon`, `bounce`, `notification`), et branchement systématique dans tous les flux de synchronisation (`runInitialSyncForFolder`, `syncFolderDelta`, `pollingSync` et consultation de message).
  - Couverture globale : **517 tests Vitest backend (61 fichiers), 118 tests Vitest frontend (29 fichiers) — 635 tests au total, 0 `as any`**.
- **Phase 16 : Productivité & Interopérabilité avancée (Intégralité livrée)** ✅ :
  - **Lot 16.1 : Désabonnement en 1 clic (List-Unsubscribe RFC 2369 / RFC 8058)** : Service `unsubscribeService.ts` avec parsing exhaustif des en-têtes `List-Unsubscribe` et `List-Unsubscribe-Post`, exécution sécurisée One-Click POST via proxy backend pour contourner les restrictions CORS, déclenchement client `mailto:` automatique avec sujet et corps par défaut, extraction intégrée dans `messageFetchService.fetchMessageDetail`, composant bouton discret `UnsubscribeButton` dans l'en-tête de message avec dialogue modal de confirmation `UnsubscribeDialog` et badge de confirmation "Désabonné", route dédiée `POST /api/accounts/:accountId/messages/:folder/:uid/unsubscribe`.
  - **Lot 16.2 : Blocage d'expéditeur en 1 clic ("Block Sender")** : Service `blockSenderService.ts` avec extraction canonique de l'adresse de l'expéditeur, création transactionnelle et idempotente d'une règle de tri prioritaire dans `RuleModel` (critère `from` = expéditeur, action `markAsJunk`), déplacement instantané du message courant vers les spams via `markMessageAsJunk`, notification temps réel SSE `message:deleted`, dialogue d'avertissement et confirmation `BlockSenderDialog`, entrée contextuelle `Bloquer l'expéditeur` dans `MessageContextMenu` et action directe dans le header `MessageMetadataHeader`, route `POST /api/accounts/:accountId/messages/:folder/:uid/block-sender`.
  - **Lot 16.3 : Import d'emails bruts RFC 822 (.eml) dans un dossier IMAP** : Schéma de validation `importEmailSchema` (limite 25 Mo, décodage buffer/base64), service `importEmailService.ts` assurant l'append direct sur le serveur IMAP distant avec flag `\Seen`, réconciliation immédiate en base MongoDB via `mirrorImportedMessageToMongo` et diffusion SSE `message:new`, endpoint REST `POST /api/accounts/:accountId/messages/:folder/import`, dialogue complet avec drag & drop, prévisualisation de taille et barre de progression `ImportEmlDialog` accessible par le menu 3 points `FolderActionsMenu` et le clic droit `FolderContextMenu`.
  - Couverture globale : **543 tests Vitest backend (65 fichiers), 128 tests Vitest frontend (32 fichiers) — 671 tests au total, 0 `as any`**.
- **Phase 17 : Performance Réseau, Compression & Indexation Critique (Intégralité livrée)** ✅ :
  - **Lot 17.1 : Compression HTTP Express sélective** : Middleware `compressionMiddleware.ts` intégrant l'algorithme gzip/deflate avec un seuil de déclenchement calibré à 1024 octets (1 Ko), filtre personnalisé `compressionFilter` garantissant l'exemption stricte des flux temps réel Server-Sent Events (SSE `/api/events`, `text/event-stream`) pour éliminer tout buffering de socket, respect du header client `x-no-compression`, et 6 tests unitaires dédiés.
  - **Lot 17.2 : Indexation MongoDB composée optimisée** : Élimination des tris en mémoire (in-memory sort) sur les boîtes volumineuses via l'index composé 4 champs `{ accountId: 1, folder: 1, isPinned: -1, date: -1 }` et l'index de gestion des dossiers snoozés `{ accountId: 1, folder: 1, snoozedUntil: 1 }` dans `MessageModel`, validés par tests unitaires.
  - **Lot 17.3 : Prefetching prédictif TanStack Query** : Préchargement automatique du détail de message dans `MessageListItem` au survol de la souris avec debounce de 65 ms et nettoyage instantané `clearTimeout` sur `onMouseLeave` (élimine les requêtes parasites de scroll rapide), fonction helper `fetchMessageDetail` réutilisée, réduisant la latence d'affichage au clic à moins de 5 ms.
  - **Lot 17.4 : Code-Splitting & Dynamic Imports Next.js** : Utilisation de `next/dynamic` (`ssr: false`) pour le découpage des composants modaux lourds (`ImportEmlDialog` dans `FolderTree`, `PgpGenerateKeyDialog` et `PgpImportKeyDialog` dans `PgpKeyManager`), allégeant le bundle initial tout en maintenant une navigation fluide.
  - Couverture globale : **593 tests Vitest backend (69 fichiers), 140 tests Vitest frontend (36 fichiers) — 733 tests au total, 0 `as any`**.
- **Phase 18 : Expérience Power User : Multi-sélection, Commandes Clavier & Ergonomie des Modales (Intégralité livrée)** ✅ :
  - **Lot 18.1 : Moteur de multi-sélection intelligente** : Ajout de `lastSelectedUid` et de l'action `selectRangeUids` dans `uiStore`, sélection par plage continue (`Shift + Clic` sur conteneur et bouton rond), bascule unitaire (`Ctrl/Cmd + Clic`), sélection globale (`Cmd + A`) et désélection (`Échap`).
  - **Lot 18.2 : Docks d'actions groupées flottants animés** : `BatchActionBar` et `UnifiedBatchActionBar` transformés en barres flottantes animées via `framer-motion` (`AnimatePresence`, `motion.div`), compteurs dynamiques en temps réel et tooltips annotés de raccourcis (`U`, `H`, `!`, `Suppr`, `Échap`, `Ctrl+A`).
  - **Lot 18.3 : Raccourcis clavier de navigation et de sélection** : Hook réutilisable `useListNavigationShortcuts` partagé entre les vues standard et unifiées, commandes Superhuman/Thunderbird (`J`/`K`/`X`/`Shift+J`/`Shift+K`/`Cmd+A`/`Échap`), documentation interactive dans `KeyboardShortcutsDialog`.
  - **Lot 18.4 : Ergonomie des modales adaptatives en 2 sections & neutralisation des scrollbars** : Découpage adaptatif en 2 sections sur grand écran pour les modales denses (`KeyboardShortcutsDialog`, `RuleDialog` / `RuleForm` avec `RuleConditionsSection` et `RuleActionsSection`, `AccountAliasesDialog` avec `AccountAliasItem`, `ManageUnifiedFoldersDialog`, `AddAccountDialog`, `ScheduledMessagesDialog`), préservation d'une seule section compacte sur mobile ou contenu court, et masquage global des scrollbars disgracieuses via `.no-scrollbar`.
  - Couverture globale : **593 tests Vitest backend (69 fichiers), 155 tests Vitest frontend (37 fichiers) — 748 tests au total, 0 `as any`**.



