import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import numpy as np
from combo_env import ComboEnv, PHASE_TURN_START, PHASE_AFTER_DRAW, PHASE_SNAP, PHASE_POWER

def make_env():
    return ComboEnv(rounds=3)

def test_reset_obs_shape():
    env = make_env()
    obs, info = env.reset()
    assert obs.shape == (15,)
    assert obs.dtype == np.float32

def test_reset_phase_is_turn_start():
    env = make_env()
    obs, _ = env.reset()
    assert obs[13] == 1.0  # round_num = 1
    assert obs[14] == 0.0  # phase = PHASE_TURN_START

def test_reset_hand_has_two_unknowns():
    env = make_env()
    obs, _ = env.reset()
    # slots 0 et 1 inconnus (-1), slots 2 et 3 connus (valeur >= 0)
    assert obs[0] == -1.0
    assert obs[1] == -1.0
    assert obs[2] >= 0.0
    assert obs[3] >= 0.0

def test_action_masks_turn_start():
    env = make_env()
    env.reset()
    mask = env.action_masks()
    assert mask[0] is True or mask[0] == True   # draw_deck toujours valide
    assert not mask[3]  # swap_0 pas valide en phase 0

def test_action_masks_after_draw():
    env = make_env()
    env.reset()
    env.step(0)  # draw_deck → phase 1
    mask = env.action_masks()
    assert mask[3]   # swap_0 valide
    assert mask[7]   # discard valide
    assert not mask[0]  # draw_deck plus valide

def test_step_draw_changes_phase():
    env = make_env()
    env.reset()
    obs, reward, terminated, truncated, info = env.step(0)  # draw_deck
    assert obs[14] == 1.0   # phase = PHASE_AFTER_DRAW
    assert obs[5] >= 0.0    # drawn_card non négatif

def test_full_episode_terminates():
    env = make_env()
    obs, _ = env.reset()
    terminated = False
    steps = 0
    while not terminated and steps < 500:
        mask = env.action_masks()
        legal = np.where(mask)[0]
        action = int(np.random.choice(legal))
        obs, reward, terminated, truncated, info = env.step(action)
        steps += 1
    assert terminated, f"Épisode non terminé après {steps} steps"

def test_reward_is_float():
    env = make_env()
    env.reset()
    mask = env.action_masks()
    legal = [i for i, v in enumerate(mask) if v]
    _, reward, _, _, _ = env.step(legal[0])
    assert isinstance(reward, float)

def test_snap_reduces_hand():
    env = make_env()
    env.reset()
    env.bot_hand[0] = (5, 'C')
    env.bot_known[0] = True
    env.discard = [(5, 'H')]
    env.phase = PHASE_SNAP
    obs, reward, _, _, _ = env.step(8)  # snap_0
    assert env.bot_hand[0] is None
    assert reward >= 0.3
