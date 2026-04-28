export type Suit = '♥' | '♦' | '♣' | '♠';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  rank: Rank;
  suit: Suit;
}

export interface AuthUser {
  id: string;
  pseudo: string;
  isAdmin?: boolean;
}

export interface PublicPlayer {
  id: string;
  pseudo: string;
  isHost: boolean;
  isBot: boolean;
  ready: boolean;
  connected: boolean;
  handCount: number;
  holes: number[];
  totalScore: number;
  isComboCaller?: boolean;
  isCurrentTurn?: boolean;
}

export type RoomPhase =
  | 'waiting'        // Lobby — players ready up
  | 'memorize'       // Initial 6s peek at cards 1 & 2
  | 'turn'           // Active turn (draw → swap/discard)
  | 'snap-window'    // 3s after a discard, anyone can snap
  | 'power'          // Special card power resolution
  | 'combo-final'    // After someone yelled Combo, others get one last turn
  | 'round-end'      // Reveal & score
  | 'game-end';      // Final ranking

export interface RoomConfig {
  maxPlayers: number;
  rounds: number;
  isPrivate: boolean;
  isSolo: boolean;
}

export interface RoundResult {
  playerId: string;
  pseudo: string;
  cards: Card[];
  score: number;        // this round's score
  totalScore: number;   // cumulative
  isComboCaller: boolean;
  comboPenalty: number; // +10 if caller didn't have lowest
}

/* ── Wire protocol ── */

export interface RoomStatePayload {
  code: string;
  config: RoomConfig;
  phase: RoomPhase;
  round: number;
  players: PublicPlayer[];
  currentTurnPlayerId: string | null;
  discardTop: Card | null;
  deckCount: number;
  comboCallerId: string | null;
}

export interface PrivateHandPayload {
  cards: (Card | null)[];   // null for cards the player doesn't currently know OR for empty holes
  holes: number[];          // indices that are empty slots (e.g., after a successful snap)
}

export interface PowerPromptPayload {
  rank: Rank;
  type: 'self-peek' | 'opponent-peek' | 'swap';
}

export interface RevealPayload {
  card: Card;
  source: 'self' | 'opponent';
  ownerId: string;
  cardIdx: number;
}
