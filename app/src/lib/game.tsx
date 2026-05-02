import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useToast } from '../components/Toast';
import { useAuth } from './auth';
import { clearLastRoomCode, saveLastRoomCode } from './roomCode';
import { ensureConnected } from './socket';
import type { Card } from '../types';

/* ── Wire types (mirror server payloads) ── */

export type RoomPhase =
  | 'waiting'
  | 'memorize'
  | 'turn'
  | 'snap-window'
  | 'power'
  | 'combo-final'
  | 'round-end'
  | 'game-end';

export interface RoomConfig {
  maxPlayers: number;
  rounds: number;
  isPrivate: boolean;
  isSolo: boolean;
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

export interface RoundResult {
  playerId: string;
  pseudo: string;
  cards: Card[];
  score: number;
  totalScore: number;
  isComboCaller: boolean;
  comboPenalty: number;
}

export interface GameEvent {
  type: string;
  actorId: string;
  card?: Card;
  powerType?: 'self-peek' | 'opponent-peek' | 'swap' | null;
  idx?: number;
  targetId?: string;
  selfIdx?: number;
  targetIdx?: number;
  success?: boolean;
  fromDiscard?: boolean;
}

export interface RevealEvent {
  ownerId: string;
  cardIdx: number;
  card: Card;
  source: 'self' | 'opponent';
}

export type PowerType = 'self-peek' | 'opponent-peek' | 'swap';

/**
 * One-shot announcement shown as a fullscreen overlay (similar to the COMBO
 * call) whenever an opponent uses Q♥ or K♥. The `id` lets the overlay
 * re-mount even when the same actor triggers two consecutive powers.
 */
export interface PowerAnnouncement {
  id: number;
  kind: 'peek-on-me' | 'peek-on-other' | 'swap-on-me' | 'swap-on-other';
  actorPseudo: string;
  targetPseudo?: string;
  selfSlot?: number;
  targetSlot: number;
}

interface AckResponse {
  ok: boolean;
  [k: string]: unknown;
}

interface CreateRoomCfg {
  maxPlayers: number;
  rounds: number;
  isPrivate: boolean;
  isSolo: boolean;
}

/* ── Context shape ── */

interface GameContextValue {
  connected: boolean;
  roomState: RoomStatePayload | null;
  privateHand: (Card | null)[];
  privateHoles: number[];
  drawnCard: Card | null;
  fromDiscard: boolean;
  pendingPower: { rank: string; type: PowerType } | null;
  lastReveal: RevealEvent | null;
  lastSnap: { actorId: string; success: boolean; card: Card | null } | null;
  powerAnnouncement: PowerAnnouncement | null;
  roundResults: RoundResult[] | null;
  finalResults: RoundResult[] | null;
  events: GameEvent[];

  // Actions
  createRoom: (cfg: CreateRoomCfg) => Promise<string>;
  joinRoom: (code: string) => Promise<string>;
  leaveRoom: () => Promise<void>;
  setReady: (ready: boolean) => Promise<void>;
  startGame: () => Promise<void>;
  draw: (source: 'deck' | 'discard') => Promise<void>;
  swap: (idx: number) => Promise<void>;
  discard: () => Promise<void>;
  snap: (idx: number) => Promise<boolean>;
  callCombo: () => Promise<void>;
  powerSelfPeek: (idx: number) => Promise<void>;
  powerOpponentPeek: (targetId: string, idx: number) => Promise<void>;
  powerSwap: (selfIdx: number, targetId: string, targetIdx: number) => Promise<void>;
  powerSkip: () => Promise<void>;
  triggerDevPower: (rank: 'J' | 'Q' | 'K') => Promise<void>;
  clearReveal: () => void;
  clearSnap: () => void;
  clearPowerAnnouncement: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const toast = useToast();
  const [connected, setConnected] = useState(false);
  const [roomState, setRoomState] = useState<RoomStatePayload | null>(null);
  const [privateHand, setPrivateHand] = useState<(Card | null)[]>([]);
  const [privateHoles, setPrivateHoles] = useState<number[]>([]);
  const [drawnCard, setDrawnCard] = useState<Card | null>(null);
  const [fromDiscard, setFromDiscard] = useState(false);
  const [pendingPower, setPendingPower] = useState<{ rank: string; type: PowerType } | null>(null);
  const [lastReveal, setLastReveal] = useState<RevealEvent | null>(null);
  const [lastSnap, setLastSnap] = useState<{ actorId: string; success: boolean; card: Card | null } | null>(null);
  const [powerAnnouncement, setPowerAnnouncement] = useState<PowerAnnouncement | null>(null);
  const announcementIdRef = useRef(0);
  const [roundResults, setRoundResults] = useState<RoundResult[] | null>(null);
  const [finalResults, setFinalResults] = useState<RoundResult[] | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const userIdRef = useRef<string | null>(user?.id ?? null);
  userIdRef.current = user?.id ?? null;
  // Keep an up-to-date snapshot of roomState for use inside socket callbacks,
  // which capture state at registration time and would otherwise see stale data.
  const roomStateRef = useRef<RoomStatePayload | null>(roomState);
  roomStateRef.current = roomState;
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    if (!user) return;
    const s = ensureConnected();

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    const onRoomState = (state: RoomStatePayload) => {
      setRoomState(state);
      if (state.phase !== 'power') setPendingPower(null);
      if (state.phase === 'memorize' || state.phase === 'waiting') {
        setRoundResults(null);
        setFinalResults(null);
      }
      if (state.phase !== 'turn' && state.phase !== 'combo-final') {
        setDrawnCard(null);
      }
      // Once the game truly ends, drop the saved code so the lobby doesn't
      // keep offering to rejoin a finished room.
      if (state.phase === 'game-end') clearLastRoomCode();
    };

