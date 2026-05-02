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

Le serveur tourne sur `https://51.68.129.168.sslip.io` géré par **systemctl** (`combo.service`).

Commandes de déploiement (depuis `/home/ubuntu/combo`) :

```bash
# Si seul app/ a changé (cas le plus fréquent)
git pull
npm --prefix app run build
sudo systemctl restart combo.service

# Si server/ a aussi changé
git pull
npm --prefix server run build
npm --prefix app run build
sudo systemctl restart combo.service
```

## Environment Variables

### `server/.env`
```
PORT=3001
JWT_SECRET=<secret obligatoire en prod>
DB_PATH=./data/combo.db
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
```
En production, `JWT_SECRET` manquant fait crasher le serveur au démarrage (voulu).

### `app/.env.production`
```
VITE_API_URL=https://51.68.129.168.sslip.io
```
En dev, `VITE_API_URL` est vide — le proxy Vite prend le relais vers `:3001`.

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

### Electron (app/electron/main.cjs)

Charge `dist/index.html` en `file://`. Le `.cjs` est nécessaire car `app/package.json` a `"type": "module"`. La config `base: './'` dans `vite.config.ts` est essentielle pour que les assets (`./assets/...`) soient résolvables depuis `file://`.

### Icônes de l'app

Deux fichiers à conserver à `app/build/` :

- `icon.ico` — utilisé par electron-builder pour l'icône du `.exe`, de l'installeur NSIS et du désinstalleur.
- `icon.png` — utilisé par `BrowserWindow` au runtime pour la barre des tâches Windows / Alt+Tab. Embarqué dans le package via `build/icon.png` listé dans `build.files`.

Si tu changes l'icône, remplace les **deux** fichiers (le PNG en 512×512 idéalement, le ICO multi-tailles 16/32/48/256). Pour reconvertir : https://convertio.co/fr/png-ico/

### Auto-update (electron-updater)

Les mises à jour sont distribuées via **GitHub Releases** (repo `Valaraukar56/combo`). Au démarrage, l'app vérifie silencieusement s'il y a une nouvelle version. Si oui, elle télécharge en arrière-plan et propose un redémarrage via une dialog.

**Pour publier une nouvelle version :**

> ⚠️ À faire **en local sur le PC de dev** (pas sur le VPS). Nécessite PowerShell en mode **administrateur**.

1. Monter `"version"` dans `app/package.json` (ex: `"0.1.0"` → `"0.1.1"`) — c'est Claude qui fait ce changement.
2. **Réécrire `app/release-notes.md`** avec un résumé court, en français, orienté joueur (pas de fichiers, pas de jargon technique). Ce fichier est injecté tel quel dans la release GitHub et s'affiche dans la modale de mise à jour côté joueur — donc rester concis et clair.
3. Committer + pusher (version + notes) sur main.
4. Donner la commande suivante à l'utilisateur pour qu'il la lance en local dans PowerShell admin :
```powershell
cd "D:\PROJET CODE TA MERE\COMBO\app"
npm run electron:publish
```
Le `GH_TOKEN` est déjà dans `app/.env` et est chargé automatiquement par le script de publication. Ne jamais le commiter.

> Le contenu de `app/release-notes.md` est pris en compte automatiquement par `scripts/publish.cjs` via `--config.releaseInfo.releaseNotesFile`. Si le fichier est absent, electron-builder retombe sur les messages de commit (à éviter).

## Points d'attention

- **SQLite natif** : le serveur requiert Node.js ≥ 22.5 et le flag `--experimental-sqlite`. `npm run dev` l'inclut déjà.
- **Rooms en mémoire** : un restart serveur vide toutes les rooms en cours. Les stats en DB sont préservées.
- **Sécurité des mains** : le serveur envoie `game:hand` (main privée) séparément à chaque joueur. `publicState()` ne révèle jamais les cartes, seulement le `handCount` et les trous (`holes`).
- **Solo = pas de stats** : les parties solo (vs bots) ne sont pas enregistrées en DB (`isSolo` check dans `finalizeAndPersist`).
- **Admin** : le flag `is_admin` sur un user débloque le `DevNav` (overlay de debug) côté client et les events `dev:trigger-power` côté serveur.
