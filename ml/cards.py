import random
from typing import Optional

# suit: 'H'=Coeurs, 'D'=Carreaux, 'C'=Trèfles, 'S'=Piques
# rank: 0=As, 1=2, 2=3, ..., 9=10, 10=Valet, 11=Dame, 12=Roi
SUITS = ['H', 'D', 'C', 'S']
RANKS = list(range(13))


def card_value(rank: int) -> int:
    """Points de la carte (As=0, 2-10=valeur faciale, V=11, D=12, R=13)."""
    if rank == 0:
        return 0
    return rank + 1


def is_red_head(rank: int, suit: str) -> bool:
    """Vrai si la carte est une tête rouge (V/D/R de Coeurs ou Carreaux)."""
    return rank >= 10 and suit in ('H', 'D')


def power_type(rank: int) -> Optional[str]:
    """Retourne le type de pouvoir d'une tête rouge, ou None."""
    if rank == 10:
        return 'self-peek'
    if rank == 11:
        return 'opp-peek'
    if rank == 12:
        return 'swap'
    return None


def make_deck() -> list[tuple[int, str]]:
    return [(rank, suit) for suit in SUITS for rank in RANKS]


def shuffled_deck() -> list[tuple[int, str]]:
    deck = make_deck()
    random.shuffle(deck)
    return deck
