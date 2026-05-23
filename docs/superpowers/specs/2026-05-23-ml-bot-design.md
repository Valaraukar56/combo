# ML Bot — Design Spec
*Date : 2026-05-23*

## Objectif

Remplacer le bot heuristique de COMBO (`server/src/ai.ts`) par un agent entraîné via Reinforcement Learning, avec trois niveaux de difficulté (easy / medium / hard), pour rendre les parties solo réellement intéressantes.

---

## Architecture globale

```
VPS Linux
├── combo.service        (Node.js — serveur de jeu existant)
│     └── ai.ts  ──────── HTTP POST localhost:8000/action ───┐
└── combo-ai.service     (Python FastAPI — nouveau)           │
      ├── GET  /health                                        │
      └── POST /action  ← { state, difficulty }              │
            └── retourne { action, params }  ─────────────────┘
```

- Le microservice Python tourne sur `localhost:8000`, non exposé à l'extérieur.
- Node.js l'appelle à chaque tour de bot avec un timeout de 500ms.
- Si le microservice est down ou timeout → fallback silencieux sur les heuristiques actuelles de `ai.ts`.
- Trois modèles chargés au démarrage du microservice (`model_easy.zip`, `model_medium.zip`, `model_hard.zip`).

---

## Structure des fichiers

```
ml/
├── combo_env.py          # Environnement gym — simulation complète du jeu
├── train.py              # Script d'entraînement PPO (Stable-Baselines3)
├── server.py             # FastAPI — sert les modèles
├── requirements.txt      # stable-baselines3, gymnasium, fastapi, uvicorn
└── models/
    ├── model_easy.zip
    ├── model_medium.zip
    └── model_hard.zip
```

Modifications côté Node.js :
- `server/src/ai.ts` — ajout de `askMLBot(state, difficulty)` + fallback
- `server/src/socket.ts` — passe le niveau de difficulté au bot (choisi à la création de la room)

---

## Représentation de l'état (observation)

Vecteur numérique fixe transmis au modèle :

| Champ | Taille | Valeurs |
|---|---|---|
| Main du bot (cartes connues) | 4 | 0–13, -1 si inconnue |
| Top du discard | 1 | 0–13 |
| Carte piochée (en main) | 1 | 0–13, -1 si absent |
| Score cumulé du bot | 1 | entier |
| Scores adversaires | 3 | entier (0 si slot vide) |
| Nb cartes adversaires | 3 | 0–8 |
| Numéro de manche | 1 | 1–10 |
| Phase actuelle | 1 | encodé entier |

Total : ~15–20 valeurs. Les cartes inconnues du bot sont représentées par -1 (le modèle apprend à gérer l'incertitude).

---

## Espace d'actions

Les actions illégales sont masquées à chaque step (action masking — technique standard SB3).

Enum complet (index → nom) :

| Index | Action | Phase |
|---|---|---|
| 0 | `draw_deck` | Début de tour |
| 1 | `draw_discard` | Début de tour |
| 2 | `call_combo` | Début de tour |
| 3 | `swap_0` | Après pioche |
| 4 | `swap_1` | Après pioche |
| 5 | `swap_2` | Après pioche |
| 6 | `swap_3` | Après pioche |
| 7 | `discard` | Après pioche |
| 8 | `snap_0` | Snap window |
| 9 | `snap_1` | Snap window |
| 10 | `snap_2` | Snap window |
| 11 | `snap_3` | Snap window |
| 12 | `pass_snap` | Snap window |
| 13–24 | `peek_own_0..3`, `peek_opp_0..3`, `swap_opp_0..3` | Power |

`legal_actions` dans la requête API = liste des indices légaux pour le step courant. Le modèle ne peut choisir que parmi eux.

---

## Fonction de récompense

| Événement | Récompense |
|---|---|
| Manche gagnée (score min) | +1.0 |
| Partie gagnée | +2.0 |
| Combo réussi | +0.5 |
| Combo raté (pénalité +10) | -0.5 |
| Snap réussi | +0.3 |
| Snap raté (carte penalty) | -0.2 |
| Score final proportionnel | -score/50 (encourage à baisser son score) |

---

## Niveaux de difficulté

| Niveau | Steps d'entraînement | Bruit d'action | Curriculum |
|---|---|---|---|
| Easy | 100 000 | Élevé (ε = 0.3) | Non |
| Medium | 300 000 | Faible (ε = 0.05) | Non |
| Hard | 500 000+ | Aucun | Oui (commence contre easy, monte) |

Le niveau sera choisi par le joueur à la création de la room solo (UI à faire dans une itération suivante). **Pour cette première implémentation, le niveau est passé en paramètre côté serveur et défaut à `"medium"`**. La room solo expose une option `botDifficulty: "easy" | "medium" | "hard"` qui peut être forcée via l'event de création de room.

---

## API FastAPI

### `POST /action`

**Body :**
```json
{
  "state": {
    "hand": [3, -1, 7, -1],
    "discard_top": 5,
    "drawn_card": -1,
    "bot_score": 12,
    "opp_scores": [8, 0, 0],
    "opp_hand_counts": [4, 0, 0],
    "round": 2,
    "phase": 0
  },
  "difficulty": "medium",
  "legal_actions": [0, 2]
}
```

**Réponse :**
```json
{
  "action": "draw_deck"
}
```

### `GET /health`
Retourne `{ "status": "ok" }` — utilisé par Node.js pour détecter si le service est up.

---

## Intégration Node.js

Dans `server/src/ai.ts` :

```typescript
async function askMLBot(state, difficulty, legalActions): Promise<string | null> {
  try {
    const res = await fetch('http://localhost:8000/action', {
      method: 'POST',
      body: JSON.stringify({ state, difficulty, legal_actions: legalActions }),
      signal: AbortSignal.timeout(500),
    });
    const data = await res.json();
    return data.action;
  } catch {
    return null; // fallback sur heuristiques
  }
}
```

Les heuristiques actuelles restent en place comme fallback — zéro régression si le microservice est down.

---

## Déploiement VPS

Nouveau service systemd `combo-ai.service` :

```ini
[Unit]
Description=Combo AI Microservice
After=network.target

[Service]
WorkingDirectory=/home/ubuntu/combo/ml
ExecStart=/home/ubuntu/combo/ml/venv/bin/uvicorn server:app --host 127.0.0.1 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

Commandes de déploiement (après entraînement local) :
```bash
# Copier les modèles sur le VPS
scp ml/models/*.zip ubuntu@vps:/home/ubuntu/combo/ml/models/

# Sur le VPS
sudo systemctl enable combo-ai.service
sudo systemctl start combo-ai.service
```

---

## Ce qui n'est PAS dans ce scope

- Interface de sélection du niveau dans l'UI (à faire dans une itération suivante)
- Entraînement sur le VPS (trop lent sans GPU — entraînement en local, déploiement des modèles)
- Adaptation en temps réel au joueur humain
- Stats spécifiques au bot ML dans la DB
