<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-adds the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — Mailora Frontend

Client webmail Next.js consommant l'API REST Mailora (`backend/`).

## Stack

- **Next.js 16** App Router + TypeScript strict (Turbopack)
- **Tailwind CSS v4** (PostCSS, `@theme` dans `globals.css`)
- **shadcn/ui** (style base-nova, Base UI)
- **Zustand** (UI state + access token en mémoire)
- **TanStack Query** (cache/invalidation données serveur)
- **TanStack Virtual** (virtualisation liste messages)
- **next-themes** (clair/sombre)
- **framer-motion** (animations fluides)
- **lucide-react** (icônes)
- **date-fns** (formats dates FR)
- **zod** (validation formulaires côté client)
- **dompurify** (sanitization HTML compose, défense en profondeur)

## Commandes

```bash
pnpm --filter frontend dev        # Démarre le frontend (port 3001)
pnpm --filter frontend build      # Build production Next.js
pnpm --filter frontend lint       # ESLint
pnpm --filter frontend typecheck  # tsc --noEmit
pnpm --filter frontend test       # Vitest + Testing Library (155 tests, 37 fichiers)
pnpm --filter frontend start      # Démarre en production
```

## Structure

```
frontend/src/
├── app/
│   ├── globals.css         # ⭐ SOURCE DE VÉRITÉ DESIGN — @theme + vars shadcn + glass + utilitaires
│   ├── layout.tsx          # Root : AuroraBackground, ThemeProvider, QueryProvider, Toaster
│   ├── page.tsx            # Redirect → /login ou /mail
│   ├── api/auth/refresh/   # Route Handler server-side (forward cookie → backend refresh)
│   ├── (auth)/             # login, register
│   └── mail/               # layout authentifié avec AppHeader fixe
│       ├── [accountId]/[[...folder]] # vue principale webmail (dossiers + liste + lecteur)
│       ├── empty/          # état vide (aucun compte configuré)
│       ├── settings/       # Réglages généraux, signatures, notifications et étiquettes (Phases 7, 8, 9)
│       │   ├── security/   # Page dédiée 2FA TOTP + WebAuthn + codes de secours
│       │   └── rules/      # Page dédiée règles de tri & filtres automatiques (Phase 8)
│       └── contacts/       # Page dédiée carnet d'adresses (CRUD + recherche)
├── components/
│   ├── ui/                 # composants shadcn (button, input, dialog, dropdown-menu stabilisé, etc.)
│   ├── auth/               # LoginForm (2FA verify, WebAuthn Passkeys), RegisterForm, TwoFactorSettings, ContactsManager
│   ├── accounts/           # AccountList, AddAccountDialog (Autoconfig + Google/MS OAuth), AccountSignatureManager, AccountColorPicker, AccountAliasesDialog (Phase 14)
│   ├── security/           # PgpKeyManager, PgpGenerateKeyDialog, PgpImportKeyDialog (Phase 15)
│   └── mail/               # AppHeader, UserDropdown, KeyboardShortcutsDialog, SettingsNav, AttachmentDropzone,
│                           # MessageThreadView, QuickReplyBar, MessageMetadataHeader, GlassPanel, AccountSidebar,
│                           # FolderTree, MessageList, MessageListItem, MessageReader, ReadReceiptBanner, NotificationSettings,
│                           # TagBadge, TagSelectPopover, TagManager, UndoSendDock, UndoSendSettings,
│                           # ComposeRecipients, ComposeActions, rules/ (RuleDialog, RuleForm, RulesList), EmailIframe,
│                           # folders/ (FolderNodeItem, FolderFormDialog, FolderDeleteDialog, FolderActionsMenu, FolderContextMenu, ImportEmlDialog),
│                           # unified/ (UnifiedFolderList, ManageUnifiedFoldersDialog), BlockSenderDialog, UnsubscribeButton, UnsubscribeDialog,
│                           # ScheduleSendDialog, ScheduledMessagesDialog, PgpMessageBanner
├── test/                # setup.ts (jest-dom) + lucide-stub.tsx (icônes → svg vides en test)
├── lib/
│   ├── api.ts              # fetch wrapper + interceptor 401 → refresh (lock en vol)
│   ├── api-types.ts        # types API globaux + ré-export types modulaires
│   ├── compose-utils.ts    # utilitaires de rédaction (htmlToText, formatSignatureHtml)
│   ├── pgp/                # pgpCrypto.ts (Web Crypto + openpgp Curve25519 & RSA 4096)
│   ├── types/              # types modulaires découpés (tags.ts, rules.ts)
│   ├── notifications.ts    # Web Notification API + Web Audio API carillon synthétisé
│   ├── queries/            # hooks TanStack Query (auth, 2FA, accounts, autoconfig, folders, messages, drafts, contacts, rules, tags, pgp, scheduled)
│   ├── stores/             # authStore (token), uiStore (sélection, compose), undoSendStore (annulation d'envoi)
│   └── utils.ts            # cn(), formatDate, formatSize, downloadBlob, getInitials
├── hooks/
│   ├── useSSE.ts           # EventSource /api/events + invalidation TanStack Query + notifications sonores/desktop
│   └── useAuth.ts          # bootstrap session au mount
└── providers/
    ├── theme-provider.tsx   # next-themes
    ├── query-provider.tsx   # TanStack Query client
    └── aurora-background.tsx # fond gradient animé (matière pour le glass blur)
```

