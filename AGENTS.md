# AGENTS.md — HelloMail Workspace

Client webmail from-scratch (façon Thunderbird, mais web).

## Stack

- **Monorepo pnpm** : `backend/` (Node.js ESM + Express + MongoDB/Mongoose + Zod), `frontend/` (Next.js + shadcn/ui — phase ultérieure).
- **TypeScript strict**, ESM (`"type": "module"`), imports `.js` obligatoires.
- **pnpm exclusif**.

## Commandes

```bash
pnpm dev        # Démarre le backend (tsx watch)
pnpm build      # Compile le backend (tsc → dist/)
pnpm typecheck   # Vérification des types (tsc --noEmit)
pnpm start      # Démarre le backend en production (node dist/app.js)
```

## Conventions globales

- **Répondre en français** toujours.
- **Sécurité** : jamais de secret/clé/token en clair dans le code, les logs ou les commits. `.env` non committé.
- **300 lignes max par fichier** (350 toléré si impossible à découper).
- **Messages d'erreur en français** côté API.
- **Conventional Commits** : `type(scope): description`.

## Structure

```
HelloMail/
├── backend/    # API REST (Express + MongoDB)
└── frontend/   # Web client (à venir)
```
