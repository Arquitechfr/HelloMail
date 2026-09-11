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
- **Tests obligatoires** : Vitest (404 tests, 43 fichiers). Ne pas livrer sans `pnpm test`.
- **Design frontend centralisé** : `frontend/src/app/globals.css` est l'unique source de vérité pour le design. Aucune couleur hardcodée dans les composants.
- **Header fixe, Hub de réglages Master-Detail, Rédaction & Recherche universelles** : Header permanent unifié (`AppHeader`), navigation modulaire responsive avec détection de résolution d'écran (`/mail/settings`), fenêtre de rédaction universelle flottante (`ComposePanel`), recherche globale Spotlight (`GlobalSearchDialog` Cmd+K) et autoconfiguration email épurée (`AddAccountDialog`).

## Structure

```
HelloMail/
├── backend/     # API REST (Express + MongoDB) — Phases 1-3, 5, 6, 7, 8 & 9 livrées
├── frontend/    # Web client (Next.js + shadcn/ui) — Phases 4, 6, 7, 8, Refonte Pro & 9 livrées
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
  - Couverture : **438+ tests Vitest backend, 75 tests Vitest frontend (17 fichiers), 0 `as any`**.



