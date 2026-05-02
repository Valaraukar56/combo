import { randomUUID } from 'node:crypto';
import { buildDeck, handScore, powerOf, shuffle } from './cards.js';
import type {
  Card,
  PrivateHandPayload,
  PublicPlayer,
  RoomConfig,
  RoomPhase,
  RoomStatePayload,
  RoundResult,
} from './types.js';

interface Player {
  id: string;
  pseudo: string;
  isHost: boolean;
  isBot: boolean;
  ready: boolean;
  connected: boolean;
  hand: (Card | null)[];         // server-authoritative; null = empty hole left by a successful snap
  knownByOwner: boolean[];       // for each card, whether the owner currently knows it (memorize phase or peek powers)
  totalScore: number;
  isComboCaller: boolean;
  combosCalled: number;          // lifetime in this game
  combosWon: number;             // lifetime in this game
  snapsFailed: number;           // lifetime in this game
}

const SNAP_WINDOW_MS = 3000;
const MEMORIZE_MS = 6000;
const POWER_TIMEOUT_MS = 20000;
const RECONNECT_GRACE_MS = 30000;

export class Room {
  readonly code: string;
  readonly config: RoomConfig;
  players: Player[] = [];
  phase: RoomPhase = 'waiting';
  round = 0;
  deck: Card[] = [];
  discard: Card[] = [];
  drawnCard: Card | null = null;          // card currently in active player's hand mid-turn
  drawnFromDiscard = false;                // if true, can't be discarded again
  currentTurnIdx = 0;
  comboCallerId: string | null = null;
  // After a Combo call, this many players still need to take their final turn.
  finalTurnsRemaining = 0;
  pendingPower: { rank: 'J' | 'Q' | 'K'; type: ReturnType<typeof powerOf> } | null = null;
  snapTimeout: NodeJS.Timeout | null = null;
  memorizeTimeout: NodeJS.Timeout | null = null;
  powerTimeout: NodeJS.Timeout | null = null;
  disconnectTimers = new Map<string, NodeJS.Timeout>();
  lastResults: RoundResult[] = [];

  constructor(code: string, config: RoomConfig) {
    this.code = code;
    this.config = config;
  }

  /* ── Lifecycle ── */

  addPlayer(p: { id: string; pseudo: string; isHost?: boolean; isBot?: boolean }): Player | null {
    if (this.phase !== 'waiting') return null;
    if (this.players.length >= this.config.maxPlayers) return null;
    if (this.players.some((x) => x.id === p.id)) return this.players.find((x) => x.id === p.id) ?? null;
    const player: Player = {
      id: p.id,
      pseudo: p.pseudo,
      isHost: !!p.isHost,
      isBot: !!p.isBot,
      ready: !!p.isBot,
      connected: true,
      hand: [],
      knownByOwner: [],
      totalScore: 0,
      isComboCaller: false,
      combosCalled: 0,
      combosWon: 0,
      snapsFailed: 0,
    };
    this.players.push(player);
    return player;
  }

  removePlayer(id: string): boolean {
    const idx = this.players.findIndex((p) => p.id === id);
    if (idx < 0) return false;
    this.players.splice(idx, 1);
    if (this.players.length > 0 && !this.players.some((p) => p.isHost)) {
      this.players[0].isHost = true;
    }
    if (this.currentTurnIdx >= this.players.length) {
      this.currentTurnIdx = 0;
    }
    return true;
  }

  setReady(id: string, ready: boolean): boolean {
    const p = this.players.find((x) => x.id === id);
    if (!p || this.phase !== 'waiting') return false;
    p.ready = ready;
    return true;
  }

  markDisconnect(id: string, onTimeout: () => void): void {
    const p = this.players.find((x) => x.id === id);
    if (!p) return;
    p.connected = false;
    if (this.phase === 'waiting') {
      this.removePlayer(id);
      onTimeout();
      return;
    }
    const t = setTimeout(() => {
      this.disconnectTimers.delete(id);
      // If still disconnected, drop out (just skip their turns from now on)
      if (!this.connectedPlayer(id)) {
        // We mark them as "ghost" but keep them in the players list for scoring
        onTimeout();
      }
    }, RECONNECT_GRACE_MS);
    this.disconnectTimers.set(id, t);
  }

