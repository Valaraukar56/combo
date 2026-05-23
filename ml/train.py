# ml/train.py
"""
Usage :
  python train.py --level easy    # ~100k steps, ~2-5 min
  python train.py --level medium  # ~300k steps, ~10-15 min
  python train.py --level hard    # ~600k steps, ~30+ min
  python train.py --all           # entraîne les 3 niveaux séquentiellement
"""
import argparse
import os
import numpy as np
from sb3_contrib import MaskablePPO
from sb3_contrib.common.wrappers import ActionMasker
from combo_env import ComboEnv

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")

CONFIGS = {
    "easy":   {"timesteps": 100_000, "ent_coef": 0.05, "rounds": 3},
    "medium": {"timesteps": 300_000, "ent_coef": 0.01, "rounds": 3},
    "hard":   {"timesteps": 600_000, "ent_coef": 0.005, "rounds": 5},
}


def mask_fn(env: ComboEnv) -> np.ndarray:
    return env.action_masks()


def train_level(level: str):
    cfg = CONFIGS[level]
    print(f"\n=== Entraînement niveau {level} ({cfg['timesteps']:,} steps) ===")

    env = ActionMasker(ComboEnv(rounds=cfg["rounds"]), mask_fn)
    model = MaskablePPO(
        "MlpPolicy",
        env,
        verbose=1,
        ent_coef=cfg["ent_coef"],
        n_steps=2048,
        batch_size=64,
    )
    model.learn(total_timesteps=cfg["timesteps"])

    os.makedirs(MODELS_DIR, exist_ok=True)
    path = os.path.join(MODELS_DIR, f"model_{level}")
    model.save(path)
    print(f"Modèle sauvegardé : {path}.zip")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Entraîner le bot COMBO ML")
    parser.add_argument("--level", choices=["easy", "medium", "hard"])
    parser.add_argument("--all", action="store_true", help="Entraîner les 3 niveaux")
    args = parser.parse_args()

    if args.all:
        for lvl in ["easy", "medium", "hard"]:
            train_level(lvl)
    elif args.level:
        train_level(args.level)
    else:
        parser.print_help()
