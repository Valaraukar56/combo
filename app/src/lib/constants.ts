import type { Card } from '../types';

export const SUIT: Record<string, { color: string; name: string }> = {
  '♥': { color: 'red', name: 'hearts' },
  '♦': { color: 'red', name: 'diamonds' },
  '♣': { color: 'black', name: 'clubs' },
  '♠': { color: 'black', name: 'spades' },
};

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
export const SUITS = ['♠', '♥', '♦', '♣'] as const;

export interface PowerInfo {
  label: string;
  desc: string;
  icon: string;
  target: 'self' | 'opponent' | 'swap';
}

/* Pouvoirs spéciaux — UNIQUEMENT les têtes rouges (♦/♥) */
export const POWER_INFO: Record<string, PowerInfo> = {
  J: { label: 'Valet rouge', desc: "Regardez secrètement l'une de vos cartes.", icon: '👁', target: 'self' },
  Q: { label: 'Dame rouge', desc: "Regardez secrètement la carte d'un adversaire.", icon: '⌖', target: 'opponent' },
  K: { label: 'Roi rouge', desc: "Échangez l'une de vos cartes avec celle d'un adversaire (sans regarder).", icon: '⇄', target: 'swap' },
};

export function genCode(): string {
  const letters = 'ABCDEFGHJKLMNPRSTUWXYZ';
  return Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
}

export interface RoundResult {
  name: string;
  cards: Card[];
  score: number;
  totalScore: number;
  isComboCaller?: boolean;
  deltaPenalty?: number;
  comboBonus?: number;
}

export function mockResults(myName: string): RoundResult[] {
  return [
    { name: 'Marie', cards: [{ rank: '2', suit: '♠' }, { rank: '3', suit: '♥' }, { rank: 'A', suit: '♦' }, { rank: '4', suit: '♣' }], score: 10, totalScore: 22 },
    { name: myName, cards: [{ rank: '4', suit: '♥' }, { rank: '9', suit: '♣' }, { rank: '5', suit: '♦' }, { rank: '2', suit: '♣' }], score: 20, totalScore: 28, isComboCaller: true, deltaPenalty: 10 },
    { name: 'Tom', cards: [{ rank: '7', suit: '♠' }, { rank: '6', suit: '♥' }, { rank: '3', suit: '♦' }, { rank: '2', suit: '♣' }], score: 18, totalScore: 41 },
    { name: 'Sasha', cards: [{ rank: 'K', suit: '♣' }, { rank: '8', suit: '♥' }, { rank: '5', suit: '♠' }, { rank: '7', suit: '♦' }], score: 30, totalScore: 56 },
  ];
}

export interface FinalScore {
  name: string;
  total: number;
  combos: number;
}

export function mockFinal(myName: string): FinalScore[] {
  return [
    { name: myName, total: 62, combos: 2 },
    { name: 'Marie', total: 78, combos: 1 },
    { name: 'Tom', total: 91, combos: 1 },
    { name: 'Sasha', total: 110, combos: 0 },
  ];
}
