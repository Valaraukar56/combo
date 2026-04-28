import { cardValue } from './cards.js';
import type { Room } from './room.js';
import type { Card } from './types.js';

/**
 * Very simple bot AI for Solo vs IA. Each bot has perfect memory of its own
 * cards (we mark them as known). Heuristics:
 *  - 25% chance to draw from the discard if its rank is < 5
 *  - 70% chance to swap if drawn card value < worst known own card
 *  - otherwise discard
 *  - 60% chance to call Combo if estimated score < 8
 */

const MEMORIZE_MIN = 5;

export interface BotMove {
  kind: 'draw-deck' | 'draw-discard' | 'swap' | 'discard' | 'combo';
  idx?: number;
}

function knownTotal(hand: Card[], known: boolean[]): number {
  let sum = 0;
  let unknown = 0;
  hand.forEach((c, i) => {
    if (known[i]) sum += cardValue(c);
    else unknown += 1;
  });
  // Estimate unknown cards at average ~6.5
  return sum + Math.round(unknown * 6.5);
}

export function decideOpening(room: Room, botId: string): BotMove {
  const idx = room.players.findIndex((p) => p.id === botId);
  if (idx < 0) return { kind: 'draw-deck' };
  const me = room.players[idx];
  // Bots always "remember" their bottom 2 cards (they cheat-remember; we make them imperfect another way).
  me.knownByOwner = me.hand.map((_, i) => i < 2 || (me.knownByOwner[i] ?? false));

  const estimate = knownTotal(me.hand, me.knownByOwner);
  if (estimate < 8 && Math.random() < 0.6) return { kind: 'combo' };

  const top = room.discard[room.discard.length - 1];
  if (top && cardValue(top) < MEMORIZE_MIN && Math.random() < 0.25) {
    return { kind: 'draw-discard' };
  }
  return { kind: 'draw-deck' };
}

export function decideAfterDraw(room: Room, botId: string, drawn: Card): BotMove {
  const idx = room.players.findIndex((p) => p.id === botId);
  if (idx < 0) return { kind: 'discard' };
  const me = room.players[idx];

  const drawnVal = cardValue(drawn);
  // Find worst known card
  let worstIdx = -1;
  let worstVal = drawnVal;
  me.hand.forEach((c, i) => {
    if (me.knownByOwner[i] && cardValue(c) > worstVal) {
      worstVal = cardValue(c);
      worstIdx = i;
    }
  });
  if (worstIdx >= 0 && Math.random() < 0.7) {
    return { kind: 'swap', idx: worstIdx };
  }
  // If high card and no known better target, swap into an unknown slot occasionally
  if (drawnVal >= 10) {
    return { kind: 'discard' };
  }
  // Mid card: 30% swap into an unknown random slot
  if (drawnVal <= 6 && Math.random() < 0.4) {
    const unknownIdxs = me.hand
      .map((_, i) => (me.knownByOwner[i] ? -1 : i))
      .filter((i) => i >= 0);
    if (unknownIdxs.length > 0) {
      return { kind: 'swap', idx: unknownIdxs[Math.floor(Math.random() * unknownIdxs.length)] };
    }
  }
  return { kind: 'discard' };
}

export function pickRandomBotName(): string {
  const names = ['Lina', 'Tom', 'Sasha', 'Marie', 'Léo', 'Camille', 'Marc'];
  return 'IA ' + names[Math.floor(Math.random() * names.length)];
}