  markReconnect(id: string): void {
    const t = this.disconnectTimers.get(id);
    if (t) {
      clearTimeout(t);
      this.disconnectTimers.delete(id);
    }
    const p = this.players.find((x) => x.id === id);
    if (p) p.connected = true;
  }

  private connectedPlayer(id: string): boolean {
    const p = this.players.find((x) => x.id === id);
    return !!p?.connected;
  }

  canStart(): boolean {
    return (
      this.phase === 'waiting' &&
      this.players.length >= 2 &&
      this.players.every((p) => p.ready)
    );
  }

  startRound(onMemorizeEnd: () => void): void {
    this.round += 1;
    this.deck = shuffle(buildDeck());
    this.discard = [];
    this.drawnCard = null;
    this.drawnFromDiscard = false;
    this.comboCallerId = null;
    this.finalTurnsRemaining = 0;
    this.pendingPower = null;
    this.players.forEach((p) => {
      p.hand = [this.deck.pop()!, this.deck.pop()!, this.deck.pop()!, this.deck.pop()!];
      // Player knows their bottom 2 cards (indices 0,1) during memorize.
      p.knownByOwner = [true, true, false, false];
      p.isComboCaller = false;
    });
    // Open the discard with one revealed card.
    this.discard.push(this.deck.pop()!);
    this.phase = 'memorize';
    this.currentTurnIdx = 0;
    this.clearTimers();
    this.memorizeTimeout = setTimeout(() => {
      // Hide the bottom 2 cards from the owner — they now play from memory.
      this.players.forEach((p) => {
        p.knownByOwner = p.knownByOwner.map(() => false);
      });
      this.phase = 'turn';
      onMemorizeEnd();
    }, MEMORIZE_MS);
  }

  private clearTimers(): void {
    if (this.memorizeTimeout) clearTimeout(this.memorizeTimeout);
    if (this.snapTimeout) clearTimeout(this.snapTimeout);
    if (this.powerTimeout) clearTimeout(this.powerTimeout);
    this.memorizeTimeout = null;
    this.snapTimeout = null;
    this.powerTimeout = null;
  }

  /** Public alias for clearTimers — used by socket.ts to interrupt timers on a
   *  forced end (perfect snap, host disconnect, etc.). */
  cancelAllTimers(): void {
    this.clearTimers();
  }

  destroy(): void {
    this.clearTimers();
    this.disconnectTimers.forEach((t) => clearTimeout(t));
    this.disconnectTimers.clear();
  }

  /* ── Turn actions ── */

  isCurrentTurn(playerId: string): boolean {
    return this.players[this.currentTurnIdx]?.id === playerId;
  }

  draw(playerId: string, source: 'deck' | 'discard'): { ok: boolean; card?: Card; error?: string } {
    if (this.phase !== 'turn') return { ok: false, error: 'wrong_phase' };
    if (!this.isCurrentTurn(playerId)) return { ok: false, error: 'not_your_turn' };
    if (this.drawnCard) return { ok: false, error: 'already_drawn' };
    if (source === 'deck') {
      this.refillDeckIfNeeded();
      const c = this.deck.pop();
      if (!c) return { ok: false, error: 'empty_deck' };
      this.drawnCard = c;
      this.drawnFromDiscard = false;
    } else {
      const top = this.discard.pop();
      if (!top) return { ok: false, error: 'empty_discard' };
      this.drawnCard = top;
      this.drawnFromDiscard = true;
    }
    return { ok: true, card: this.drawnCard };
  }

