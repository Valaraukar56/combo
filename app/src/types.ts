export type Suit = '♥' | '♦' | '♣' | '♠';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  rank: Rank | string;
  suit: Suit | string;
  known?: boolean;
}

export interface User {
  id: string;
  pseudo: string;
}

export interface Room {
  code: string;
  maxPlayers: number;
  rounds: number;
  round: number;
  opponents: string[];
  isPrivate?: boolean;
  isSolo?: boolean;
  players?: WaitingPlayer[];
}

export interface WaitingPlayer {
  id: string;
  name: string;
  isHost: boolean;
  ready: boolean;
}

export interface SnapResult {
  success: boolean;
  target: { rank: string; suit: string };
  card: { rank: string; suit: string };
}

export type Page =
  | 'home' | 'login' | 'register'
  | 'lobby' | 'waitingroom'
  | 'memorize' | 'table' | 'power' | 'snap'
  | 'endround' | 'endgame'
  | 'rules' | 'leaderboard' | 'history' | 'profile' | 'settings';

export type ToastVariant = 'default' | 'success' | 'danger';
export type CardSize = 'xs' | 'sm' | 'md' | 'lg';
export type CardHighlight = 'memorize' | 'memorized' | 'penalty' | 'selected' | null;
