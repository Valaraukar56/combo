import type { Card, Rank, Suit } from './types.js';

const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];

export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

/** Fisher–Yates shuffle, in-place. Returns the same array. */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** A=0, 2-10 face value, J=11, Q=12, K=13 */
export function cardValue(c: Card): number {
  switch (c.rank) {
    case 'A':
      return 0;
    case 'J':
      return 11;
    case 'Q':
      return 12;
    case 'K':
      return 13;
    default:
      return Number(c.rank);
  }
}

export function handScore(cards: Card[]): number {
  return cards.reduce((s, c) => s + cardValue(c), 0);
}

/** Red heads (J/Q/K of ♥/♦) trigger a power when discarded directly from a draw. */
export function powerOf(c: Card): 'self-peek' | 'opponent-peek' | 'swap' | null {
  const isRed = c.suit === '♥' || c.suit === '♦';
  if (!isRed) return null;
  if (c.rank === 'J') return 'self-peek';
  if (c.rank === 'Q') return 'opponent-peek';
  if (c.rank === 'K') return 'swap';
  return null;
}
