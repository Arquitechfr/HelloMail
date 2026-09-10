<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-adds the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — HelloMail Frontend

Client webmail Next.js consommant l'API REST HelloMail (`backend/`).

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
pnpm --filter frontend dev        # Démarre le frontend (port 3000)
pnpm --filter frontend build      # Build production Next.js
pnpm --filter frontend lint       # ESLint
pnpm --filter frontend typecheck  # tsc --noEmit
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
│       ├── settings/       # Réglages généraux + signatures d'email par compte (Phase 7)
│       │   └── security/   # Page dédiée 2FA TOTP + WebAuthn + codes de secours
│       └── contacts/       # Page dédiée carnet d'adresses (CRUD + recherche)
├── components/
│   ├── ui/                 # composants shadcn (button, input, dialog, dropdown-menu stabilisé, etc.)
│   ├── auth/               # LoginForm (2FA verify), RegisterForm, TwoFactorSettings, ContactsManager
│   ├── accounts/           # AccountList, AddAccountDialog (Autoconfig + Google/MS OAuth), AccountSignatureManager
│   └── mail/               # AppHeader, UserDropdown, KeyboardShortcutsDialog, SettingsNav, AttachmentDropzone,
│                           # MessageThreadView, QuickReplyBar, MessageMetadataHeader, GlassPanel, AccountSidebar,
│                           # FolderTree, MessageList, MessageReader, EmailIframe, etc.
├── lib/
│   ├── api.ts              # fetch wrapper + interceptor 401 → refresh (lock en vol)
│   ├── api-types.ts        # types API (Account, Message, Folder, Contact, Autoconfig, Signature, etc.)
│   ├── queries/            # hooks TanStack Query (auth, 2FA, accounts, autoconfig, folders, messages, drafts, contacts)
│   ├── stores/             # authStore (token en mémoire), uiStore (sélection persistée)
│   └── utils.ts            # cn(), formatDate, formatSize, downloadBlob, getInitials
├── hooks/
│   ├── useSSE.ts           # EventSource /api/events + invalidation TanStack Query
│   └── useAuth.ts          # bootstrap session au mount
└── providers/
    ├── theme-provider.tsx   # next-themes
    ├── query-provider.tsx   # TanStack Query client
    └── aurora-background.tsx # fond gradient animé (matière pour le glass blur)
```

## Design system & Architecture UI Pro

- **`globals.css` source de vérité** : variables shadcn (OKLCH), tokens glass et aurora. Aucune couleur hardcodée.
- **Header fixe compact (`AppHeader`)** : barre d'outils permanente en haut contenant le logo HelloMail, statut live SSE, barre de recherche unifiée, actions rapides (Nouveau message, Rafraîchir, Raccourcis `?`, Thème) et menu profil (`UserDropdown`).
- **Élimination des arrondis excessifs** : transition des "bulles isolées" vers un layout épuré, élégant, dense et moderne adapté à un webmail pro.
- **Architecture par pages dédiées** :
  - `/mail/settings` : gestion des signatures personnalisées par compte + paramètres généraux.
  - `/mail/settings/security` : configuration 2FA (TOTP avec QR code, Passkeys WebAuthn, codes de secours).
  - `/mail/contacts` : gestionnaire complet de carnet d'adresses avec recherche instantanée.
- **Typographie robuste** : pile de polices système moderne assurant un rendu parfait sans risque de glyphes manquants pour les emails internationaux.

## Patterns & Fonctionnalités (Phases 6 & 7)

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
