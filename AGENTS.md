# AGENTS.md — HelloMail Workspace

Client webmail from-scratch (façon Thunderbird, mais web).

## Stack

- **Monorepo pnpm** : `backend/` (Node.js ESM + Express + MongoDB/Mongoose + Zod), `frontend/` (Next.js + shadcn/ui — phase ultérieure).
- **TypeScript strict**, ESM (`"type": "module"`), imports `.js` obligatoires.
- **pnpm exclusif**.

## Commandes

```bash
pnpm dev                # Démarre le backend (tsx watch)
pnpm build              # Compile le backend (tsc → dist/)
pnpm typecheck          # Vérification des types (tsc --noEmit)
pnpm start              # Démarre le backend en production (node dist/app.js)
pnpm --filter backend test          # Lance les tests Vitest
pnpm --filter backend test:coverage # Lance les tests avec couverture
```

## Conventions globales

- **Répondre en français** toujours.
- **Sécurité** : jamais de secret/clé/token en clair dans le code, les logs ou les commits. `.env` non committé.
- **300 lignes max par fichier** (350 toléré si impossible à découper).
- **Messages d'erreur en français** côté API.
- **Conventional Commits** : `type(scope): description`.
- **Tests obligatoires** : Vitest (187 tests, coverage 86.93% lignes). Ne pas livrer sans `pnpm test`.

## Structure

```
HelloMail/
├── backend/    # API REST (Express + MongoDB) — Phases 1-3 livrées
└── frontend/   # Web client (à venir — Phase 4)
```

## État d'avancement

- **Phase 1** ✅ — Auth + comptes IMAP/SMTP + chiffrement + middleware
- **Phase 2** ✅ — Sync worker IMAP IDLE + modèle Message
- **Phase 3** ✅ — Lecture email + envoi + dossiers CRUD + flags/actions + markAsJunk + dossiers spéciaux + sanitization HTML + pool IMAP API + Vitest (187 tests)
- **Phase 4** ⬜ — Frontend Next.js + shadcn/ui
- **Phase 5** ⬜ — Sécurité backend (Helmet, pino, rate limit global) + recherche + brouillons + temps réel (SSE)
- **Phase 6** ⬜ — OAuth + 2FA + contacts + observabilité + sync multi-dossiers
