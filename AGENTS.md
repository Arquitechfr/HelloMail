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
- **Tests obligatoires** : Vitest (370 tests, 38 fichiers). Ne pas livrer sans `pnpm test`.
- **Design frontend centralisé** : `frontend/src/app/globals.css` est l'unique source de vérité pour le design. Aucune couleur hardcodée dans les composants.
- **Header fixe & architecture par page** : Header permanent unifié (`AppHeader`) et navigation modulaire (`/mail/settings`, `/mail/settings/security`, `/mail/settings/rules`, `/mail/contacts`).

## Structure

```
HelloMail/
├── backend/     # API REST (Express + MongoDB) — Phases 1-3, 5, 6, 7, 8 livrées
├── frontend/    # Web client (Next.js + shadcn/ui) — Phases 4, 6, 7, 8 & Refonte Pro
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
  - Couverture : **370 tests Vitest, 38 fichiers, 0 `as any`**.
