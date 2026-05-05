# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Commit conventions

- **Never add a `Co-Authored-By: Claude` trailer.** The user (Vala) is the sole author of every commit. The release notes shown in the auto-update modal pull from the GitHub release body, and that trailer leaks into the player-facing text.
- Keep commit messages plain (no HTML). GitHub renders them as HTML in release notes — `<p>` and `<br />` would appear literally in the in-app modal otherwise.

## Monorepo Structure

Two independent packages — always `cd` into the right one before running commands:

| Dossier | Rôle |
|---|---|
| `app/` | Frontend React + Electron desktop client |
| `server/` | Backend Node.js (Express + Socket.IO + SQLite) |

## Commands

### Frontend (`app/`)
```bash
npm run dev              # Vite dev server on :5173 (proxies /api et /socket.io vers :3001)
npm run build            # tsc + vite build → dist/
npm run typecheck        # tsc --noEmit seulement
npm run electron:package # build + packager portable Windows (release/Combo-win32-x64/)
npm run electron:build   # build + installateur NSIS (nécessite droits admin Windows)
npm run electron:preview # build + ouvre dans Electron sans installer
npm run electron:publish # build + publie sur GitHub Releases (auto-update)
```

### Serveur (`server/`)
```bash
npm run dev              # tsx watch avec --experimental-sqlite (hot reload)
npm run build            # tsc → dist/
npm run start            # node --experimental-sqlite dist/index.js (prod)
npm run typecheck        # tsc --noEmit
```

## Déploiement VPS

Le serveur tourne sur `https://51.68.129.168.sslip.io` géré par **systemctl** (`combo.service`). En prod le **gate desktop-only** est actif (voir section dédiée plus bas) : le serveur ne sert plus le SPA, juste l'API + Socket.IO + une landing page « télécharger pour Windows » à la racine. Les joueurs jouent uniquement via le `.exe`.

Commandes de déploiement (depuis `/home/ubuntu/combo`) :

```bash
# Changement uniquement côté server/  (cas le plus fréquent maintenant)
git pull
npm --prefix server run build
sudo systemctl restart combo.service

# Changement uniquement côté app/
# → PAS de rebuild VPS. Faire `npm run electron:publish` en local pour
#   pousser une nouvelle release. L'auto-update livre la version aux joueurs.

# Changement des deux
git pull
npm --prefix server run build
sudo systemctl restart combo.service
# Puis publier app/ depuis Windows (cf section Auto-update plus bas)
```

> Le serveur ne lit plus `app/dist/` quand le gate est actif — pas besoin de rebuilder le client sur le VPS.

## Environment Variables

### `server/.env` (sur le VPS)
```
PORT=3001
JWT_SECRET=<secret obligatoire en prod>
DB_PATH=./data/combo.db
CORS_ORIGIN=http://localhost:5173
NODE_ENV=production
DESKTOP_CLIENT_SECRET=<secret partagé avec app/.env>
DESKTOP_DOWNLOAD_URL=https://github.com/Valaraukar56/combo/releases/latest  # optionnel
```
- `JWT_SECRET` manquant en prod = crash au démarrage (voulu).
- `DESKTOP_CLIENT_SECRET` non défini = mode `open` (gate désactivé, le SPA est servi). C'est le mode dev. Avec une valeur, le serveur passe en mode `desktop-only` (cf section Desktop-only gate).
- Le log au boot affiche `(production, desktop-only)` ou `(production, open)` selon l'état du gate — utile pour vérifier que la variable d'env est bien lue par systemd.

### `app/.env` (en local sur la machine de build Windows, gitignoré)
```
GH_TOKEN=<token GitHub avec scope "repo">
VITE_API_URL=https://51.68.129.168.sslip.io
VITE_DESKTOP_CLIENT_SECRET=<même valeur que côté server>
```
- `GH_TOKEN` : utilisé par electron-builder pour pousser les releases.
- `VITE_API_URL` : URL de l'API embarquée dans le bundle. Vide en dev = relatif (proxy Vite).
- `VITE_DESKTOP_CLIENT_SECRET` : embarqué dans le bundle au build, envoyé en `X-Combo-Client` à chaque appel API et dans `handshake.auth.client` côté Socket.IO.