    const onHand = (payload: { cards: (Card | null)[]; holes?: number[] }) => {
      setPrivateHand(payload.cards);
      setPrivateHoles(payload.holes ?? []);
    };

    const onDrawn = (payload: { card: Card; fromDiscard: boolean }) => {
      setDrawnCard(payload.card);
      setFromDiscard(!!payload.fromDiscard);
    };

    const onEvent = (ev: GameEvent) => {
      setEvents((prev) => [...prev.slice(-49), ev]);
      const myId = userIdRef.current;
      // Power activations come from two paths: (a) the active player discards
      // a red head directly, or (b) the active player swaps a red head out of
      // their hand into the discard. Both surface as game:event with
      // powerType set.
      if (
        (ev.type === 'discard' || ev.type === 'swap') &&
        ev.powerType &&
        ev.actorId === myId &&
        ev.card
      ) {
        setPendingPower({ rank: ev.card.rank as string, type: ev.powerType });
      }
      if (ev.type === 'snap') {
        setLastSnap({
          actorId: ev.actorId,
          success: !!ev.success,
          card: ev.card ?? null,
        });
      }
      if (ev.type === 'perfect-snap') {
        const room = roomStateRef.current;
        const t = toastRef.current;
        const actor = room?.players.find((p) => p.id === ev.actorId);
        if (ev.actorId === myId) {
          t.push('🏆 Snap parfait — vous remportez la partie !', 'success');
        } else if (actor) {
          t.push(`🏆 ${actor.pseudo} a snappé toutes ses cartes — partie terminée`, 'default');
        }
      }
      if (ev.type === 'opponent-peek-resolved' || ev.type === 'swap-resolved') {
        const room = roomStateRef.current;
        if (!room) return;
        const actor = room.players.find((p) => p.id === ev.actorId);
        const target = room.players.find((p) => p.id === ev.targetId);
        if (!actor) return;
        // The actor already sees the result through the power UI — only show
        // the big overlay to the targeted player and to bystanders.
        const nextAnnouncement = (a: PowerAnnouncement) => {
          announcementIdRef.current += 1;
          setPowerAnnouncement({ ...a, id: announcementIdRef.current });
        };
        if (ev.type === 'opponent-peek-resolved') {
          const slot = (ev.targetIdx ?? 0) + 1;
          if (ev.targetId === myId) {
            nextAnnouncement({
              id: 0,
              kind: 'peek-on-me',
              actorPseudo: actor.pseudo,
              targetSlot: slot,
            });
          } else if (ev.actorId !== myId && target) {
            nextAnnouncement({
              id: 0,
              kind: 'peek-on-other',
              actorPseudo: actor.pseudo,
              targetPseudo: target.pseudo,
              targetSlot: slot,
            });
          }
        } else if (ev.type === 'swap-resolved') {
          const selfSlot = (ev.selfIdx ?? 0) + 1;
          const targetSlot = (ev.targetIdx ?? 0) + 1;
          if (ev.targetId === myId) {
            nextAnnouncement({
              id: 0,
              kind: 'swap-on-me',
              actorPseudo: actor.pseudo,
              selfSlot,
              targetSlot,
            });
          } else if (ev.actorId !== myId && target) {
            nextAnnouncement({
              id: 0,
              kind: 'swap-on-other',
              actorPseudo: actor.pseudo,
              targetPseudo: target.pseudo,
              selfSlot,
              targetSlot,
            });
          }
        }
      }
    };

