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
  ├── Phase 17 : Performance Réseau, Compression & Indexation Critique ⚡
  │
  ├── Phase 18 : Expérience Power User : Multi-sélection & Raccourcis ⌨️
  │
  ├── Phase 19 : Confiance, Réputation & Anti-Spam (SPF/DKIM & Listes) 🛡️
  │
  ├── Phase 20 : Dossiers Virtuels Intelligents & Recherches Sauvegardées 📁
  │
  ├── Phase 21 : Signatures Avancées, Variables Dynamiques & Images Inline ✍️
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

### Phase 19 — Confiance, Réputation & Anti-Spam (SPF/DKIM/DMARC & Listes)

**Objectif :** Protéger l'utilisateur contre le phishing, l'usurpation d'identité et les spams indésirables.

#### Lot 19.1 — Analyseur d'en-têtes de sécurité (SPF / DKIM / DMARC)
- Nouveau service backend : `backend/src/services/security/emailSecurityService.ts`.
- Parsing des en-têtes RFC standards retournés par le serveur IMAP :
  - `Authentication-Results` : extraction des verdicts `spf=pass/fail`, `dkim=pass/fail`, `dmarc=pass/fail`.
  - `Received-SPF` : analyse du résultat direct si `Authentication-Results` est absent.
  - `X-Spam-Status` / `X-Spam-Score` : détection des scores anti-spam serveurs (SpamAssassin, Rspamd).
- Injection dans `MessageDetail.securitySummary` :
  ```ts
  interface EmailSecuritySummary {
    spf: 'pass' | 'fail' | 'neutral' | 'unknown';
    dkim: 'pass' | 'fail' | 'neutral' | 'unknown';
    dmarc: 'pass' | 'fail' | 'neutral' | 'unknown';
    isTrusted: boolean;
    warningMessage?: string;
  }
  ```

#### Lot 19.2 — Indicateur d'authenticité dans le lecteur d'email
- Nouveau composant : `frontend/src/components/mail/EmailSecurityBadge.tsx`.
- Affichage dans `MessageMetadataHeader` :
  - Badge vert discret "Expéditeur vérifié" avec infobulle détaillée (SPF/DKIM valides).
  - Bannière d'avertissement jaune "Attention : l'authenticité de cet expéditeur n'a pas pu être vérifiée".
  - Bannière rouge "Alerte : échec d'authentification ou suspicion d'usurpation d'adresse".

#### Lot 19.3 — Gestionnaire de Listes Blanches & Noires (Allowlist / Denylist)
- Modèle backend : `backend/src/models/SenderList.ts` (userId, type: `'allow' | 'deny'`, target: email ou `@domaine.com`, note).
- Service & routes : `backend/src/services/security/senderListService.ts`, `/api/sender-lists`.
- Intégration worker : filtrage automatique à l'arrivée (les messages de l'allowlist ne sont jamais marqués spam, les messages de la denylist sont envoyés directement dans Junk).
- Interface utilisateur dans `/mail/settings` (onglet Sécurité / Filtrage).

---

### Phase 20 — Dossiers Virtuels Intelligents & Recherches Sauvegardées

**Objectif :** Permettre l'organisation dynamique des messages sans les déplacer de leurs dossiers d'origine (façon *Smart Folders* macOS Mail / Thunderbird).

#### Lot 20.1 — Modèle & API des Recherches Sauvegardées
- Modèle backend : `backend/src/models/SmartFolder.ts` :
  - `userId`, `name`, `icon`, `color`, `query` (syntaxe de recherche HelloMail existante : `is:unread`, `from:boss@corp.com`, `has:attachment`, `tag:Important`).
- Validation Zod : `backend/src/schemas/smartFolderSchemas.ts`.
- Routes REST : `GET /api/smart-folders`, `POST`, `PATCH /:id`, `DELETE /:id`.

#### Lot 20.2 — Moteur d'évaluation & compteurs de dossiers intelligents
- Service backend : `backend/src/services/email/smartFolderService.ts`.
- Endpoint : `GET /api/smart-folders/:id/messages` (résolution dynamique de la requête stockée sur la collection `MessageModel`).
- Calcul dynamique du compteur de messages non-lus correspondant aux critères.

