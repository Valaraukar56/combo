# ml/combo_env.py
import gymnasium as gym
import numpy as np
from gymnasium import spaces
from cards import card_value, is_red_head, power_type, shuffled_deck

PHASE_TURN_START = 0
PHASE_AFTER_DRAW = 1
PHASE_SNAP = 2
PHASE_POWER = 3

N_ACTIONS = 25
N_OBS = 15


class ComboEnv(gym.Env):
    """Environnement COMBO : bot (agent PPO) vs 1 adversaire heuristique."""

    metadata = {"render_modes": []}

    def __init__(self, rounds: int = 3):
        super().__init__()
        self.rounds = rounds
        self.observation_space = spaces.Box(
            low=-1.0, high=200.0, shape=(N_OBS,), dtype=np.float32
        )
        self.action_space = spaces.Discrete(N_ACTIONS)

        self.bot_hand: list = []
        self.opp_hand: list = []
        self.bot_known: list = []
        self.deck: list = []
        self.discard: list = []
        self.drawn_card = None
        self.drawn_from_discard: bool = False
        self.phase: int = PHASE_TURN_START
        self.bot_total: int = 0
        self.opp_total: int = 0
        self.round_num: int = 1
        self._pending_power: str | None = None
        self._combo_called: bool = False
        self._combo_by_bot: bool = False

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        self._init_round()
        self.bot_total = 0
        self.opp_total = 0
        self.round_num = 1
        return self._obs(), {}

    def step(self, action: int):
        reward = 0.0
        terminated = False

        if self.phase == PHASE_TURN_START:
            reward, terminated = self._handle_turn_start(action)
        elif self.phase == PHASE_AFTER_DRAW:
            reward, terminated = self._handle_after_draw(action)
        elif self.phase == PHASE_SNAP:
            reward, terminated = self._handle_snap(action)
        elif self.phase == PHASE_POWER:
            reward, terminated = self._handle_power(action)

        return self._obs(), float(reward), terminated, False, {}

    def action_masks(self) -> np.ndarray:
        mask = np.zeros(N_ACTIONS, dtype=bool)
        if self.phase == PHASE_TURN_START:
            mask[0] = bool(self.deck)
            mask[1] = len(self.discard) > 0
            if self._estimate_bot_score() < 8:
                mask[2] = True
            if not any(mask):
                mask[0] = True
        elif self.phase == PHASE_AFTER_DRAW:
            for i in range(4):
                mask[3 + i] = True
            if not self.drawn_from_discard:
                mask[7] = True
            if not any(mask):
                mask[7] = True
        elif self.phase == PHASE_SNAP:
            if self.discard:
                top_rank = self.discard[-1][0]
                for i in range(min(4, len(self.bot_hand))):
                    card = self.bot_hand[i]
                    if card is not None and card[0] == top_rank:
                        mask[8 + i] = True
            mask[12] = True
        elif self.phase == PHASE_POWER:
            p = self._pending_power
            if p == 'self-peek':
                for i in range(min(4, len(self.bot_hand))):
                    if self.bot_hand[i] is not None:
                        mask[13 + i] = True
            elif p == 'opp-peek':
                for i in range(min(4, len(self.opp_hand))):
                    if self.opp_hand[i] is not None:
                        mask[17 + i] = True
            elif p == 'swap':
                for i in range(min(4, len(self.opp_hand))):
                    if self.opp_hand[i] is not None:
                        mask[21 + i] = True
            if not any(mask):
                mask[12] = True
        return mask

    def _handle_turn_start(self, action: int) -> tuple[float, bool]:
        # If deck is exhausted and there's nothing meaningful left, end the round.
        if not self.deck and len(self.discard) <= 1:
            return self._end_round()

        if action == 0:  # draw_deck
            if self.deck:
                self.drawn_card = self.deck.pop()
            else:
                # No deck — force round end rather than fabricate cards.
                return self._end_round()
            self.drawn_from_discard = False
            self.phase = PHASE_AFTER_DRAW
            return 0.0, False

        if action == 1:  # draw_discard
            if self.discard:
                self.drawn_card = self.discard.pop()
            else:
                self.drawn_card = (0, 'S')
            self.drawn_from_discard = True
            self.phase = PHASE_AFTER_DRAW
            return 0.0, False

        if action == 2:  # call_combo
            self._combo_called = True
            self._combo_by_bot = True
            self._play_opponent_full_turn()
            return self._end_round()

        return 0.0, False

    def _handle_after_draw(self, action: int) -> tuple[float, bool]:
        if 3 <= action <= 6:  # swap_slot_i
            slot = action - 3
            if slot < len(self.bot_hand):
                old_card = self.bot_hand[slot]
                self.bot_hand[slot] = self.drawn_card
                self.bot_known[slot] = True
                if old_card is not None:
                    self.discard.append(old_card)
            self.drawn_card = None
            self.drawn_from_discard = False
            self.phase = PHASE_TURN_START
            return self._play_opponent_full_turn_with_snap()

        if action == 7:  # discard
            card = self.drawn_card
            self.discard.append(card)
            self.drawn_card = None
            self.drawn_from_discard = False
            if is_red_head(card[0], card[1]):
                self._pending_power = power_type(card[0])
                self.phase = PHASE_POWER
                return 0.0, False
            self.phase = PHASE_TURN_START
            return self._play_opponent_full_turn_with_snap()

        return 0.0, False

    def _handle_snap(self, action: int) -> tuple[float, bool]:
        reward = 0.0
        if 8 <= action <= 11:
            slot = action - 8
            if slot < len(self.bot_hand):
                card = self.bot_hand[slot]
                if card is not None and self.discard and card[0] == self.discard[-1][0]:
                    self.bot_hand[slot] = None
                    self.bot_known[slot] = False
                    reward += 0.3
                    if all(c is None for c in self.bot_hand):
                        reward += 2.0
                        r, terminated = self._end_round()
                        self.phase = PHASE_TURN_START
                        return reward + r, terminated
                else:
                    # Failed snap — penalty card
                    if self.deck:
                        self.bot_hand.append(self.deck.pop())
                        self.bot_known.append(False)
                    reward -= 0.2
        # pass_snap (12) or after snap
        self.phase = PHASE_TURN_START
        return reward, False

    def _handle_power(self, action: int) -> tuple[float, bool]:
        p = self._pending_power
        if p == 'self-peek' and 13 <= action <= 16:
            slot = action - 13
            if slot < len(self.bot_hand) and self.bot_hand[slot] is not None:
                self.bot_known[slot] = True
        elif p == 'opp-peek' and 17 <= action <= 20:
            pass  # simplified: no observable effect
        elif p == 'swap' and 21 <= action <= 24:
            opp_slot = action - 21
            own_slot = self._bot_worst_slot()
            if (own_slot is not None
                    and opp_slot < len(self.opp_hand)
                    and self.opp_hand[opp_slot] is not None):
                self.bot_hand[own_slot], self.opp_hand[opp_slot] = (
                    self.opp_hand[opp_slot],
                    self.bot_hand[own_slot],
                )
                self.bot_known[own_slot] = False

        self._pending_power = None
        self.phase = PHASE_TURN_START
        return self._play_opponent_full_turn_with_snap()

    def _play_opponent_full_turn_with_snap(self) -> tuple[float, bool]:
        """Play opponent's turn then move to snap phase.
        If opponent called combo (or deck exhausted), end the round directly.
        Returns (extra_reward, terminated) so callers can propagate termination.
        """
        self._play_opponent_full_turn()
        if self._combo_called:
            return self._end_round()
        self.phase = PHASE_SNAP
        return 0.0, False

    def _play_opponent_full_turn(self):
        if not self.deck:
            # Deck exhausted — force a combo call to ensure progress.
            if not self._combo_called:
                self._combo_called = True
                self._combo_by_bot = False
            return
        card = self.deck.pop()
        card_val = card_value(card[0])

        valid = [i for i in range(len(self.opp_hand)) if self.opp_hand[i] is not None]
        if valid:
            avg = sum(card_value(self.opp_hand[i][0]) for i in valid) / len(valid)
        else:
            avg = 6.5

        if card_val < avg and valid:
            worst = max(valid, key=lambda i: card_value(self.opp_hand[i][0]))
            old = self.opp_hand[worst]
            self.opp_hand[worst] = card
            if old is not None:
                self.discard.append(old)
        else:
            self.discard.append(card)

        # Opponent combo check (score < 5)
        opp_score = sum(card_value(c[0]) for c in self.opp_hand if c is not None)
        if opp_score < 5 and not self._combo_called:
            self._combo_called = True
            self._combo_by_bot = False

    def _end_round(self) -> tuple[float, bool]:
        bot_score = sum(card_value(c[0]) for c in self.bot_hand if c is not None)
        opp_score = sum(card_value(c[0]) for c in self.opp_hand if c is not None)

        if self._combo_called:
            if self._combo_by_bot and bot_score >= opp_score:
                bot_score += 10
            elif not self._combo_by_bot and opp_score >= bot_score:
                opp_score += 10

        reward = 0.0
        if bot_score < opp_score:
            reward += 1.0
        elif bot_score > opp_score:
            reward -= 0.5
        reward += (opp_score - bot_score) / 50.0

        self.bot_total += bot_score
        self.opp_total += opp_score
        self._combo_called = False
        self._combo_by_bot = False

        if self.round_num >= self.rounds:
            if self.bot_total < self.opp_total:
                reward += 2.0
            elif self.bot_total > self.opp_total:
                reward -= 1.0
            return reward, True

        self.round_num += 1
        self._init_round()
        return reward, False

    def _init_round(self):
        deck = shuffled_deck()
        self.bot_hand = [deck.pop() for _ in range(4)]
        self.opp_hand = [deck.pop() for _ in range(4)]
        self.deck = deck
        self.discard = [self.deck.pop()]
        self.bot_known = [False, False, True, True]
        self.drawn_card = None
        self.drawn_from_discard = False
        self.phase = PHASE_TURN_START
        self._pending_power = None

    def _obs(self) -> np.ndarray:
        hand_vals = []
        for i in range(4):
            if i >= len(self.bot_hand) or self.bot_hand[i] is None:
                hand_vals.append(-1.0)
            elif i < len(self.bot_known) and self.bot_known[i]:
                hand_vals.append(float(card_value(self.bot_hand[i][0])))
            else:
                hand_vals.append(-1.0)

        discard_top = float(card_value(self.discard[-1][0])) if self.discard else 0.0
        drawn = float(card_value(self.drawn_card[0])) if self.drawn_card else -1.0
        opp_count = float(sum(1 for c in self.opp_hand if c is not None))

        return np.array([
            *hand_vals,
            discard_top,
            drawn,
            float(self.bot_total),
            float(self.opp_total),
            0.0, 0.0,
            opp_count,
            0.0, 0.0,
            float(self.round_num),
            float(self.phase),
        ], dtype=np.float32)

    def _estimate_bot_score(self) -> float:
        total = 0.0
        for i, card in enumerate(self.bot_hand):
            if card is None:
                continue
            total += card_value(card[0]) if (i < len(self.bot_known) and self.bot_known[i]) else 6.5
        return total

    def _bot_worst_slot(self) -> int | None:
        worst_val, worst_slot = -1, None
        for i, card in enumerate(self.bot_hand):
            if card is not None and i < len(self.bot_known) and self.bot_known[i]:
                v = card_value(card[0])
                if v > worst_val:
                    worst_val, worst_slot = v, i
        return worst_slot