## Design system & Architecture UI Pro

- **`globals.css` source de vérité** : variables shadcn (OKLCH), tokens glass et aurora. Aucune couleur hardcodée.
- **Header fixe compact (`AppHeader`)** : barre d'outils permanente en haut contenant le logo Mailora, statut live SSE, actions rapides (Nouveau message, Synchroniser, Recherche globale Cmd+K, Raccourcis `?`, Thème) et menu profil (`UserDropdown`).
- **Recherche globale universelle (`GlobalSearchDialog`)** : palette Spotlight (Cmd+K / Ctrl+K ou bouton Rechercher) montée dans `MailLayout`, active sur toutes les pages (réglages, contacts, boîte...). Filtres d'opérateurs rapides (`is:unread`, `is:flagged`, `has:attachment`), sélecteur multi-comptes, aperçu des emails en direct, navigation flèches/Entrée et redirection directe vers le message.
- **Fenêtre de rédaction universelle (`ComposePanel`)** : modale flottante globale montée dans `MailLayout`, accessible depuis n'importe quel écran (Boîte de réception, Hub de réglages, Carnet d'adresses) via le bouton "Nouveau message", le raccourci `C`, la réponse rapide ou l'action "Écrire" d'un contact. Contrôles plein écran/restaurer (`Maximize2`/`Minimize2`), fermeture rapide (`X` ou `Échap`), repli automatique sur le compte actif/par défaut sans quitter le contexte ni naviguer.
- **Autoconfiguration email transparente & Formulaire épuré (`AddAccountDialog`)** : résolution automatique instantanée des serveurs IMAP et SMTP dès la saisie de l'email via `/api/accounts/autoconfig` (Mozilla ISPDB + DNS MX + heuristiques). Formulaire épuré affichant par défaut uniquement l'email, le mot de passe, le nom d'affichage et les boutons OAuth Google / Microsoft 365, avec panneau repliable "Paramètres du serveur (Avancé)" (`ServerSettingsAccordion`) pour les réglages manuels.
- **Élimination des arrondis excessifs** : transition des "bulles isolées" vers un layout épuré, élégant, dense et moderne adapté à un webmail pro.
- **Architecture des Réglages responsive (Master-Detail Hub)** :
  - Fin du système d'onglets horizontaux empilés au profit d'un hub unifié responsive avec détection dynamique de la résolution d'écran (`useScreenSize`).
  - `/mail/settings` : agencement Master-Detail avec navigation latérale catégorisée (`SettingsSidebar` avec badges dynamiques, recherche et indicateur de résolution), en-tête adaptatif (`SettingsHeader` avec breadcrumbs et sélecteur mobile) et conteneur fluide (`max-w-6xl`) tirant pleinement parti des grands écrans (grille 2/3 colonnes).
  - Unification fluide de tous les modules : Profil & Comptes (`SettingsAccountsSection`), Signatures, Modèles, Règles, Libellés, Sécurité & 2FA, Contacts, Notifications et Préférences d'affichage (`SettingsAppearanceSection`).
  - Compatibilité conservée : `/mail/settings/rules`, `/mail/settings/security` et `/mail/contacts` redirigent instantanément vers les sections correspondantes du hub unifié.
