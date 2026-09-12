# SecureView

SecureView est une alternative française à Digify : elle permet de partager un
document confidentiel en **lecture seule**, sans que le destinataire ne
récupère jamais le fichier source. Le serveur rasterise chaque page en image,
y brûle un filigrane nominatif, et sert ces images via des URLs signées à
durée de vie très courte. Hébergement pensé pour la France/UE (Scaleway
Object Storage compatible S3).

Public visé : cabinets d'avocats, consultants, agences, fonds
d'investissement — tout usage où la confidentialité et la traçabilité de la
diffusion comptent plus que le confort de l'export PDF.

## Sommaire

- [Principe de sécurité](#principe-de-sécurité)
- [Architecture](#architecture)
- [Démarrage](#démarrage)
- [Modèle de données](#modèle-de-données)
- [Modèle de menace et limites honnêtes](#modèle-de-menace-et-limites-honnêtes)
- [Tests](#tests)
- [Configuration](#configuration)
- [Roadmap](#roadmap)

## Principe de sécurité

Le destinataire ne télécharge **jamais** un PDF. Le flux est :

1. L'expéditeur téléverse un PDF. Il est chiffré (AES-256-GCM, clé unique par
   document) et stocké en S3.
2. Un job asynchrone (BullMQ) déchiffre le PDF **en mémoire**, le rasterise
   page par page à 150 DPI (via `mupdf`), et stocke des pages "propres" (sans
   filigrane) en S3. Le PDF déchiffré ne touche jamais le disque.
3. Quand le destinataire demande une page, le serveur récupère la page
   propre, y compose (via `sharp`) un filigrane SVG répété en diagonale
   contenant **son nom, son email, son IP et l'horodatage à la minute**, puis
   encode le résultat en WebP.
4. Cette page filigranée est mise en cache Redis 15 minutes, et servie via
   une **URL signée HMAC valable 45 secondes, à usage unique**, liée à la
   session du destinataire.
5. Le viewer affiche l'image dans un `<canvas>` (jamais de `<img src>`
   exploitable), précharge les 2 pages suivantes, et se floute immédiatement
   si l'onglet perd le focus.

Résultat : l'onglet réseau du navigateur du destinataire ne contient que des
images filigranées à son nom, à très courte durée de vie.

## Architecture

```
apps/
  api/      Fastify + TypeScript + Prisma + Redis + BullMQ
  web/      React 19 + Vite + Tailwind v4
packages/
  shared/   Schémas Zod et types partagés entre l'API et le front
```

**Stack** : Node 20+, Fastify, PostgreSQL (Prisma), Redis (ioredis), BullMQ,
mupdf (rasterisation PDF → PNG), sharp (filigrane SVG → WebP), stockage
S3-compatible (`@aws-sdk/client-s3`, configuré pour Scaleway ou MinIO en
dev), React 19 + Vite + Tailwind v4, JWT httpOnly + rotation pour
l'expéditeur, OTP par email pour le destinataire.

### Pourquoi un worker séparé du serveur HTTP ?

La rasterisation d'un PDF de plusieurs dizaines de pages peut prendre du
temps. Elle est déléguée à un worker BullMQ (`apps/api/src/jobs/render.worker.ts`)
qui tourne comme process indépendant, pour ne jamais bloquer l'API pendant un
upload.

## Démarrage

Prérequis : Node 20+, Docker (pour Postgres/Redis/MinIO en local).

```bash
git clone <repo>
cd secureview
cp .env.example .env
# Remplir MASTER_ENCRYPTION_KEY, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET,
# PAGE_URL_SIGNING_SECRET avec des valeurs aléatoires, par exemple :
#   openssl rand -base64 32   (pour MASTER_ENCRYPTION_KEY)
#   openssl rand -hex 32      (pour les secrets JWT et de signature d'URL)

npm run setup   # installe les dépendances, lance docker compose, migre et seed la base
npm run dev     # démarre l'API, le worker de rendu et le front en parallèle
```

- Front : http://localhost:5173
- API : http://localhost:4000
- Compte de démonstration créé par le seed : voir la sortie de `npm run setup`
  (email `demo@secureview.fr`, mot de passe affiché en console) — un document
  d'exemple et un partage de démonstration sont créés automatiquement.

`docker compose` démarre Postgres, Redis et MinIO (S3-compatible) pour le
développement local. En production, pointez `S3_ENDPOINT` vers votre bucket
Scaleway Object Storage — le code ne fait aucune hypothèse spécifique à
MinIO.

## Modèle de données

`User` (expéditeur) → `Document` (chiffré, statut de traitement) →
`DocumentPage` (pages rasterisées propres) ; `Document` → `Share` (un lien
nominatif : droits, expiration, `maxViews`, `revokedAt`) → `ShareSession`
(une ouverture authentifiée par OTP) → `AuditEvent` / `PageView` (traçabilité
complète : qui a ouvert quoi, quand, depuis quelle IP, combien de temps par
page).

Le champ `signatureProvider`/`signatureRequestId`/`signatureStatus` sur
`Share` est un point d'entrée volontairement vide, prévu pour l'intégration
Yousign en phase 2 (voir [Roadmap](#roadmap)).

Le schéma complet est dans `apps/api/prisma/schema.prisma`.

## Modèle de menace et limites honnêtes

**Ce que SecureView protège réellement** : la distribution incontrôlée du
fichier source. Un destinataire ne peut pas récupérer le PDF original, et
chaque page qu'il consulte porte son identité, son IP et l'horodatage — donc
toute fuite est traçable jusqu'à la personne qui a ouvert le document.

**Ce que SecureView ne peut pas empêcher, et qu'il ne faut jamais promettre à
un client** :

- **La capture d'écran ou la photo de l'écran sont techniquement
  impossibles à bloquer** dans un navigateur standard. Aucun outil de partage
  web (Digify inclus) ne peut réellement l'empêcher. La protection réelle
  n'est pas l'empêchement, c'est la **dissuasion par traçabilité
  nominative** : le filigrane rend toute fuite attribuable.
- Un destinataire déterminé et technique peut reconstituer un document via
  des captures d'écran répétées, assemblées manuellement. C'est lent et
  laisse des traces (le filigrane apparaît sur chaque capture), mais ce
  n'est pas impossible.
- Le blocage du menu contextuel, de la sélection et du glisser-déposer sont
  des frictions, pas des mesures de sécurité : elles découragent l'usage
  occasionnel, pas un attaquant motivé avec les outils de développement du
  navigateur ouverts.
- La détection `blur`/`visibilitychange` peut être contournée par un
  utilisateur qui modifie son navigateur ou utilise des outils
  d'automatisation.
- Le filigrane contient l'IP de connexion, qui peut être partagée (VPN,
  proxy d'entreprise) entre plusieurs personnes légitimes — ce n'est pas un
  identifiant individuel garanti, seulement un signal d'audit
  supplémentaire.

En résumé : **SecureView est un outil de traçabilité et de contrôle d'accès,
pas un DRM inviolable.** C'est un choix de conception assumé plutôt qu'une
limitation cachée.

### Ce qui est réellement solide

- Le fichier source n'est jamais transmis au navigateur du destinataire, à
  aucun moment — ni en clair, ni chiffré.
- Chaque URL de page est signée, valable 45 secondes, à usage unique
  (vérifié côté serveur via Redis), et liée à la session du destinataire.
- La révocation par l'expéditeur coupe la session en cours **instantanément**
  via WebSocket, sans attendre une expiration de cache ou de token.
- L'authentification du destinataire par OTP email limite l'accès à la
  personne réellement invitée (dans la limite de la sécurité d'une boîte
  mail — voir ci-dessus concernant le partage de connexion).

## Tests

```bash
npm run test --workspace apps/api
```

Couvre : le chiffrement AES-256-GCM (round-trip, altération détectée par
GCM), la génération/expiration/usage unique des URLs de page signées, la
logique pure de révocation et d'expiration d'un partage, et le flux OTP
(génération, vérification, verrouillage après tentatives multiples).

Ces tests s'exécutent contre une instance Redis réelle (celle démarrée par
`docker compose` / `npm run setup`) plutôt que contre un mock, pour rester
fidèles au comportement réel du cache et de l'usage unique des tokens.

## Configuration

Toutes les variables sont documentées dans [`.env.example`](.env.example).
Points d'attention :

- `MASTER_ENCRYPTION_KEY` : clé maîtresse (32 octets, base64) qui enveloppe
  la clé de chiffrement unique de chaque document. Sa perte rend tous les
  documents existants indéchiffrables — sauvegardez-la comme un secret de
  production critique.
- `EMAIL_PROVIDER=console` (par défaut en dev) affiche le code OTP dans les
  logs du serveur au lieu d'envoyer un email. Passez à `smtp` en production.
- Rate limiting actif sur les endpoints OTP (`RATE_LIMIT_OTP_*`) et de
  livraison de page (`RATE_LIMIT_PAGE_*`).
- Les logs (Pino) ne contiennent jamais de contenu de document, de code OTP,
  ni de secret — voir la configuration `redact` dans `src/lib/logger.ts`.

## Roadmap

- **Signature électronique (Yousign)** — non implémentée volontairement.
  Le modèle `Share` expose déjà `signatureProvider`, `signatureRequestId` et
  `signatureStatus` comme point d'entrée propre pour la phase 2.
- Rendu de formats additionnels (Office via conversion préalable en PDF).
- Watermark configurable (position, opacité) par l'expéditeur.
- Export de l'historique d'audit (CSV/PDF) pour preuve de diffusion.