### `app/.env.production` (committé, public)
```
VITE_API_URL=https://51.68.129.168.sslip.io
```
Cette variable est OK à exposer (c'est juste l'URL). **Ne jamais y mettre `VITE_DESKTOP_CLIENT_SECRET`** : ça serait commit en clair sur GitHub.

## Architecture

### Flux de données global

```
Client React/Electron
  ├── REST (fetch) → /api/auth/*, /api/stats/*    (auth, stats, leaderboard)
  └── WebSocket (Socket.IO) → tous les events de jeu en temps réel
```

Tout l'état de jeu vivant est **server-authoritative** : le serveur est la seule source de vérité. Le client ne fait que refléter ce que le serveur envoie.

### Backend — fichiers clés

- **`server/src/room.ts`** — La classe `Room` contient toute la logique de jeu : deal, draw, swap, discard, snap, combo, scoring, gestion des timers (snap window 3s, memorize 6s, power timeout 20s, reconnect grace 30s). C'est le cœur du jeu.
- **`server/src/socket.ts`** — Câble les événements Socket.IO aux méthodes de `Room`. Gère aussi le driver bot (tourne le tour des bots avec un délai de 1,2s). Chaque socket est authentifié via JWT à la connexion.
- **`server/src/rooms.ts`** — Map en mémoire `code → Room`. Les rooms sont éphémères (pas persistées en DB).
- **`server/src/db.ts`** — SQLite via `node:sqlite` (builtin Node.js ≥ 22, flag `--experimental-sqlite`). 4 tables : `users`, `user_stats`, `games`, `game_players`. Inclut une migration inline pour la colonne `is_admin`.
- **`server/src/auth.ts`** — JWT HS256, bcrypt pour les passwords. La fonction `ensureAdmin` crée un compte admin au démarrage si `ADMIN_PSEUDO`/`ADMIN_PASSWORD` sont définis dans l'env.

### Frontend — fichiers clés

- **`app/src/App.tsx`** — Router à état (`useState<Page>`). Routing en 3 zones : anonymous (home/login/register), authenticated+in-room (routé par `roomState.phase`), authenticated+lobby (meta pages).
- **`app/src/lib/game.tsx`** — `GameProvider` + `useGame()`. Unique point d'entrée pour tout ce qui touche au jeu. Gère la connexion Socket.IO, écoute tous les events serveur, expose les actions (draw, swap, snap, combo, powers…).
- **`app/src/lib/auth.tsx`** — `AuthProvider` + `useAuth()`. Hydrate le token JWT depuis localStorage au mount, expose `user` et les méthodes login/register/logout.
- **`app/src/lib/socket.ts`** — Singleton Socket.IO. L'URL de connexion vient de `import.meta.env.VITE_API_URL` (vide en dev = connexion relative, URL VPS en prod).
- **`app/src/lib/api.ts`** — Toutes les requêtes REST. Préfixe les paths avec `VITE_API_URL` (même logique). Token JWT injecté automatiquement dans chaque requête.

### Phases de jeu (Room.phase)

```
waiting → memorize (6s) → turn ⟷ snap-window (3s)
                                ↕ power (20s timeout)
                                ↕ combo-final
                           → round-end → [nouvelle manche ou game-end]
```

La mécanique **snap** : après chaque discard/swap, une fenêtre de 3s s'ouvre. N'importe quel joueur peut tenter de snapper une de ses cartes si son rang = top du discard. Succès → slot devient `null` (trou). Échec → carte penalty ajoutée à la main.

**Combo** : un joueur appelle combo à la place de jouer. Chaque autre joueur connecté joue exactement un dernier tour, puis la manche se termine.

### Desktop-only gate

Depuis l'introduction du `.exe`, **le serveur n'accepte plus que le client desktop**. Mécanisme :