    const onReveal = (rev: RevealEvent) => setLastReveal(rev);
    const onRoundEnd = (payload: { results: RoundResult[] }) => setRoundResults(payload.results);
    const onGameEnd = (payload: { results: RoundResult[] }) => setFinalResults(payload.results);

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('room:state', onRoomState);
    s.on('game:hand', onHand);
    s.on('game:drawn', onDrawn);
    s.on('game:event', onEvent);
    s.on('game:reveal', onReveal);
    s.on('game:round-end', onRoundEnd);
    s.on('game:end', onGameEnd);
    if (s.connected) setConnected(true);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('room:state', onRoomState);
      s.off('game:hand', onHand);
      s.off('game:drawn', onDrawn);
      s.off('game:event', onEvent);
      s.off('game:reveal', onReveal);
      s.off('game:round-end', onRoundEnd);
      s.off('game:end', onGameEnd);
    };
  }, [user]);

  const emit = useCallback(<T extends AckResponse>(event: string, payload: unknown = {}): Promise<T> => {
    return new Promise((resolve, reject) => {
      const s = ensureConnected();
      s.emit(event, payload, (resp: T) => {
        if (resp?.ok) resolve(resp);
        else reject(new Error(String(resp?.error ?? 'request_failed')));
      });
    });
  }, []);

  const value: GameContextValue = {
    connected,
    roomState,
    privateHand,
    privateHoles,
    drawnCard,
    fromDiscard,
    pendingPower,
    lastReveal,
    lastSnap,
    powerAnnouncement,
    roundResults,
    finalResults,
    events,
    createRoom: async (cfg) => {
      const r = await emit<{ ok: true; code: string }>('room:create', cfg);
      saveLastRoomCode(r.code);
      return r.code;
    },
    joinRoom: async (code) => {
      const r = await emit<{ ok: true; code: string }>('room:join', { code });
      saveLastRoomCode(r.code);
      return r.code;
    },
    leaveRoom: async () => {
      await emit('room:leave');
      setRoomState(null);
      setPrivateHand([]);
      setPrivateHoles([]);
      setDrawnCard(null);
      setRoundResults(null);
      setFinalResults(null);
      setPowerAnnouncement(null);
    },
    setReady: async (ready) => {
      await emit('room:ready', { ready });
    },
    startGame: async () => {
      await emit('room:start');
    },
    draw: async (source) => {
      try {
        await emit('game:draw', { source });
      } catch (err) {
        setDrawnCard(null);
        throw err;
      }
    },
    swap: async (idx) => {
      try {
        await emit('game:swap', { idx });
      } finally {
        setDrawnCard(null);
      }
    },
    discard: async () => {
      try {
        await emit('game:discard');
      } finally {
        setDrawnCard(null);
      }
    },
    snap: async (idx) => {
      const r = await emit<{ ok: true; success: boolean }>('game:snap', { idx });
      return r.success;
    },
    callCombo: async () => {
      await emit('game:combo');
    },
    powerSelfPeek: async (idx) => {
      await emit('game:power:self-peek', { idx });
    },
    powerOpponentPeek: async (targetId, idx) => {
      await emit('game:power:opponent-peek', { targetId, idx });
    },
    powerSwap: async (selfIdx, targetId, targetIdx) => {
      await emit('game:power:swap', { selfIdx, targetId, targetIdx });
    },
    powerSkip: async () => {
      await emit('game:power:skip');
    },
    triggerDevPower: async (rank) => {
      await emit('dev:trigger-power', { rank });
    },
    clearReveal: () => setLastReveal(null),
    clearSnap: () => setLastSnap(null),
    clearPowerAnnouncement: () => setPowerAnnouncement(null),
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside GameProvider');
  return ctx;
}

export function isMyTurn(state: RoomStatePayload | null, userId: string | undefined): boolean {
  return !!state && !!userId && state.currentTurnPlayerId === userId;
}