- **Typographie robuste** : pile de polices système moderne assurant un rendu parfait sans risque de glyphes manquants pour les emails internationaux.

- **Expérience Power User, Multi-sélection & Modales 2 sections (Phase 18)** :
  - **Moteur de sélection multiple continue** : `selectRangeUids` dans `uiStore` pour la sélection par plage continue (`Shift + Clic`), bascule unitaire (`Ctrl/Cmd + Clic`), sélection globale (`Cmd + A`) et désélection contextuelle (`Échap`).
  - **Docks d'actions groupées flottants animés** : `BatchActionBar` et `UnifiedBatchActionBar` transformés en docks flottants avec `framer-motion` (`AnimatePresence`), compteurs en direct, tooltips avec raccourcis clavier associés.
  - **Navigation & Commandes clavier universelles** : hook `useListNavigationShortcuts` partagé entre les listes de messages standards et unifiées (`J`/`K` ou flèches bas/haut pour circuler, `X` pour cocher, `Shift+J`/`Shift+K` pour étendre la sélection, `Cmd+A` pour tout sélectionner, `Échap` pour vider la sélection ou fermer le lecteur).
  - **Modales en deux sections & neutralisation des scrollbars** : sur écrans moyens et larges (`md:` ou `lg:`), affichage adaptatif en deux sections/colonnes équilibrées pour les contenus longs (`KeyboardShortcutsDialog`, `RuleDialog` / `RuleForm` via `RuleConditionsSection` et `RuleActionsSection`, `AccountAliasesDialog` via `AccountAliasItem`, `ManageUnifiedFoldersDialog`, `AddAccountDialog` avec paramètres serveurs dépliés, `ScheduledMessagesDialog`), préservation d'une seule colonne compacte pour les contenus courts et suppression globale des scrollbars disgracieuses via `no-scrollbar`.
