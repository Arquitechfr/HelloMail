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
pnpm --filter frontend dev          # Démarre le frontend (next dev, port 3000)
pnpm --filter frontend build        # Build production Next.js
pnpm --filter frontend lint         # ESLint frontend
pnpm --filter frontend typecheck    # tsc --noEmit frontend
```

## Conventions globales

- **Répondre en français** toujours.
- **Sécurité** : jamais de secret/clé/token en clair dans le code, les logs ou les commits. `.env` non committé.
- **300 lignes max par fichier** (350 toléré si impossible à découper).
- **Messages d'erreur en français** côté API.
- **Conventional Commits** : `type(scope): description`.
- **Tests obligatoires** : Vitest (323 tests, 31 fichiers). Ne pas livrer sans `pnpm test`.
- **Design frontend centralisé** : `frontend/src/app/globals.css` est l'unique source de vérité pour le design. Aucune couleur hardcodée dans les composants.

## Structure

```
HelloMail/
├── backend/     # API REST (Express + MongoDB) — Phases 1-3 + 5 livrées
├── frontend/    # Web client (Next.js + shadcn/ui) — Phase 4 livrée
└── pnpm-workspace.yaml
```

## État d'avancement

- **Phase 1** ✅ — Auth + comptes IMAP/SMTP + chiffrement + middleware
- **Phase 2** ✅ — Sync worker IMAP IDLE + modèle Message
- **Phase 3** ✅ — Lecture email + envoi + dossiers CRUD + flags/actions + markAsJunk + dossiers spéciaux + sanitization HTML + pool IMAP API + Vitest (187 tests)
- **Phase 4** ✅ — Frontend Next.js 16 + shadcn/ui + glassmorphism + auth + comptes + dossiers + liste virtualisée + lecteur iframe sandbox + compose/reply/forward + brouillons auto-save + recherche + SSE temps réel
- **Phase 5** ✅ — Sécurité backend (Helmet, pino, rate limit global) + recherche + brouillons + temps réel (SSE)
- **Phase 6** ✅ — Sync multi-dossiers (polling dossiers spéciaux) + pagination arrière + OAuth Google XOAUTH2 + 2FA (TOTP + WebAuthn) + contacts + observabilité (Prometheus + health enrichi)