  swap(playerId: string, idx: number): { ok: boolean; replaced?: Card; error?: string } {
    if (this.phase !== 'turn') return { ok: false, error: 'wrong_phase' };
    if (!this.isCurrentTurn(playerId)) return { ok: false, error: 'not_your_turn' };
    if (!this.drawnCard) return { ok: false, error: 'no_drawn_card' };
    const p = this.players[this.currentTurnIdx];
    if (idx < 0 || idx >= p.hand.length) return { ok: false, error: 'invalid_idx' };
    const replaced = p.hand[idx];
    p.hand[idx] = this.drawnCard;
    p.knownByOwner[idx] = false;
    if (replaced) this.discard.push(replaced);
    this.drawnCard = null;
    return { ok: true, replaced: replaced ?? undefined };
  }

  /** Direct discard of the drawn card. Returns the discarded card and whether a power should activate. */
  discardDrawn(
    playerId: string
  ): { ok: boolean; card?: Card; powerType?: ReturnType<typeof powerOf>; error?: string } {
    if (this.phase !== 'turn') return { ok: false, error: 'wrong_phase' };
    if (!this.isCurrentTurn(playerId)) return { ok: false, error: 'not_your_turn' };
    if (!this.drawnCard) return { ok: false, error: 'no_drawn_card' };
    if (this.drawnFromDiscard) return { ok: false, error: 'cant_discard_from_discard' };
    const c = this.drawnCard;
    this.discard.push(c);
    this.drawnCard = null;
    const power = powerOf(c);
    if (power && (c.rank === 'J' || c.rank === 'Q' || c.rank === 'K')) {
      this.pendingPower = { rank: c.rank, type: power };
      this.phase = 'power';
    }
    return { ok: true, card: c, powerType: power };
  }

  /** Pass the turn to the next connected player, ending the round if a Combo final loop is over. */
  endTurn(): { roundOver: boolean } {
    this.drawnCard = null;
    this.drawnFromDiscard = false;
    this.pendingPower = null;
    if (this.comboCallerId) {
      // Only count down on OTHER players' turns ending — the caller's turn
      // ends immediately after the combo call without playing, and shouldn't
      // consume a final-loop slot.
      const justEndedId = this.players[this.currentTurnIdx]?.id;
      if (justEndedId !== this.comboCallerId) {
        this.finalTurnsRemaining -= 1;
      }
      if (this.finalTurnsRemaining <= 0) {
        return { roundOver: true };
      }
    }
    // Find next connected player.
    for (let i = 0; i < this.players.length; i++) {
      this.currentTurnIdx = (this.currentTurnIdx + 1) % this.players.length;
      if (this.players[this.currentTurnIdx].connected) break;
    }
    this.phase = 'turn';
    return { roundOver: false };
  }

  /* ── Power resolution ── */

  resolveSelfPeek(playerId: string, idx: number): { ok: boolean; card?: Card; error?: string } {
    if (this.phase !== 'power' || this.pendingPower?.type !== 'self-peek') {
      return { ok: false, error: 'wrong_phase' };
    }
    if (!this.isCurrentTurn(playerId)) return { ok: false, error: 'not_your_turn' };
    const p = this.players[this.currentTurnIdx];
    if (idx < 0 || idx >= p.hand.length) return { ok: false, error: 'invalid_idx' };
    const c = p.hand[idx];
    if (!c) return { ok: false, error: 'empty_slot' };
    // The card is revealed only via game:reveal during the peek window — it
    // is NOT marked as known so the player has to memorize it themselves.
    return { ok: true, card: c };
  }

  resolveOpponentPeek(
    playerId: string,
    targetId: string,
    idx: number
  ): { ok: boolean; card?: Card; error?: string } {
    if (this.phase !== 'power' || this.pendingPower?.type !== 'opponent-peek') {
      return { ok: false, error: 'wrong_phase' };
    }
    if (!this.isCurrentTurn(playerId)) return { ok: false, error: 'not_your_turn' };
    const target = this.players.find((x) => x.id === targetId);
    if (!target || target.id === playerId) return { ok: false, error: 'invalid_target' };
    if (idx < 0 || idx >= target.hand.length) return { ok: false, error: 'invalid_idx' };
    const c = target.hand[idx];
    if (!c) return { ok: false, error: 'empty_slot' };
    return { ok: true, card: c };
  }