- Côté serveur (`server/src/index.ts` + `config.ts`) : si `DESKTOP_CLIENT_SECRET` est défini dans l'env, deux gates sont activés :
  1. **HTTP** — toutes les routes `/api/*` exigent un header `X-Combo-Client` égal au secret. Sans ça, 403. `/api/health` reste ouvert pour le monitoring.
  2. **Socket.IO** — le handshake exige `socket.handshake.auth.client === secret`. Sans ça, la connexion est refusée.
  3. **Racine** — `/` retourne une landing page « Télécharger pour Windows ↓ » qui pointe vers `DESKTOP_DOWNLOAD_URL` (par défaut le dernier release GitHub). Le SPA n'est plus servi en prod.
- Côté client (`app/src/lib/api.ts` + `socket.ts`) : si `VITE_DESKTOP_CLIENT_SECRET` est non vide à la build, il est envoyé dans le header / handshake. Vide = pas de header (mode dev navigateur).
- Le secret est embarqué dans le JS minifié du `.exe`. Réversible avec du reverse-engineering, mais largement suffisant pour un jeu entre amis. Si le secret fuite, en générer un nouveau (`openssl rand -hex 32`), mettre à jour `server/.env` + `app/.env`, redémarrer le serveur et republier le `.exe`.

**Activer / désactiver le gate** :
- Activer : ajouter `DESKTOP_CLIENT_SECRET=...` dans `/home/ubuntu/combo/server/.env` puis `sudo systemctl restart combo.service`.
- Désactiver temporairement (dev / debug) : commenter la ligne et restart. Le serveur log `(production, open)` au boot.

### Electron (app/electron/main.cjs)

Charge `dist/index.html` en `file://`. Le `.cjs` est nécessaire car `app/package.json` a `"type": "module"`. La config `base: './'` dans `vite.config.ts` est essentielle pour que les assets (`./assets/...`) soient résolvables depuis `file://`.

### Icônes de l'app

Deux fichiers à conserver à `app/build/` :

- `icon.ico` — utilisé par electron-builder pour l'icône du `.exe`, de l'installeur NSIS et du désinstalleur.
- `icon.png` — utilisé par `BrowserWindow` au runtime pour la barre des tâches Windows / Alt+Tab. Embarqué dans le package via `build/icon.png` listé dans `build.files`.

Si tu changes l'icône, remplace les **deux** fichiers (le PNG en 512×512 idéalement, le ICO multi-tailles 16/32/48/256). Pour reconvertir : https://convertio.co/fr/png-ico/

### Auto-update (electron-updater)

Les mises à jour sont distribuées via **GitHub Releases** (repo `Valaraukar56/combo`). Au démarrage, l'app vérifie silencieusement s'il y a une nouvelle version. Si oui, elle télécharge en arrière-plan et propose un redémarrage via une dialog.

#### Ce que Claude peut faire tout seul

Le shell Bash exposé à Claude tourne **sur la machine Windows de Vala** avec accès direct à `D:\PROJET CODE TA MERE\COMBO`. Donc Claude peut enchaîner toute la chaîne de release lui-même quand Vala lui dit « publie » :

```bash
cd "D:/PROJET CODE TA MERE/COMBO/app"
git pull
# bump version (npm version patch dans une working tree dirty ne commit/tag pas tout seul,
# faire le commit + tag à la main si besoin)
git add release-notes.md && git commit -m "docs: release notes for X.Y.Z"
git add package.json package-lock.json && git commit -m "X.Y.Z"
git tag vX.Y.Z
git push origin main
git push origin vX.Y.Z
npm run electron:publish
```

Tous les secrets (`GH_TOKEN`, `VITE_DESKTOP_CLIENT_SECRET`) sont dans `app/.env` qui est lu par `scripts/publish.cjs` — Claude n'a pas besoin de les voir, juste de lancer la commande.

#### Ce que Claude ne peut PAS faire

- **Restart le service sur le VPS** : pas d'accès SSH au VPS (`ubuntu@vps-ecfe91a2`). Pour activer une nouvelle version du serveur en prod, Vala doit lui-même se SSH et lancer la séquence de déploiement (cf section « Déploiement VPS »).

#### Procédure de release