- **Performance Réseau, Prefetching & Dynamic Splitting (Phase 17)** : Prefetching prédictif TanStack Query dans `MessageListItem` au survol de la souris (debounce 65 ms, annulation `onMouseLeave`, cache local `staleTime: 60s`, affichage au clic < 5 ms) ; découpage du bundle via `next/dynamic` (`ssr: false`) pour les dialogues modaux lourds (`ImportEmlDialog`, `PgpGenerateKeyDialog`, `PgpImportKeyDialog`).
- **Mise en sommeil d'emails ("Snooze" - Phase 9 Lot 9.4)** : mise en sommeil différée avec `SnoozeDropdown` dans `MessageToolbar` (4 presets : Plus tard aujourd'hui, Demain matin, Ce week-end, La semaine prochaine, ou sélecteur datetime-local sur mesure) ; toast de confirmation avec bouton "Annuler" immédiat ; exclusion automatique des boîtes standards et dossier virtuel dédié "En sommeil" dans `AccountSidebar` ; badge visuel d'échéance `snoozedUntil` dans `MessageListItem` ; réveil automatique temps réel par le sync worker (`message:new`).
- **Modèles d'emails & Réponses types (Phase 9 Lot 9.3)** : composant `TemplateInsertDropdown` avec recherche en direct, raccourcis clavier et aperçu rapide, intégré directement dans `ComposeActions` (ComposeForm plein écran) et `QuickReplyBar` (réponse rapide fil de discussion) ; insertion fluide du sujet et du corps HTML/texte avec conservation du curseur ; gestionnaire d'administration complet `TemplateManager` dans `/mail/settings` (création, édition, suppression, affectation globale ou par compte IMAP, gestion des raccourcis).
- **Annulation d'envoi ("Undo Send" - Phase 9 Lot 9.2)** : délai de grâce configurable (0s, 5s, 10s, 15s, 30s) avec sélecteur dans les réglages et persistance backend (`PATCH /api/auth/preferences`) ; dock flottant interactif `UndoSendDock` avec compte à rebours continu, jauge de progression, bouton "Annuler" et raccourci clavier `Z` ; restauration instantanée du formulaire de composition (`ComposeForm`) avec préservation de l'intégralité du sujet, destinataires, CC/BCC, HTML riche, pièces jointes et brouillon IMAP ; protection anti-perte `beforeunload` en cas de tentative de fermeture d'onglet.
- **Étiquettes & Libellés colorés (Phase 9 Lot 9.1)** : `TagBadge` (badges personnalisés avec couleur et bouton de retrait), `TagSelectPopover` (assignation et création inline), `TagManager` (CRUD complet dans `/mail/settings`), filtrage dynamique par libellé dans `AccountSidebar` et `MessageList`, intégration dans le moteur de règles (`applyTag`).
- **Moteur de Règles & Filtres automatiques (Phase 8)** : interface complète `/mail/settings/rules` avec dialogues adaptatifs, glisser-ordonner des priorités, conditions multiples et actions automatiques.
- **Accusés de lecture MDN (Phase 8)** : bannière discrète `ReadReceiptBanner` à l'ouverture d'un message avec demande d'accusé, émission transparente de rapport RFC 3798 ou rejet silencieux.
- **Notifications bureau & Carillon audio (Phase 8)** : Web Notification API native avec permission dynamique, carillon synthétisé Web Audio API sans aucun asset audio externe, bascule dans les réglages et déclenchement SSE.
- **Threading & Vue Conversation (Phase 8)** : `MessageThreadView` affichant la timeline chronologique des échanges avec sélection fluide, statut lu/non-lu, dossier d'appartenance et accordéon dépliable ; complété par `QuickReplyBar` pour répondre directement en bas du fil.
- **Export .eml & Impression dédiée (Phase 8)** : action de téléchargement du message brut RFC 822 (`.eml`) et impression dédiée avec feuille de style `@media print` masquant headers/barres latérales pour un rendu papier épuré (raccourci clavier `P`).
- **Autoconfiguration email (ISPDB / MX)** : saisie de l'email dans `AddAccountDialog` → interrogation automatique de `GET /api/accounts/autoconfig` via `useAutoconfig`, pré-remplissage transparent des paramètres IMAP et SMTP.
- **OAuth multi-fournisseurs** : boutons "Continuer avec Google" et "Continuer avec Microsoft" (XOAUTH2) pour configuration sans mot de passe d'application.
- **Signatures d'email par compte** : `AccountSignatureManager` permettant de configurer une signature spécifique par compte, automatiquement insérée dans `ComposeForm`.
- **Drag & Drop pièces jointes** : `AttachmentDropzone` dans le formulaire de rédaction avec aperçu des tailles, limite cumulée et suppression intuitive.
- **Raccourcis clavier** : modale d'aide interactive (`KeyboardShortcutsDialog`) accessible via la touche `?` ou le bouton d'en-tête.
- **2FA & Sécurité** : flux login à deux étapes avec token court temporaire, QR Code interactif et affichage sécurisé des codes de secours.
- **Composants Base UI résilients** : `DropdownMenuGroup` et `DropdownMenuLabel` adaptés pour éliminer les erreurs de contexte Base UI tout en conservant l'accessibilité sémantique (`role="group"`).
- **Virtualisation & Iframe Sandbox** : liste de messages haute performance via `@tanstack/react-virtual`, rendu des emails dans une iframe isolée (`allow-same-origin` sans scripts).

## Sécurité

- Access token en mémoire uniquement (Zustand non persisté, jamais de stockage local pour les tokens).
- Refresh token géré via cookie httpOnly protégé avec Route Handler server-side `/api/auth/refresh`.
- Sanitization DOMPurify côté client + assainissement strict côté serveur.
- Iframe sandboxée sans permissions d'exécution de scripts ou d'ouverture de popups non contrôlée.

## Conventions

- Composants ≤ 300 lignes (composition modulaire).
- Messages d'interface et d'erreur en français.
- Imports alias `@/*` (`src/`).
- Conventional Commits (`type(scope): description`).