  resolveSwap(
    playerId: string,
    selfIdx: number,
    targetId: string,
    targetIdx: number
  ): { ok: boolean; error?: string } {
    if (this.phase !== 'power' || this.pendingPower?.type !== 'swap') {
      return { ok: false, error: 'wrong_phase' };
    }
    if (!this.isCurrentTurn(playerId)) return { ok: false, error: 'not_your_turn' };
    const p = this.players[this.currentTurnIdx];
    const target = this.players.find((x) => x.id === targetId);
    if (!target || target.id === playerId) return { ok: false, error: 'invalid_target' };
    if (selfIdx < 0 || selfIdx >= p.hand.length) return { ok: false, error: 'invalid_self_idx' };
    if (targetIdx < 0 || targetIdx >= target.hand.length) {
      return { ok: false, error: 'invalid_target_idx' };
    }
    if (!p.hand[selfIdx] || !target.hand[targetIdx]) return { ok: false, error: 'empty_slot' };
    const a = p.hand[selfIdx];
    p.hand[selfIdx] = target.hand[targetIdx];
    target.hand[targetIdx] = a;
    p.knownByOwner[selfIdx] = false;
    target.knownByOwner[targetIdx] = false;
    return { ok: true };
  }

  /* ── Snap ── */

  openSnapWindow(onClose: () => void): void {
    if (this.snapTimeout) clearTimeout(this.snapTimeout);
    this.phase = 'snap-window';
    this.snapTimeout = setTimeout(() => {
      this.snapTimeout = null;
      onClose();
    }, SNAP_WINDOW_MS);
  }

  attemptSnap(
    playerId: string,
    cardIdx: number
  ): {
    ok: boolean;
    success: boolean;
    card?: Card;
    handCleared?: boolean;
    error?: string;
  } {
    const snappable: RoomPhase[] = ['turn', 'snap-window', 'power', 'combo-final'];
    if (!snappable.includes(this.phase)) {
      return { ok: false, success: false, error: 'wrong_phase' };
    }
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return { ok: false, success: false, error: 'unknown_player' };
    if (cardIdx < 0 || cardIdx >= player.hand.length) {
      return { ok: false, success: false, error: 'invalid_idx' };
    }
    const candidate = player.hand[cardIdx];
    if (!candidate) return { ok: false, success: false, error: 'empty_slot' };
    const top = this.discard[this.discard.length - 1];
    if (!top) return { ok: false, success: false, error: 'no_discard' };
    if (candidate.rank === top.rank) {
      // Success: leave a hole at the snapped slot (preserve original positions)
      player.hand[cardIdx] = null;
      player.knownByOwner[cardIdx] = false;
      this.discard.push(candidate);
      // Perfect snap: every slot is now empty. Caller (socket layer) will end
      // the game immediately.
      const handCleared = player.hand.every((c) => c === null);
      return { ok: true, success: true, card: candidate, handCleared };
    }
    // Failure: penalty card from deck added at the end (unknown to them)
    this.refillDeckIfNeeded();
    const penalty = this.deck.pop();
    if (penalty) {
      player.hand.push(penalty);
      player.knownByOwner.push(false);
    }
    player.snapsFailed += 1;
    return { ok: true, success: false, card: candidate };
  }

  private refillDeckIfNeeded(): void {
    if (this.deck.length > 0) return;
    if (this.discard.length <= 1) return;
    const top = this.discard.pop()!;
    this.deck = shuffle(this.discard);
    this.discard = [top];
  }

  /* ── Combo ── */

  callCombo(playerId: string): { ok: boolean; error?: string } {
    if (this.phase !== 'turn') return { ok: false, error: 'wrong_phase' };
    if (!this.isCurrentTurn(playerId)) return { ok: false, error: 'not_your_turn' };
    if (this.comboCallerId) return { ok: false, error: 'already_called' };
    this.comboCallerId = playerId;
    const p = this.players[this.currentTurnIdx];
    p.isComboCaller = true;
    p.combosCalled += 1;
    // Each other connected player gets exactly one more turn.
    this.finalTurnsRemaining = this.players.filter((x) => x.connected && x.id !== playerId).length;
    this.phase = 'combo-final';
    return { ok: true };
  }

