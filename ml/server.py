import os
import random
import numpy as np
from contextlib import asynccontextmanager
from fastapi import FastAPI
from pydantic import BaseModel

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
MODELS: dict = {}

ACTION_NAMES = [
    "draw_deck", "draw_discard", "call_combo",
    "swap_0", "swap_1", "swap_2", "swap_3", "discard",
    "snap_0", "snap_1", "snap_2", "snap_3", "pass_snap",
    "peek_own_0", "peek_own_1", "peek_own_2", "peek_own_3",
    "peek_opp_0", "peek_opp_1", "peek_opp_2", "peek_opp_3",
    "swap_opp_0", "swap_opp_1", "swap_opp_2", "swap_opp_3",
]


def load_models():
    try:
        from sb3_contrib import MaskablePPO
        for level in ("easy", "medium", "hard"):
            path = os.path.join(MODELS_DIR, f"model_{level}.zip")
            if os.path.exists(path):
                MODELS[level] = MaskablePPO.load(path)
                print(f"[combo-ai] Modèle '{level}' chargé.")
            else:
                print(f"[combo-ai] Modèle '{level}' introuvable ({path}), ignoré.")
    except Exception as e:
        print(f"[combo-ai] Erreur chargement modèles : {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_models()
    yield


app = FastAPI(lifespan=lifespan)


class GameState(BaseModel):
    hand: list[float]
    discard_top: float
    drawn_card: float
    bot_total: float
    opp_total: float
    opp_count: float
    round_num: float
    phase: float


class ActionRequest(BaseModel):
    state: GameState
    difficulty: str
    legal_actions: list[int]


class ActionResponse(BaseModel):
    action_index: int
    action_name: str


def state_to_obs(state: GameState) -> np.ndarray:
    hand = list(state.hand[:4])
    while len(hand) < 4:
        hand.append(-1.0)
    return np.array([
        *hand,
        state.discard_top,
        state.drawn_card,
        state.bot_total,
        state.opp_total,
        0.0, 0.0,
        state.opp_count,
        0.0, 0.0,
        state.round_num,
        state.phase,
    ], dtype=np.float32)


def predict_action(model, obs: np.ndarray, legal_actions: list[int]) -> int:
    mask = np.zeros(25, dtype=bool)
    for i in legal_actions:
        if 0 <= i < 25:
            mask[i] = True
    action, _ = model.predict(obs, action_masks=mask, deterministic=True)
    return int(action)


@app.get("/health")
def health():
    return {"status": "ok", "models_loaded": list(MODELS.keys())}


@app.post("/action", response_model=ActionResponse)
def action(req: ActionRequest):
    legal = req.legal_actions if req.legal_actions else [0]

    model = MODELS.get(req.difficulty)
    if model is None:
        idx = random.choice(legal)
    else:
        obs = state_to_obs(req.state)
        idx = predict_action(model, obs, legal)

    # Safety: ensure returned action is legal
    if idx not in legal:
        idx = legal[0]

    return ActionResponse(action_index=idx, action_name=ACTION_NAMES[idx])
