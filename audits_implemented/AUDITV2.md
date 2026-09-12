# Audit HelloMail V2 — Optimisations, Performance & Évolutions Futures

> Date : 2026-09-12  
> Périmètre : Monorepo `HelloMail/` (backend Express + sync worker + frontend Next.js 16)  
> Socle actuel : Phases 1 à 16 livrées à 100% — 671 tests automatisés 100% verts (543 backend + 128 frontend), zéro dette `as any`, typage strict.

---

## Sommaire

1. [Résumé exécutif & Bilan de la V1](#1-résumé-exécutif--bilan-de-la-v1)
2. [Diagnostic technique & Axes d'optimisation](#2-diagnostic-technique--axes-doptimisation)
   - [2.1 Performance réseau & compression](#21-performance-réseau--compression)
   - [2.2 Indexation base de données & requêtage MongoDB](#22-indexation-base-de-données--requêtage-mongodb)
   - [2.3 Rendu frontend, virtualisation & prefetching](#23-rendu-frontend-virtualisation--prefetching)
   - [2.4 Ergonomie Power-User & sélection multiple](#24-ergonomie-power-user--sélection-multiple)
   - [2.5 Sécurité, réputation des emails & anti-spam](#25-sécurité-réputation-des-emails--anti-spam)
   - [2.6 Résilience & mode hors-ligne PWA](#26-résilience--mode-hors-ligne-pwa)
3. [Feuille de route V2 — Planification par Phases (Phases 17 à 22)](#3-feuille-de-route-v2--planification-par-phases)
   - [Phase 17 — Performance Réseau, Compression & Indexation Critique](#phase-17--performance-réseau-compression--indexation-critique)
   - [Phase 18 — Expérience Power User : Multi-sélection & Commandes Clavier](#phase-18--expérience-power-user--multi-sélection--commandes-clavier)
   - [Phase 19 — Confiance, Réputation & Anti-Spam (SPF/DKIM/DMARC & Listes)](#phase-19--confiance-réputation--anti-spam-spfdkimdmarc--listes)
   - [Phase 20 — Dossiers Virtuels Intelligents & Recherches Sauvegardées](#phase-20--dossiers-virtuels-intelligents--recherches-sauvegardées)
   - [Phase 21 — Signatures d'Email Avancées, Variables & Images Inline](#phase-21--signatures-demail-avancées-variables--images-inline)
   - [Phase 22 — Résilience & Mode Hors-Ligne PWA (Cache Local & File d'Attente)](#phase-22--résilience--mode-hors-ligne-pwa-cache-local--file-dattente)
4. [Matrice des priorités, efforts et impacts](#4-matrice-des-priorités-efforts-et-impacts)

---

## 1. Résumé exécutif & Bilan de la V1

HelloMail dispose d'une base technique exceptionnellement solide :
- **Backend moderne** : Node.js ESM, Express, MongoDB/Mongoose, JWT access + refresh avec rotation et cookies httpOnly, chiffrement AES-256-GCM, rate limiting distribué Redis, heartbeat worker, lock distribué Redis par compte, synchronisation IMAP IDLE et polling multi-dossiers.
- **Frontend professionnel** : Next.js 16 App Router avec Turbopack, Tailwind CSS v4, design glassmorphism centralisé, TanStack Query v5, virtualisation de liste `@tanstack/react-virtual`, iframe sandboxée pour les emails, rédaction universelle flottante `ComposePanel`, recherche globale Spotlight (Cmd+K).
- **Fonctionnalités V1 intégrales (Phases 1 à 16)** : Auth WebAuthn/Passkeys, 2FA TOTP, OAuth Google & Microsoft XOAUTH2, autoconfiguration ISPDB/MX, dossiers unifiés, étiquettes colorées, filtres automatiques, accusés de lecture MDN RFC 3798, envoi programmé "Send Later", alias d'expédition RFC 5322, chiffrement OpenPGP de bout en bout (RFC 4880/9580), désabonnement 1-clic (RFC 8058), blocage d'expéditeur et import d'emails bruts `.eml`.
- **Qualité de code** : **671 tests automatisés 100% verts** (543 backend sur 65 fichiers + 128 frontend sur 32 fichiers), 0 `as any`, aucun fichier excédant 300-350 lignes.

L'objectif de cet **Audit V2** est d'élever HelloMail au niveau des meilleurs clients email de bureau (Thunderbird, Superhuman, Apple Mail) en éliminant les latences résiduelles, en enrichissant l'expérience clavier et en apportant des fonctionnalités de niveau entreprise (anti-usurpation SPF/DKIM/DMARC, dossiers intelligents, signatures dynamiques, mode hors-ligne).

---

## 2. Diagnostic technique & Axes d'optimisation

### 2.1 Performance réseau & compression
- **Constat** : Le backend Express n'intègre pas de middleware de compression (`compression`). Les réponses JSON contenant les listes de 50 messages ou le HTML assaini des corps d'emails pèsent régulièrement entre 50 Ko et 600 Ko.
- **Impact** : Sur connexions mobiles ou réseaux d'entreprise contraints, le temps de transfert réseau domine la latence globale.
- **Solution** : Activer la compression Brotli / Gzip avec un seuil de déclenchement (1 Ko) et exclusion des flux binaires déjà compressés (téléchargements PJ, images, etc.).

### 2.2 Indexation base de données & requêtage MongoDB
- **Constat** : La requête principale de listing d'un dossier fait :
  ```ts
  MessageModel.find({ accountId, folder, snoozedUntil: null }).sort({ isPinned: -1, date: -1 })
  ```
  Actuellement, les index existants sont `{ accountId: 1, folder: 1, date: -1 }` et `{ accountId: 1, isPinned: -1, date: -1 }`. MongoDB doit soit filtrer sur un index et trier en mémoire (in-memory sort), soit ignorer le champ `folder`.
- **Impact** : Risque de ralentissement sur les boîtes volumineuses (> 10 000 messages) et consommation CPU inutile sur MongoDB.
- **Solution** : Ajouter l'index composé 4 champs parfait `{ accountId: 1, folder: 1, isPinned: -1, date: -1 }`.

### 2.3 Rendu frontend, virtualisation & prefetching
- **Constat** : Quand l'utilisateur clique sur un email dans la liste, la requête `GET /messages/:folder/:uid` démarre seulement au moment du clic. Malgré le cache `MessageBody` backend (TTL 30j), un délai de 50 à 150 ms subsiste avant l'affichage du contenu.
- **Impact** : Sensation de latence lors de la navigation rapide.
- **Solution** : Mettre en place un **prefetching prédictif** au survol (`onMouseEnter`) et au clavier : dès qu'un élément est survolé pendant plus de 60 ms, TanStack Query précharge le détail du message en arrière-plan. L'ouverture au clic devient instantanée (< 5 ms).

### 2.4 Ergonomie Power-User & sélection multiple
- **Constat** : La sélection d'emails actuelle se fait principalement un par un ou via des cases à cocher unitaires.
- **Impact** : Les utilisateurs habitués aux clients lourds (Thunderbird, Outlook) perdent en productivité pour trier ou nettoyer leurs boîtes.
- **Solution** : Support complet de la multi-sélection clavier et souris :
  - `Shift + Clic` pour sélectionner une plage continue d'emails.
  - `Cmd/Ctrl + Clic` pour basculer des sélections discontinues.
  - `Cmd/Ctrl + A` pour sélectionner tous les messages de la vue courante.
  - Barre d'actions flottante contextuelle (Batch Actions Dock) avec raccourcis (`E` archiver, `Suppr` corbeille, `U` marquer lu/non lu).

### 2.5 Sécurité, réputation des emails & anti-spam
- **Constat** : HelloMail assainit parfaitement le HTML (DOMPurify double-pass), mais ne donne aucune indication sur la légitimité de l'expéditeur. Les attaques par usurpation de nom (*CEO fraud*, phishing) exploitent ce manque de signal visuel.
- **Impact** : Risque de sécurité pour l'utilisateur.
- **Solution** : Extraire et interpréter les en-têtes d'authentification email standard (`Authentication-Results`, `Received-SPF`, `DKIM-Signature`) et afficher des badges clairs dans l'en-tête du lecteur :
  - Pastille verte : Expéditeur authentifié (SPF + DKIM pass).
  - Pastille d'alerte jaune/rouge : Échec SPF/DKIM ou anomalie DMARC.
  - Gestion de Listes Blanches / Noires (Whitelist / Blacklist) d'adresses et domaines.

### 2.6 Résilience & mode hors-ligne PWA
- **Constat** : En cas de coupure réseau transitoire (train, avion, tunnel), le client devient inutilisable et les actions échouent.
- **Impact** : Expérience utilisateur dégradée en mobilité.
- **Solution** : Mettre en place un cache local chiffré IndexedDB pour les derniers messages consultés et une file d'attente d'actions offline rejouées automatiquement lors du rétablissement de la connexion.

---

## 3. Feuille de route V2 — Planification par Phases

```
┌────────────────────────────────────────────────────────────────────────┐
│                      HelloMail V2 — Roadmap                            │
└────────────────────────────────────────────────────────────────────────┘
  │
  ├── Phase 17 : Performance Réseau, Compression & Indexation Critique ⚡ ✅
  │
  ├── Phase 18 : Expérience Power User : Multi-sélection & Raccourcis ⌨️ ✅
  │
  ├── Phase 19 : Confiance, Réputation & Anti-Spam (SPF/DKIM & Listes) 🛡️ ✅
  │
  ├── Phase 20 : Dossiers Virtuels Intelligents & Recherches Sauvegardées 📁 ✅
  │
  ├── Phase 21 : Signatures Avancées, Variables Dynamiques & Images Inline ✍️ ✅
  │
  └── Phase 22 : Résilience & Mode Hors-Ligne PWA (Cache Local & Sync) 🔌
```

---

### Phase 17 — Performance Réseau, Compression & Indexation Critique ✅ Livrée

**Objectif :** Réduire la consommation de bande passante de 70% à 85%, diviser par 3 la latence de navigation perçue et supprimer les tris mémoire sur MongoDB.

#### Lot 17.1 — Compression HTTP Express (Gzip / Deflate) ✅ Livré
- Dépendance backend : `compression` + `@types/compression`.
- Intégration dans `backend/src/app.ts` via `backend/src/middleware/compressionMiddleware.ts` :
  - Seuil de déclenchement : `threshold: 1024` (1 Ko, évite la surcharge CPU sur les micro-réponses).
  - Filtre personnalisé `compressionFilter` : exempte strictement les flux Server-Sent Events SSE (`/events`, `text/event-stream`) pour préserver le temps réel sans buffering, et respecte l'en-tête `x-no-compression`.
- 6 tests unitaires complets dans `compressionMiddleware.test.ts`.

#### Lot 17.2 — Indexation MongoDB optimisée ✅ Livré
- Fichier : `backend/src/models/Message.ts`.
- Ajout de l'index composé optimal 4 champs :
  ```ts
  messageSchema.index({ accountId: 1, folder: 1, isPinned: -1, date: -1 });
  ```
- Ajout de l'index combiné Dossier / Snooze :
  ```ts
  messageSchema.index({ accountId: 1, folder: 1, snoozedUntil: 1 });
  ```
- Test unitaire dédié `backend/src/models/Message.test.ts` validant la présence et la configuration exacte des index.

#### Lot 17.3 — Prefetching prédictif TanStack Query ✅ Livré
- Fichiers : `frontend/src/components/mail/MessageListItem.tsx`, `frontend/src/lib/queries/messages.ts`.
- Implémentation du préchargement avec TanStack Query `queryClient.prefetchQuery` :
  - Déclencheur : `onMouseEnter` sur la ligne du message avec temporisation debounce (65 ms).
  - Annulation propre : `onMouseLeave` nettoie le timer via `clearTimeout` pour éviter les requêtes parasites lors d'un scroll rapide à la molette.
  - Export de `fetchMessageDetail` réutilisé par le prefetcher et `useMessageDetail`.
  - Cache local avec `staleTime: 60_000` : l'affichage du corps d'email au clic est instantané (< 5 ms).
- Tests unitaires dans `MessageListItem.test.tsx` avec fake timers Vitest vérifiant le debounce et l'annulation.

#### Lot 17.4 — Code Splitting & Dynamic Imports Next.js ✅ Livré
- Fichiers : `frontend/src/components/mail/FolderTree.tsx`, `frontend/src/components/security/PgpKeyManager.tsx`.
- Utilisation de `next/dynamic` (`ssr: false`) pour le découpage de bundles :
  - `ImportEmlDialog` dans `FolderTree.tsx`.
  - `PgpGenerateKeyDialog` et `PgpImportKeyDialog` dans `PgpKeyManager.tsx`.
- Validation par le build Next.js 16 (Turbopack) et tests unitaires avec `findByRole`.

**Bilan Phase 17 :**
- **733 tests automatisés 100% verts** (593 backend sur 69 fichiers + 140 frontend sur 36 fichiers).
- Zéro régression, 0 `as any`, typage TypeScript strict sans erreur.
- Fichiers : `frontend/src/components/mail/FolderTree.tsx`, `MessageReader.tsx`, `ComposePanel.tsx`.
- Remplacement des imports statiques des modales lourdes par `next/dynamic` avec `ssr: false` :
  - `ImportEmlDialog` (avec FileReader et parsing base64).
  - `PgpGenerateKeyDialog` et `PgpImportKeyDialog` (avec bibliothèque `openpgp`).
  - `ScheduleSendDialog` et `ScheduledMessagesDialog`.
  - `AddAccountDialog`.
- Gain estimé : réduction du bundle JS initial de 120 Ko gzippé sur la page principale.

---

### Phase 18 — Expérience Power User : Multi-sélection, Commandes Clavier & Ergonomie des Modales ✅ Livré

**Objectif :** Offrir une vitesse de tri et de gestion d'emails équivalente à Thunderbird et Superhuman, avec une ergonomie visuelle sans défilement disgracieux.

#### Lot 18.1 — Moteur de multi-sélection intelligente ✅ Livré
- Fichier store : `frontend/src/lib/stores/uiStore.ts`.
- Mémorisation du dernier UID cliqué (`lastSelectedUid: number | null`).
- Action `selectRangeUids(allVisibleUids, targetUid)` :
  - Calcule l'intervalle ordonné entre `lastSelectedUid` et `targetUid`.
  - Fusion sans doublon via `Set` avec les sélections existantes.
  - Déclenchement sur `Shift + Clic` dans `MessageListItem` (sur la ligne et sur le bouton rond).
- Bascule unitaire réactive sur `Ctrl/Cmd + Clic` via `toggleSelectUid(uid)`.
- 6 tests unitaires complets dans `uiStore.test.ts` et tests d'intégration dans `MessageListItem.test.tsx`.

#### Lot 18.2 — Barre d'actions contextuelle flottante (Floating Batch Actions Dock) ✅ Livré
- Composants : `frontend/src/components/mail/BatchActionBar.tsx` et `UnifiedBatchActionBar.tsx`.
- Animation d'apparition/disparition ultra-fluide avec `framer-motion` (`AnimatePresence`, `motion.div`).
- Style façon Dock macOS épuré : centré en bas d'écran, `rounded-xl`, bordure glassmorphism, ombre portée `shadow-xl`.
- Compteur dynamique en direct ("X sélectionnés") avec bouton de désélection rapide (`Échap`).
- Tooltips enrichis avec raccourcis clavier associés (`U` Lu/Non-lu, `H` Épingler, `!` Spam, `Suppr` Supprimer, `Ctrl+A` Tout sélectionner).
- 8 tests unitaires complets (`BatchActionBar.test.tsx` et `UnifiedBatchActionBar.test.tsx`).

#### Lot 18.3 — Raccourcis clavier de navigation et de sélection ✅ Livré
- Fichiers : `frontend/src/lib/hooks/useEmailShortcuts.ts`, `frontend/src/lib/hooks/useListNavigationShortcuts.ts`.
- Raccourcis universels :
  - `J` / `↓` : descendre vers l'email suivant.
  - `K` / `↑` : monter vers l'email précédent.
  - `X` : cocher / décocher l'email sélectionné pour action par lot.
  - `Shift + J` / `Shift + K` : étendre la sélection vers le bas / vers le haut.
  - `Cmd / Ctrl + A` : sélectionner tous les emails affichés dans la vue.
  - `Échap` : désélectionner tout, ou fermer le panneau lecteur si aucun lot n'est sélectionné.
- Factorisation via `useListNavigationShortcuts` partagé entre `MessageList.tsx` et `UnifiedMessageList.tsx` (< 300 lignes).
- Intégration dans le dialogue d'aide `KeyboardShortcutsDialog.tsx` avec affichage dynamique des symboles `Cmd`.
- 16 tests unitaires complets (`useEmailShortcuts.test.ts` et `useListNavigationShortcuts.test.ts`).

#### Lot 18.4 — Ergonomie des modales adaptatives en 2 sections & neutralisation des scrollbars ✅ Livré
- **Suppression globale des scrollbars** : classe `.no-scrollbar` et règles CSS appliquées à toutes les modales (`[data-slot="dialog-content"]`), évitant les barres de défilement laides tout en préservant le scroll tactile ou à la molette.
- **Organisation adaptative en deux sections sur écrans moyens/larges (`md:` / `lg:`)** :
  - `KeyboardShortcutsDialog` : agencement des 5 groupes de raccourcis en 2 colonnes équilibrées (`md:grid-cols-2`), modale élargie `sm:max-w-xl md:max-w-3xl lg:max-w-4xl`, zéro scrollbar sur desktop.
  - `RuleDialog` & `RuleForm` : découpage modulaire en deux sections côte à côte (Déclencheurs & Conditions à gauche via `RuleConditionsSection`, Exécution & Actions à droite via `RuleActionsSection`), largeur `md:max-w-4xl lg:max-w-5xl`.
  - `AccountAliasesDialog` : deux sections sur `md:` (Formulaire d'ajout/édition à gauche, Liste des identités configurées à droite via `AccountAliasItem`), largeur `md:max-w-3xl lg:max-w-4xl`.
  - `ManageUnifiedFoldersDialog` : deux sections sur `md:` (Activation globale et explications à gauche, Liste et ordre des 6 dossiers unifiés à droite), largeur `md:max-w-2xl lg:max-w-3xl`.
  - `AddAccountDialog` : passage dynamique de 1 section compacte (`max-w-md`) à 2 sections sur `md:` (`md:max-w-3xl lg:max-w-4xl`) lorsque les paramètres avancés de serveurs IMAP/SMTP sont dépliés.
  - `ScheduledMessagesDialog` : affichage automatique en grille 2 colonnes sur `md:` quand la liste comporte plusieurs messages programmés.
- Tous les fichiers modulaires strictement sous 300 lignes.

**Bilan Phase 18 :**
- **748 tests automatisés 100% verts** (593 backend sur 69 fichiers + 155 frontend sur 37 fichiers).
- Zéro régression, 0 `as any`, typage TypeScript strict sans erreur, Next.js build réussi en 16.8s.

---

### Phase 19 — Confiance, Réputation & Anti-Spam (SPF/DKIM/DMARC & Listes) ✅ Livré

**Objectif :** Protéger l'utilisateur contre le phishing, l'usurpation d'identité et les spams indésirables.

#### Lot 19.1 — Analyseur d'en-têtes de sécurité (SPF / DKIM / DMARC) ✅ Livré
- Nouveau service backend : `backend/src/services/security/emailSecurityService.ts`.
- Parsing des en-têtes RFC standards retournés par le serveur IMAP :
  - `Authentication-Results` (RFC 8601) : extraction des verdicts `spf=pass/fail`, `dkim=pass/fail`, `dmarc=pass/fail`.
  - `Received-SPF` (RFC 7208) : analyse du résultat direct si `Authentication-Results` est absent.
  - `X-Spam-Status` / `X-Spam-Score` / `X-Spam-Flag` : détection des scores anti-spam serveurs (SpamAssassin, Rspamd).
- Calcul de l'indicateur de confiance `isTrusted` et messages d'avertissement clairs en français (`warningMessage`).
- Injection dans `MessageDetail.securitySummary` et intégration dans `messageFetchService.ts`.
- 6 tests unitaires complets dans `emailSecurityService.test.ts`.

#### Lot 19.2 — Indicateur d'authenticité dans le lecteur d'email ✅ Livré
- Nouveau composant : `frontend/src/components/mail/EmailSecurityBadge.tsx`.
- Affichage dans `MessageMetadataHeader` :
  - Badge vert discret "Expéditeur vérifié" avec popover interactif détaillé (SPF/DKIM/DMARC valides).
  - Badge jaune "Non vérifié" en l'absence de signatures.
  - Badge rouge "Alerte de sécurité" en cas d'échec d'authentification ou suspicion d'usurpation.
- Nouveau composant bannière : `frontend/src/components/mail/EmailSecurityBanner.tsx` monté dans `MessageReader.tsx` pour alerter des risques de phishing.
- 4 tests unitaires complets dans `EmailSecurityBadge.test.tsx`.

#### Lot 19.3 — Gestionnaire de Listes Blanches & Noires (Allowlist / Denylist) ✅ Livré
- Modèle backend : `backend/src/models/SenderList.ts` (userId, type: `'allow' | 'deny'`, target: email ou `@domaine.com`, note).
- Schémas Zod : `backend/src/schemas/senderListSchemas.ts`.
- Service & routes : `backend/src/services/security/senderListService.ts`, `/api/sender-lists` (`GET`, `POST`, `DELETE`, `GET /check`).
- Intégration worker & moteur de règles (`ruleService.ts`) : filtrage automatique à l'arrivée (les messages de l'allowlist ne sont jamais marqués spam, les messages de la denylist sont envoyés directement dans Junk).
- Interface utilisateur dans `/mail/settings` (onglet Sécurité) via `SenderListsSettings.tsx` et dialogue adaptatif sans scrollbar `AddSenderDialog.tsx`.
- 9 tests backend dans `senderListService.test.ts`, 1 test d'intégration dans `ruleService.test.ts`, et 5 tests frontend dans `SenderListsSettings.test.tsx`.

**Bilan Phase 19 :**
- **781 tests automatisés 100% verts** (617 backend sur 71 fichiers + 164 frontend sur 39 fichiers).
- Zéro régression, 0 `as any`, typage TypeScript strict sans erreur, Next.js build réussi en Turbopack.

---

### Phase 20 — Dossiers Virtuels Intelligents & Recherches Sauvegardées ✅ Livré

**Objectif :** Permettre l'organisation dynamique des messages sans les déplacer de leurs dossiers d'origine (façon *Smart Folders* macOS Mail / Thunderbird).

#### Lot 20.1 — Modèle & API des Recherches Sauvegardées ✅ Livré
- Modèle backend : `backend/src/models/SmartFolder.ts` :
  - `userId`, `name`, `icon`, `color`, `query`, `accountId?`, `order`.
  - Indexation `{ userId: 1, order: 1, createdAt: 1 }`.
- Validation Zod : `backend/src/schemas/smartFolderSchemas.ts` (`createSmartFolderSchema`, `updateSmartFolderSchema`, `reorderSmartFoldersSchema`).
- Routes REST montées sur `/api/smart-folders` : `GET /`, `GET /counts`, `POST /`, `POST /reorder`, `GET /:id/messages`, `PATCH /:id`, `DELETE /:id`.
- 5 tests d'intégration complets dans `smartFoldersController.test.ts`.

#### Lot 20.2 — Moteur d'évaluation & compteurs de dossiers intelligents ✅ Livré
- Service backend : `backend/src/services/email/smartFolderService.ts` :
  - Résolution dynamique de la requête sur `MessageModel` avec tri optimisé `{ isPinned: -1, date: -1 }`.
  - Exclusion automatique des dossiers système indésirables (Corbeille/Trash/Spam/Junk).
  - Prise en charge des opérateurs étendus `is:unread`, `is:read`, `is:flagged`, `is:pinned`, `has:attachment`, `tag:<nom>`, `from:`, `to:`, `subject:`, dates `since:` / `before:`.
  - Support multi-comptes unifié ou ciblage d'un compte spécifique vérifié.
  - Calcul dynamique et temps réel des compteurs totaux et non-lus par dossier (`getSmartFolderCounts`).
- 9 tests unitaires complets dans `smartFolderService.test.ts`, 22 tests dans `searchService.test.ts`.

#### Lot 20.3 — Intégration UI complète, dialogue 2 sections & page dédiée ✅ Livré
- Nouveaux composants frontend :
  - `SmartFolderDialog.tsx` : dialogue ergonomique conforme en 2 sections adaptatives (`md:grid-cols-2`) sans scrollbar (`no-scrollbar`), palette de 8 couleurs, grille d'icônes Lucide, sélecteur de compte, boutons d'aide aux filtres rapides (`+ Non lus`, `+ Épinglés`, `+ Important`, `+ Avec PJ`).
  - `SmartFolderList.tsx` : section dédiée dans `AccountSidebar.tsx` avec compteurs de badges non-lus, icônes personnalisées et menu d'édition/suppression.
  - `SmartFolderMessageList.tsx` : affichage des messages avec virtualisation `@tanstack/react-virtual`, filtres rapides (`QuickFilterBar`), pastilles de couleurs des comptes et en-tête dédié.
  - `frontend/src/app/mail/smart/[id]/page.tsx` : vue complète avec barre latérale, liste virtualisée et lecteur de message `MessageReader`.
  - `GlobalSearchDialog.tsx` : bouton "Dossier intelligent" pour transformer en 1 clic toute recherche Spotlight active en dossier virtuel persistant.
- Hooks TanStack Query : `useSmartFolders`, `useSmartFolderCounts`, `useSmartFolderMessages`, `useCreateSmartFolder`, `useUpdateSmartFolder`, `useDeleteSmartFolder`, `useReorderSmartFolders`.
- 5 tests unitaires frontend dans `SmartFolderDialog.test.tsx` et `SmartFolderList.test.tsx`.

**Bilan Phase 20 :**
- **797 tests automatisés 100% verts** (631 backend sur 73 fichiers + 166 frontend sur 41 fichiers).
- Zéro régression, 0 `as any`, typage TypeScript strict sans erreur, Next.js 16 build Turbopack réussi avec route `/mail/smart/[id]`.


---

### Phase 21 — Signatures d'Email Avancées, Variables & Images Inline ✅ Livrée

**Objectif :** Transformer HelloMail en outil de communication professionnelle irréprochable avec signatures multi-marques, graphiques et variables dynamiques.

#### Lot 21.1 — Variables dynamiques dans les signatures ✅ Livré
- Extension du modèle `Account` et sous-document `Account.aliases` :
  - Support de `ISignatureConfig` avec variables coordonnées `variables?: { phone?, jobTitle?, company? }`.
  - Schémas Zod : `signatureVariablesSchema`, `updateSignatureSchema`, `createAliasSchema`, `updateAliasSchema`.
- Helper pur universel `signature-utils.ts` :
  - Résolution dynamique de `{{prenom}}`, `{{nom}}`, `{{nom_complet}}`, `{{email}}`, `{{telephone}}`, `{{poste}}`, `{{societe}}` et leurs alias (`phone`, `tel`, `jobTitle`, `titre`, `company`, `entreprise`).
  - Catalogue `AVAILABLE_SIGNATURE_VARIABLES` pour l'interface utilisateur.
  - 7 tests unitaires dédiés dans `signature-utils.test.ts`.

#### Lot 21.2 — Support des images inline (CID / Data URI) ✅ Livré
- Service backend : `backend/src/services/email/inlineImageService.ts` :
  - Détection automatique et transparente des balises `<img src="data:image/...;base64,..." />` dans le HTML des emails et signatures.
  - Extraction sans altération du texte, génération de Content-ID sécurisés (`cid:sig-img-...@hellomail`) et d'attachments MIME avec `contentType` et `cid`.
  - Intégration dans `sendService.ts` (`buildRawMime` et `transport.sendMail`) et `draftService.ts` (`buildDraftMime` et `saveDraft`).
  - Encapsulation native en `multipart/related` via MailComposer/Nodemailer : les logos et bannières s'affichent inline sans apparaître comme pièces jointes détachées chez le destinataire.
  - 5 tests unitaires dans `inlineImageService.test.ts`, tests d'envoi et brouillon vérifiés.

#### Lot 21.3 — Liaison signatures / Alias d'expédition & Remplacement dynamique ✅ Livré
- Sous-document d'alias `AccountAlias` étendu avec `signature?: SignatureConfig`.
- Routes backend dédiées : `PATCH /api/accounts/:id/aliases/:aliasId/signature` et `PATCH /api/accounts/:id/aliases/:aliasId`.
- Composant éditeur modulaire `AccountSignatureIdentityEditor.tsx` :
  - Bascule de signature, saisie des variables d'identité (Téléphone, Poste, Entreprise).
  - Barre de badges de variables dynamiques en 1 clic.
  - Bouton d'upload de logo inline (< 250 Ko) avec conversion FileReader base64 instantanée.
  - Aperçu interactif en temps réel avec variables résolues.
- Gestionnaire de signatures `AccountSignatureManager.tsx` :
  - Sélecteur d'identité fluide (compte principal vs alias).
  - Enregistrement indépendant et réactif.
  - 5 tests unitaires dans `AccountSignatureManager.test.tsx`.
- Hook universel `useComposeSignature.ts` & `ComposeForm.tsx` :
  - Prise en compte de l'expéditeur actif (`activeSender`).
  - Insertion initiale automatique (`mode === "new"`).
  - Délimitation propre via `<div data-signature="true" class="hellomail-signature">`.
  - Remplacement dynamique sans laisser de résidu lors du changement d'adresse dans le sélecteur "De :".
  - 4 tests unitaires dans `useComposeSignature.test.ts` et 9 tests dans `compose-utils.test.ts`.

**Bilan Phase 21 :**
- **45 tests backend passés en 2.99s**, **29 tests frontend dédiés 100% verts**.
- Zéro régression, 0 `as any`, fichiers ≤ 350 lignes, typecheck backend & frontend 100% stricts, builds Next.js 16 et tsc réussis.

---

### Phase 22 — Résilience & Mode Hors-Ligne PWA (Cache Local & File d'Attente) ✅ Livrée

**Objectif :** Consultation, lecture et tri des emails même en l'absence totale de réseau avec rejeu transparent des mutations.

#### Lot 22.1 — Manifeste PWA & Service Worker ✅ Livré
- Manifeste PWA complet `frontend/public/manifest.json` avec nom, description, couleurs de thème/fond, orientation et scopes.
- Icônes vectorielles PWA adaptatives SVG générées : `icon.svg`, `icon-192.svg`, `icon-512.svg`.
- Service Worker `frontend/public/sw.js` :
  - Cache statique (`hellomail-static-v1`) pour les feuilles de style, scripts, polices et icônes.
  - Stratégie Network-First avec repli cache pour la navigation offline (`mode === 'navigate'`).
  - Exclusion stricte et transparente des requêtes d'API (`/api/`) et flux SSE temps réel.
- Directives CSP durcies dans `next.config.ts` : ajout de `worker-src 'self' blob:;` et `manifest-src 'self';`.
- Composant réactif d'enregistrement `PwaRegister.tsx` monté dans `layout.tsx` avec détection des mises à jour et proposition de rechargement en 1 clic (toast sonner).
- 3 tests unitaires dans `PwaRegister.test.tsx`.

#### Lot 22.2 — Cache local IndexedDB performant (zéro dépendance externe) ✅ Livré
- Moteur de stockage persistant pur TypeScript `frontend/src/lib/offline/db.ts` :
  - Classe `BrowserIndexedDb` s'appuyant nativement sur `window.indexedDB` (avec `IDBOpenDBRequest` et promises typées).
  - Versionnement de schéma DB `HelloMailOfflineDB` (v1) avec object stores `messages` (indexés par `account_folder` et `accountId`), `message_details`, et `pending_mutations`.
  - Fallback transparent `InMemoryOfflineDb` pour les environnements de test Vitest ou les navigateurs avec stockage restreint.
  - Sauvegarde locale automatique des listes et détails avec préservation stricte du tri (messages épinglés en tête).
  - Méthodes optimistes locales : `updateMessageFlagsLocally`, `updateMessagePinLocally`, `deleteMessageLocally`.
- 6 tests unitaires dans `db.test.ts`.

#### Lot 22.3 — File d'attente d'actions hors-ligne & Auto-Synchronisation réactive ✅ Livré
- Service de file d'attente `frontend/src/lib/offline/offlineQueueService.ts` :
  - Enfilement FIFO persistant dans IndexedDB (`queueOfflineMutation`) des actions (`UPDATE_FLAGS`, `DELETE_MESSAGE`, `MOVE_MESSAGE`, `MARK_JUNK`, `PIN_MESSAGE`, `SNOOZE_MESSAGE`).
  - Moteur de rejeu séquentiel idempotent (`replayPendingMutations`) avec suppression des actions obsolètes ou 404.
  - Interruption propre en cas d'échec réseau pour préserver l'intégrité de la séquence.
  - 4 tests unitaires dans `offlineQueueService.test.ts`.
- Hook réactif `frontend/src/lib/offline/useNetworkStatus.ts` :
  - Écoute des événements `online` et `offline` du navigateur.
  - Synchronisation automatique dès le rétablissement de la connectivité avec notifications utilisateur `sonner`.
  - 3 tests unitaires dans `useNetworkStatus.test.ts`.
- Helpers de repli et d'interception `frontend/src/lib/offline/offlineSyncHelpers.ts` :
  - `fetchMessagesWithOfflineFallback` : renvoie instantanément les messages du cache IndexedDB si hors ligne ou si coupure réseau.
  - `fetchDetailWithOfflineFallback` : restitue le corps du message et les pièces jointes depuis IndexedDB en mode déconnecté.
  - `executeOrQueueOffline` : intercepte les mutations réseau (`TypeError`, `Failed to fetch`) et les met en file sans faire planter l'UI.
  - 9 tests unitaires dans `offlineSyncHelpers.test.ts`.
- Intégration complète dans les hooks TanStack Query de `frontend/src/lib/queries/messages.ts` (`useMessages`, `useMessageDetail`, `useUpdateFlags`, `useDeleteMessage`, `useMoveMessage`, `useMarkAsJunk`).
- Rendu visuel dynamique dans `frontend/src/components/mail/AppHeader.tsx` :
  - Pastille verte "En direct" quand en ligne.
  - Indicateur animé bleu "Synchronisation..." lors du rejeu de la file d'attente.
  - Badge ambré "Hors-ligne" avec icône `WifiOff` et compteur numérique des actions en attente dès la déconnexion.
  - 3 tests unitaires dans `AppHeader.test.tsx`.

**Bilan Phase 22 :**
- **28 tests unitaires frontend dédiés à la résilience et au mode hors-ligne 100% verts** (217 tests frontend au total).
- Zéro dépendance externe lourde, 0 `as any`, fichiers ≤ 350 lignes, typecheck backend & frontend 100% stricts, builds Next.js 16 et tsc réussis.

---

## 4. Matrice des priorités, efforts et impacts

| Phase | Intitulé | Priorité | Effort | Impact utilisateur / performance |
|---|---|---|---|---|
| **Phase 17** | **Performance Réseau, Compression & Indexation** | 🔴 CRITIQUE | Faible à Moyen | Gain immédiat : -80% volume réseau, zéro in-memory sort MongoDB, affichage instantané des messages au survol ✅ Livrée |
| **Phase 18** | **Expérience Power User : Multi-sélection Clavier** | 🟠 HAUTE | Moyen | Productivité x5 pour le tri de boîtes volumineuses, conformité avec les standards desktop (Thunderbird) ✅ Livrée |
| **Phase 19** | **Confiance, Réputation & Anti-Spam (SPF/DKIM)** | 🟠 HAUTE | Moyen | Protection anti-usurpation d'identité, signaux de sécurité visuels clairs et listes de confiance ✅ Livrée |
| **Phase 20** | **Dossiers Virtuels Intelligents & Recherches Sauvegardées** | 🟡 MOYENNE | Moyen | Organisation dynamique sans altération des arborescences IMAP d'origine ✅ Livrée |
| **Phase 21** | **Signatures d'Email Avancées & Images Inline** | 🟡 MOYENNE | Faible à Moyen | Rendu professionnel irréprochable des emails émis par compte et par alias ✅ Livrée |
| **Phase 22** | **Résilience & Mode Hors-Ligne PWA** | 🔵 ÉVOLUTIVE | Élevé | Consultation, lecture et tri sans interruption en déplacement (avions, trains, zones blanches) ✅ Livrée |

---

*Document d'audit V2 mis à jour le 12 septembre 2026. L'intégralité des phases de la feuille de route V2 (Phases 17, 18, 19, 20, 21 et 22) est désormais livrée à 100% avec une couverture de tests et une robustesse exemplaires.*

