# AGENTS.md — Sync Worker (services/sync)

Moteur de synchronisation IMAP IDLE. Tourne dans un process Node séparé (`worker.ts`).

## Règles de discipline (à respecter dans toute modification)

### Connexion read-write

INBOX est ouvert en **read-write** pour toute la session (initialSync + IDLE).
C'est nécessaire car IMAP n'envoie les notifications EXPUNGE qu'en mode SELECT
read-write. Le mode readOnly casserait la détection des suppressions.

**Contrainte critique** : aucune commande de fetch ne doit utiliser `BODY[]`,
`RFC822` ou `BODY[...]` sans `.PEEK`. Ces commandes marquent le message comme
`\Seen` côté serveur sans action explicite de l'utilisateur. Toute future
extension qui fetch le corps d'un message (phase de lecture d'email) doit
utiliser `BODY.PEEK[...]` — jamais `BODY[...]` ni `RFC822` sans PEEK.

Cette phase ne fetch que `envelope`, `flags`, `bodyStructure`, `size` : aucun
de ces éléments ne touche `\Seen`. La discipline PEEK doit être maintenue dans
tout code futur ajouté à ce dossier.

### Reconciliation bornée

`reconcileFolder` fetch **uniquement les UID connus en base** pour ce
compte/dossier (`UID FETCH <uids_connus> (UID)`), jamais `SEARCH ALL` sur la
mailbox entière. Le coût reste proportionnel au nombre de messages trackés
(~50 + nouveaux arrivés), pas à la taille totale de la boîte.

Ne pas "simplifier" cette fonction en scan complet sur une grosse boîte —
un `SEARCH ALL` sur une INBOX Gmail de 500k messages serait contre-productif.

### Logs

Aucun sujet ou corps d'email ne doit apparaître dans les logs en production
(`NODE_ENV=production`). Les sujets peuvent contenir des informations
sensibles. Logger uniquement des informations génériques (UID, compte,
nombre de messages, erreurs technique).

### Séparation des responsabilités

Une classe/fonction par responsabilité, pas de logique éparpillée :
- `SyncManager` — cycle de vie d'un compte (connect, sync, idle, reconnexion)
- `accountRegistry` — découverte des comptes actifs (polling)
- `initialSync` — fetch des 50 derniers messages, upsert idempotent
- `idleLoop` — boucle IDLE + handlers exists/expunge/flags
- `reconcileFolder` — reconciliation bornée sur expunge sans UID
- `messageMapper` — transformation pure FetchMessageObject → MessageInput

Garder cette séparation pour faciliter l'extraction future (Redis/BullMQ,
change streams, multi-dossiers, sharding multi-worker).

## Séparation API / Worker (Phase 3)

L'API (process `app.ts`) et le sync worker (process `worker.ts`) ont chacun
leurs propres connexions IMAP. Le worker gère l'IDLE et la sync ; l'API gère
la lecture, l'envoi, les dossiers et les actions via un pool dédié
(`services/email/imapPool.ts`). **Ne jamais partager une connexion ImapFlow
entre l'API et le worker** — ce sont des process séparés avec des cycles de
vie différents.

## Comportement IDLE (ImapFlow)

ImapFlow gère l'auto-IDLE en interne. Quand un handler d'événement appelle
`fetch`/`fetchOne`, la lib envoie `DONE` en coulisses, exécute la commande,
puis re-rentre en IDLE auto après `autoIdleDelay` (15s). Ne pas improviser
ce comportement — consulter la doc officielle (https://imapflow.com) en cas
de doute.

## QRESYNC

`qresync: true` est activé sur le client ImapFlow. Si le serveur ne supporte
pas QRESYNC, ImapFlow fait un fallback gracieux. Sans QRESYNC, les événements
EXPUNGE ne contiennent pas d'UID — `reconcileFolder` prend le relais.