  /* ── Scoring ── */

  endRound(): RoundResult[] {
    this.phase = 'round-end';
    const callerId = this.comboCallerId;
    const scores = this.players.map((p) => ({ p, score: handScore(p.hand.filter((c): c is Card => !!c)) }));
    const lowest = Math.min(...scores.map((s) => s.score));
    const callerScore = callerId ? scores.find((s) => s.p.id === callerId)?.score ?? null : null;
    const callerWasLowest = !!callerId && callerScore === lowest;

    const results: RoundResult[] = scores.map(({ p, score }) => {
      const comboPenalty = p.id === callerId && !callerWasLowest ? 10 : 0;
      const total = score + comboPenalty;
      p.totalScore += total;
      if (p.id === callerId && callerWasLowest) {
        p.combosWon += 1;
      }
      return {
        playerId: p.id,
        pseudo: p.pseudo,
        cards: p.hand.filter((c): c is Card => !!c),
        score: total,
        totalScore: p.totalScore,
        isComboCaller: p.id === callerId,
        comboPenalty,
      };
    });
    this.lastResults = results;
    return results;
  }

  /** Per-player aggregated stats for this game (used to update lifetime stats at game end). */
  perPlayerSummary(): {
    id: string;
    pseudo: string;
    isBot: boolean;
    totalScore: number;
    combosCalled: number;
    combosWon: number;
    snapsFailed: number;
  }[] {
    return this.players.map((p) => ({
      id: p.id,
      pseudo: p.pseudo,
      isBot: p.isBot,
      totalScore: p.totalScore,
      combosCalled: p.combosCalled,
      combosWon: p.combosWon,
      snapsFailed: p.snapsFailed,
    }));
  }

  isGameOver(): boolean {
    return this.round >= this.config.rounds;
  }

  finalizeGame(): RoundResult[] {
    this.phase = 'game-end';
    return [...this.players]
      .map((p) => ({
        playerId: p.id,
        pseudo: p.pseudo,
        cards: [],
        score: p.totalScore,
        totalScore: p.totalScore,
        isComboCaller: false,
        comboPenalty: 0,
      }))
      .sort((a, b) => a.totalScore - b.totalScore);
  }

  /* ── Serialization ── */

  publicState(): RoomStatePayload {
    return {
      code: this.code,
      config: this.config,
      phase: this.phase,
      round: this.round,
      players: this.players.map<PublicPlayer>((p, i) => ({
        id: p.id,
        pseudo: p.pseudo,
        isHost: p.isHost,
        isBot: p.isBot,
        ready: p.ready,
        connected: p.connected,
        handCount: p.hand.length,
        holes: p.hand.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0),
        totalScore: p.totalScore,
        isComboCaller: p.isComboCaller,
        isCurrentTurn: i === this.currentTurnIdx && (this.phase === 'turn' || this.phase === 'power' || this.phase === 'combo-final'),
      })),
      currentTurnPlayerId:
        this.players[this.currentTurnIdx]?.id ?? null,
      discardTop: this.discard[this.discard.length - 1] ?? null,
      deckCount: this.deck.length,
      comboCallerId: this.comboCallerId,
    };
  }

  /** Each player's view of their own hand (only knownByOwner cards revealed). */
  privateHand(playerId: string): PrivateHandPayload {
    const p = this.players.find((x) => x.id === playerId);
    if (!p) return { cards: [], holes: [] };
    return {
      cards: p.hand.map((c, i) => (c && p.knownByOwner[i] ? c : null)),
      holes: p.hand.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0),
    };
  }
}

export function genRoomCode(): string {
  const letters = 'ABCDEFGHJKLMNPRSTUWXYZ';
  return Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
}

export function newPlayerId(): string {
  return 'p_' + randomUUID();
}