1. Monter `"version"` dans `app/package.json` (`npm version patch` ne marche que si la working tree est clean — sinon faire à la main).
2. **Réécrire `app/release-notes.md`** : un résumé court, en français, orienté joueur (pas de fichiers, pas de jargon technique). Ce fichier devient le body GitHub et s'affiche dans la modale d'update — donc rester concis et clair. **Format imposé** : commencer par `Combo v{version}` puis les puces. Le script `publish.cjs` refuse de publier si la version courante n'apparaît pas dans le fichier (garde-fou anti-notes-périmées). Ne pas inclure de ligne « Auteur : Vala » — electron-builder l'injecte aussi dans le `latest.yml`, ce qui la fait apparaître deux fois dans la modale d'update.
3. Committer + pusher (notes + version + tag) sur main.
4. `npm run electron:publish` — Claude le lance directement, ou Vala depuis PowerShell admin.

`app/.env` doit contenir au minimum `GH_TOKEN`, `VITE_API_URL` et `VITE_DESKTOP_CLIENT_SECRET` (cf section Environment Variables). Tous sont chargés par `scripts/publish.cjs` au runtime — `VITE_*` sont consommés par Vite au build, `GH_TOKEN` par electron-builder pour l'upload.

> Le contenu de `app/release-notes.md` est pris en compte automatiquement par `scripts/publish.cjs` via `--config.releaseInfo.releaseNotesFile`. Si le fichier est absent, electron-builder retombe sur les messages de commit (à éviter).

#### Vérifier qu'un publish est sain avant d'installer

```bash
# depuis le shell Claude (bash) ou Vala (PowerShell)
grep -c 'X-Combo-Client' app/dist/assets/index-*.js   # doit être ≥ 1
grep -c 'X-Combo-Version' app/dist/assets/index-*.js  # doit être ≥ 1 (depuis 0.1.20)
```

Si l'un ne matche pas, le `.exe` publié est cassé et tous les joueurs auront du 403. Bumper la version et republier.

#### Ordre déploiement quand le serveur change aussi

Le serveur a un check de version (rejette toute version `< latest GitHub release`). Conséquence : déployer le serveur **avant** que le `.exe` ne soit publié bloque tout le monde le temps que l'auto-update kicke. Toujours dans l'ordre :
1. Publier le `.exe` (`npm run electron:publish`).
2. Déployer le serveur (`git pull && npm --prefix server run build && sudo systemctl restart combo.service`).
3. Les clients déjà installés voient le banner d'update au prochain lancement et migrent automatiquement.

## Points d'attention

- **SQLite natif** : le serveur requiert Node.js ≥ 22.5 et le flag `--experimental-sqlite`. `npm run dev` l'inclut déjà.
- **Rooms en mémoire** : un restart serveur vide toutes les rooms en cours. Les stats en DB sont préservées.
- **Sécurité des mains** : le serveur envoie `game:hand` (main privée) séparément à chaque joueur. `publicState()` ne révèle jamais les cartes, seulement le `handCount` et les trous (`holes`).
- **Solo = pas de stats** : les parties solo (vs bots) ne sont pas enregistrées en DB (`isSolo` check dans `finalizeAndPersist`).
- **Admin** : le flag `is_admin` sur un user débloque le `DevNav` (overlay de debug) côté client et les events `dev:trigger-power` côté serveur.
- **Build Windows manquante d'un secret = 403** : si `VITE_DESKTOP_CLIENT_SECRET` est absent de `app/.env` au moment du build, le bundle ne contient pas le header et le `.exe` se prend des 403 à chaque appel API. Vérifier rapidement avec `Select-String -Path "app/dist/assets/index-*.js" -Pattern "Combo-Client"` — doit retourner un match.
- **Pull avant publish** : la machine Windows de build doit être à jour avec `main` avant chaque `electron:publish`. Sinon le `.exe` distribué peut contenir l'ancien code, pas les dernières features.
- **VPS package-lock.json** : `git pull` peut échouer parce qu'un `npm install` précédent a régénéré le lock file. Récupérer avec `git checkout -- app/package-lock.json` (ou `server/package-lock.json`) puis re-pull.
