<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-adds the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — HelloMail Frontend

Client webmail Next.js consommant l'API REST HelloMail (`backend/`).

## Stack

- **Next.js 16** App Router + TypeScript strict
- **Tailwind CSS v4** (PostCSS, `@theme` dans `globals.css`)
- **shadcn/ui** (style base-nova, Base UI)
- **Zustand** (UI state + access token en mémoire)
- **TanStack Query** (cache/invalidation données serveur)
- **TanStack Virtual** (virtualisation liste messages)
- **next-themes** (clair/sombre)
- **framer-motion** (animations glass)
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
│   ├── globals.css         # ⭐ SOURCE DE VÉRITÉ DESIGN — @theme + vars shadcn + glass + aurora + utilitaires
│   ├── layout.tsx          # Root : AuroraBackground, ThemeProvider, QueryProvider, Toaster
│   ├── page.tsx            # Redirect → /login ou /mail
│   ├── api/auth/refresh/   # Route Handler server-side (forward cookie → backend refresh)
│   ├── (auth)/             # login, register
│   └── (mail)/             # layout authentifié + [accountId]/[[...folder]]
├── components/
│   ├── ui/                 # composants shadcn (button, input, dialog, etc.)
│   ├── auth/               # LoginForm, RegisterForm
│   ├── accounts/           # AccountList, AddAccountDialog, AccountItem
│   └── mail/               # GlassPanel, AccountSidebar, FolderTree, MessageList, MessageReader, EmailIframe, etc.
├── lib/
│   ├── api.ts              # fetch wrapper + interceptor 401 → refresh (lock en vol)
│   ├── api-types.ts        # types API (Account, Message, Folder, etc.)
│   ├── queries/            # hooks TanStack Query (auth, accounts, folders, messages, drafts)
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

## Design system centralisé

`src/app/globals.css` est l'unique source de vérité pour tout le design :
- **Section 1** : `@theme` Tailwind v4 (couleurs OKLCH, fonts, radius) → génère les utilitaires.
- **Section 2** : Variables shadcn/ui (light + dark, convention OKLCH).
- **Section 3** : Variables glass (bg, border, shadow, blur, saturate — light + dark).
- **Section 4** : Variables aurora (couleurs du fond gradient animé).
- **Section 5** : Utilitaires `.glass`, `.glass-strong`.
- **Section 6** : Base + aurora background + scrollbar.

**Règle :** Aucune couleur/valeur hardcodée dans les composants. Tout passe par les tokens Tailwind (`bg-background`, `text-primary`) ou la classe `.glass`. `tailwind.config.ts` ne définit pas de couleurs.

## Patterns

- **`apiFetch`** : wrapper fetch avec injection `Authorization: Bearer`, `credentials: 'include'`, interceptor 401 → refresh (lock en vol via Promise partagé), retry une seule fois, `ApiError` structurée.
- **`authStore`** : access token en mémoire (Zustand non persisté, jamais localStorage). Refresh via cookie httpOnly (Route Handler server-side).
- **TanStack Query** : `staleTime` 30s, invalidation ciblée après mutations et événements SSE.
- **Zustand** : UI state (compte/dossier/message sélectionnés, compose). `uiStore` persisté partiellement (compte/dossier) via localStorage (pas de secrets).
- **iframe sandbox** : `sandbox="allow-same-origin"` sans `allow-scripts` ni `allow-forms` ni `allow-popups`. `srcDoc` uniquement. Auto-resize via `ResizeObserver` sur `contentDocument.body`.
- **SSE** : `EventSource` `/api/events?token=<accessToken>`. Reconnexion backoff exponentiel (1s → 30s), max 10, toast après dépassement. Cleanup au unmount.

## Sécurité

- Access token en mémoire uniquement (jamais localStorage/sessionStorage).
- Refresh via cookie httpOnly (proxy same-origin + Route Handler server-side).
- CSP stricte dans `next.config.ts` headers (`default-src 'self'`, `script-src 'self'`, `frame-src 'self'`).
- Validation Zod côté client sur les formulaires.
- Sanitization DOMPurify côté frontend avant envoi (défense en profondeur + backend sanitizé).
- Pas de `dangerouslySetInnerHTML` (iframe `srcDoc` uniquement).
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`.

## Conventions

- Composants ≤300 lignes, composition > héritage.
- Messages en français.
- Conventional Commits.
- Imports `@/*` (alias `src/`).
- Design glassmorphism (inspiré Inbox Zero + ApexZero) — 3 colonnes frosted glass.
