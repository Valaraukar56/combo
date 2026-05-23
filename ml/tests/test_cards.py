import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from cards import card_value, is_red_head, power_type, make_deck, shuffled_deck

def test_card_values():
    assert card_value(0) == 0   # As = 0
    assert card_value(1) == 2   # 2 = 2
    assert card_value(9) == 10  # 10 = 10
    assert card_value(10) == 11 # Valet = 11
    assert card_value(11) == 12 # Dame = 12
    assert card_value(12) == 13 # Roi = 13

def test_red_head():
    assert is_red_head(10, 'H') is True   # V♥
    assert is_red_head(10, 'D') is True   # V♦
    assert is_red_head(10, 'C') is False  # V♣
    assert is_red_head(9, 'H') is False   # 10♥ (pas une tête)
    assert is_red_head(12, 'D') is True   # R♦

def test_power_type():
    assert power_type(10) == 'self-peek'   # Valet
    assert power_type(11) == 'opp-peek'   # Dame
    assert power_type(12) == 'swap'        # Roi
    assert power_type(5) is None

def test_deck():
    deck = make_deck()
    assert len(deck) == 52
    assert len(set(deck)) == 52  # toutes uniques

def test_shuffled_deck():
    d1 = shuffled_deck()
    d2 = shuffled_deck()
    assert len(d1) == 52
    # Très improbable que deux decks shufflés soient identiques
    assert d1 != d2