#### Lot 20.3 — Intégration UI dans la barre latérale
- Nouveaux composants : `frontend/src/components/mail/SmartFolderList.tsx`, `SmartFolderDialog.tsx`.
- Positionnement dans `AccountSidebar` sous une section dédiée pliable "Dossiers intelligents".
- Bouton "+" pour créer un dossier intelligent à partir de la recherche Spotlight active.

---

### Phase 21 — Signatures d'Email Avancées, Variables & Images Inline

**Objectif :** Transformer HelloMail en outil de communication professionnelle irréprochable avec signatures multi-marques et graphiques.

#### Lot 21.1 — Variables dynamiques dans les signatures
- Extension du modèle `Account` : support de variables dynamiques dans `signature.html` :
  - `{{nom}}`, `{{prenom}}`, `{{email}}`, `{{telephone}}`, `{{poste}}`, `{{societe}}`.
- Remplacement automatique côté frontend lors de l'insertion dans `ComposeForm`.

#### Lot 21.2 — Support des images inline (CID / Data URI)
- Prise en charge de l'upload de logos et bannières de signature :
  - Conversion et compression automatique des images de signature (< 200 Ko).
  - Gestion des pièces jointes inline `Content-ID` (CID) dans `sendService.ts` pour que les logos ne s'affichent pas comme des fichiers téléchargeables séparés chez le destinataire.

#### Lot 21.3 — Liaison signatures / Alias d'expédition
- Permettre d'associer une signature distincte à chaque alias configuré pour un même compte.
- Changement fluide et transparent de la signature dans `ComposeForm` dès que l'utilisateur modifie l'expéditeur dans le sélecteur "De :".

---

### Phase 22 — Résilience & Mode Hors-Ligne PWA (Cache Local & File d'Attente)

**Objectif :** Consultation et tri des emails même en l'absence totale de réseau.

#### Lot 22.1 — Manifeste PWA & Service Worker
- Configuration Next.js PWA (`manifest.json`, icônes applicatives, thème couleur OS).
- Service Worker assurant la mise en cache des assets statiques (CSS, JS, polices).

#### Lot 22.2 — Cache local IndexedDB chiffré
- Utilisation de la bibliothèque `idb` côté frontend.
- Stockage local des 100 derniers messages de la boîte de réception et des dossiers favoris.
- Chiffrement local transparent via Web Crypto API (AES-GCM avec clé dérivée du mot de passe de session).

#### Lot 22.3 — File d'attente d'actions hors-ligne ("Offline Queue")
- Interception des actions en mode hors-ligne (marquer lu, supprimer, archiver, déplacer).
- Stockage dans une table IndexedDB `pending_mutations`.
- Écoute de l'événement `navigator.onLine` et rejeu séquentiel idempotent avec notification de synchronisation.

---

## 4. Matrice des priorités, efforts et impacts

| Phase | Intitulé | Priorité | Effort | Impact utilisateur / performance |
|---|---|---|---|---|
| **Phase 17** | **Performance Réseau, Compression & Indexation** | 🔴 CRITIQUE | Faible à Moyen | Gain immédiat : -80% volume réseau, zéro in-memory sort MongoDB, affichage instantané des messages au survol |
| **Phase 18** | **Expérience Power User : Multi-sélection Clavier** | 🟠 HAUTE | Moyen | Productivité x5 pour le tri de boîtes volumineuses, conformité avec les standards desktop (Thunderbird) |
| **Phase 19** | **Confiance, Réputation & Anti-Spam (SPF/DKIM)** | 🟠 HAUTE | Moyen | Protection anti-usurpation d'identité, signaux de sécurité visuels clairs et listes de confiance |
| **Phase 20** | **Dossiers Virtuels Intelligents & Recherches Sauvegardées** | 🟡 MOYENNE | Moyen | Organisation dynamique sans altération des arborescences IMAP d'origine |
| **Phase 21** | **Signatures d'Email Avancées & Images Inline** | 🟡 MOYENNE | Faible à Moyen | Rendu professionnel irréprochable des emails émis par compte et par alias |
| **Phase 22** | **Résilience & Mode Hors-Ligne PWA** | 🔵 ÉVOLUTIVE | Élevé | Consultation et tri sans interruption en déplacement (avions, trains, zones blanches) |

---

*Document d'audit V2 généré le 12 septembre 2026. Prêt pour l'ordonnancement et l'exécution de la Phase 17.*
