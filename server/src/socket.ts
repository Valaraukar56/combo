import type { DefaultEventsMap, Server, Socket } from 'socket.io';
import { verifyToken } from './auth.js';
import { decideAfterDraw, decideOpening, pickRandomBotName } from './ai.js';
import { createRoom, deleteRoom, getRoom } from './rooms.js';
import { Room, newPlayerId } from './room.js';
import { recordGameOutcome } from './stats.js';
import type { AuthUser, RoomConfig } from './types.js';

interface SocketData {
  user: AuthUser;
  roomCode: string | null;
}

type Sock = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;

const POWER_REVEAL_HOLD_MS = 5000;

export function setupSocketServer(io: Server): void {
  // Auth handshake — every socket must present a valid JWT.
  io.use((socket, next) => {
    const token = (socket.handshake.auth as { token?: string })?.token;
    if (!token) return next(new Error('missing_token'));
    const user = verifyToken(token);
    if (!user) return next(new Error('invalid_token'));
    (socket.data as SocketData).user = user;
    (socket.data as SocketData).roomCode = null;
    next();
  });

  io.on('connection', (rawSocket) => {
    const socket = rawSocket as Sock;
    const user = socket.data.user;

    socket.on('room:create', (cfg: Partial<RoomConfig>, ack?: AckFn) => {
      const config = normalizeConfig(cfg);
      const room = createRoom(config);
      const player = room.addPlayer({ id: user.id, pseudo: user.pseudo, isHost: true });
      if (!player) return ack?.({ ok: false, error: 'add_player_failed' });
      socket.data.roomCode = room.code;
      socket.join(roomChannel(room.code));
      if (config.isSolo) addBots(room, config.maxPlayers - 1);
      ack?.({ ok: true, code: room.code });
      broadcastRoomState(io, room);
      sendPrivateHand(socket, room);
    });

    socket.on('room:join', (data: { code?: string }, ack?: AckFn) => {
      const code = (data?.code ?? '').toUpperCase();
      const room = getRoom(code);
      if (!room) return ack?.({ ok: false, error: 'room_not_found' });
      if (room.config.isSolo) return ack?.({ ok: false, error: 'solo_room_locked' });
      // Allow rejoin if already in.
      const already = room.players.find((p) => p.id === user.id);
      if (already) {
        room.markReconnect(user.id);
        socket.data.roomCode = room.code;
        socket.join(roomChannel(room.code));
        ack?.({ ok: true, code: room.code });
        broadcastRoomState(io, room);
        sendPrivateHand(socket, room);
        return;
      }
      const player = room.addPlayer({ id: user.id, pseudo: user.pseudo });
      if (!player) return ack?.({ ok: false, error: 'room_full_or_started' });
      socket.data.roomCode = room.code;
      socket.join(roomChannel(room.code));
      ack?.({ ok: true, code: room.code });
      broadcastRoomState(io, room);
    });

    socket.on('room:leave', (_: unknown, ack?: AckFn) => {
      leaveRoom(io, socket);
      ack?.({ ok: true });
    });

    socket.on('room:ready', (data: { ready?: boolean }, ack?: AckFn) => {
      const room = currentRoom(socket);
      if (!room) return ack?.({ ok: false, error: 'no_room' });
      const ok = room.setReady(user.id, !!data?.ready);
      if (!ok) return ack?.({ ok: false, error: 'cant_set_ready' });
      broadcastRoomState(io, room);
      ack?.({ ok: true });
    });

    socket.on('room:start', (_: unknown, ack?: AckFn) => {
      const room = currentRoom(socket);
      if (!room) return ack?.({ ok: false, error: 'no_room' });
      const me = room.players.find((p) => p.id === user.id);
      if (!me?.isHost) return ack?.({ ok: false, error: 'not_host' });
      if (!room.canStart()) return ack?.({ ok: false, error: 'cant_start' });
      startRound(io, room);
      ack?.({ ok: true });
    });

    socket.on('game:draw', (data: { source?: 'deck' | 'discard' }, ack?: AckFn) => {
      const room = currentRoom(socket);
      if (!room) return ack?.({ ok: false, error: 'no_room' });
      const result = room.draw(user.id, data?.source === 'discard' ? 'discard' : 'deck');
      if (!result.ok) return ack?.({ ok: false, error: result.error });
      socket.emit('game:drawn', { card: result.card, fromDiscard: data?.source === 'discard' });
      broadcastRoomState(io, room);
      ack?.({ ok: true });
    });

    socket.on('game:swap', (data: { idx?: number }, ack?: AckFn) => {
      const room = currentRoom(socket);
      if (!room) return ack?.({ ok: false, error: 'no_room' });
      const result = room.swap(user.id, Number(data?.idx ?? -1));
      if (!result.ok) return ack?.({ ok: false, error: result.error });
      ack?.({ ok: true });
      io.to(roomChannel(room.code)).emit('game:event', { type: 'swap', actorId: user.id, idx: data?.idx });
      // Open snap window after a swap (the replaced card hits the discard).
      openSnapAndAdvance(io, room);
    });

    socket.on('game:discard', (_: unknown, ack?: AckFn) => {
      const room = currentRoom(socket);
      if (!room) return ack?.({ ok: false, error: 'no_room' });
      const result = room.discardDrawn(user.id);
      if (!result.ok) return ack?.({ ok: false, error: result.error });
      ack?.({ ok: true });
      io.to(roomChannel(room.code)).emit('game:event', {
        type: 'discard',
        actorId: user.id,
        card: result.card,
        powerType: result.powerType ?? null,
      });
      if (result.powerType) {
        // Active player picks a target via game:power:*
        broadcastRoomState(io, room);
      } else {
        openSnapAndAdvance(io, room);
      }
    });

    socket.on(
      'game:power:self-peek',
      (data: { idx?: number }, ack?: AckFn) => {
        const room = currentRoom(socket);
        if (!room) return ack?.({ ok: false, error: 'no_room' });
        const result = room.resolveSelfPeek(user.id, Number(data?.idx ?? -1));
        if (!result.ok) return ack?.({ ok: false, error: result.error });
        socket.emit('game:reveal', {
          ownerId: user.id,
          cardIdx: data?.idx,
          card: result.card,
          source: 'self',
        });
        // Hold the reveal on screen so the player can memorize the card.
        setTimeout(() => finishPower(io, room), POWER_REVEAL_HOLD_MS);
        ack?.({ ok: true });
      }
    );

    socket.on(
      'game:power:opponent-peek',
      (data: { targetId?: string; idx?: number }, ack?: AckFn) => {
        const room = currentRoom(socket);
        if (!room) return ack?.({ ok: false, error: 'no_room' });
        const result = room.resolveOpponentPeek(
          user.id,
          String(data?.targetId ?? ''),
          Number(data?.idx ?? -1)
        );
        if (!result.ok) return ack?.({ ok: false, error: result.error });
        socket.emit('game:reveal', {
          ownerId: data?.targetId,
          cardIdx: data?.idx,
          card: result.card,
          source: 'opponent',
        });
        setTimeout(() => finishPower(io, room), POWER_REVEAL_HOLD_MS);
        ack?.({ ok: true });
      }
    );

    socket.on(
      'game:power:swap',
      (data: { selfIdx?: number; targetId?: string; targetIdx?: number }, ack?: AckFn) => {
        const room = currentRoom(socket);
        if (!room) return ack?.({ ok: false, error: 'no_room' });
        const result = room.resolveSwap(
          user.id,
          Number(data?.selfIdx ?? -1),
          String(data?.targetId ?? ''),
          Number(data?.targetIdx ?? -1)
        );
        if (!result.ok) return ack?.({ ok: false, error: result.error });
        finishPower(io, room);
        ack?.({ ok: true });
      }
    );

    socket.on('dev:trigger-power', (data: { rank?: 'J' | 'Q' | 'K' }, ack?: AckFn) => {
      if (!user.isAdmin) return ack?.({ ok: false, error: 'forbidden' });
      const room = currentRoom(socket);
      if (!room) return ack?.({ ok: false, error: 'no_room' });
      const rank = data?.rank;
      if (rank !== 'J' && rank !== 'Q' && rank !== 'K') {
        return ack?.({ ok: false, error: 'invalid_rank' });
      }
      const idx = room.players.findIndex((p) => p.id === user.id);
      if (idx < 0) return ack?.({ ok: false, error: 'not_in_room' });
      const type = rank === 'J' ? 'self-peek' : rank === 'Q' ? 'opponent-peek' : 'swap';
      room.currentTurnIdx = idx;
      room.drawnCard = null;
      room.drawnFromDiscard = false;
      room.pendingPower = { rank, type };
      room.phase = 'power';
      // Mirror the discard event so the client sets pendingPower locally.
      io.to(roomChannel(room.code)).emit('game:event', {
        type: 'discard',
        actorId: user.id,
        card: { rank, suit: '♥' },
        powerType: type,
      });
      broadcastRoomState(io, room);
      sendPrivateHandsAll(io, room);
      ack?.({ ok: true });
    });

    socket.on('game:power:skip', (_: unknown, ack?: AckFn) => {
      const room = currentRoom(socket);
      if (!room) return ack?.({ ok: false, error: 'no_room' });
      if (room.phase !== 'power') return ack?.({ ok: false, error: 'wrong_phase' });
      if (!room.isCurrentTurn(user.id)) return ack?.({ ok: false, error: 'not_your_turn' });
      room.pendingPower = null;
      finishPower(io, room);
      ack?.({ ok: true });
    });

    socket.on('game:snap', (data: { idx?: number }, ack?: AckFn) => {
      const room = currentRoom(socket);
      if (!room) return ack?.({ ok: false, error: 'no_room' });
      const result = room.attemptSnap(user.id, Number(data?.idx ?? -1));
      if (!result.ok) return ack?.({ ok: false, error: result.error });
      io.to(roomChannel(room.code)).emit('game:event', {
        type: 'snap',
        actorId: user.id,
        success: result.success,
        card: result.card,
      });
      broadcastRoomState(io, room);
      sendPrivateHandsAll(io, room);
      ack?.({ ok: true, success: result.success });
    });

    socket.on('game:combo', (_: unknown, ack?: AckFn) => {
      const room = currentRoom(socket);
      if (!room) return ack?.({ ok: false, error: 'no_room' });
      const result = room.callCombo(user.id);
      if (!result.ok) return ack?.({ ok: false, error: result.error });
      io.to(roomChannel(room.code)).emit('game:event', { type: 'combo', actorId: user.id });
      // Move to next player; their final-loop turn starts.
      advanceTurn(io, room);
      ack?.({ ok: true });
    });

    socket.on('disconnect', () => {
      const room = currentRoom(socket);
      if (!room) return;
      room.markDisconnect(user.id, () => {
        broadcastRoomState(io, room);
        if (roomIsAbandoned(room)) {
          console.log(`[room] ${room.code} abandoned — deleting`);
          deleteRoom(room.code);
        }
      });
      broadcastRoomState(io, room);
    });
  });
}

/** A room is abandoned when no human player is still connected — bots alone
 * don't count as anyone being there. */
function roomIsAbandoned(room: Room): boolean {
  return !room.players.some((p) => !p.isBot && p.connected);
}

/* ── Helpers ── */

type AckFn = (response: { ok: boolean; [k: string]: unknown }) => void;

function roomChannel(code: string): string {
  return `room:${code}`;
}

function currentRoom(socket: Sock): Room | null {
  const code = socket.data.roomCode;
  if (!code) return null;
  return getRoom(code) ?? null;
}

function leaveRoom(io: Server, socket: Sock): void {
  const room = currentRoom(socket);
  if (!room) return;
  const userId = socket.data.user.id;
  socket.leave(roomChannel(room.code));
  socket.data.roomCode = null;

  // Hard remove during waiting (player abandons before the game starts) and
  // after game-end (game is over, nothing to come back to). For any in-progress
  // phase, treat the leave like a disconnect so the slot stays open for the
  // grace window and the player can rejoin via the same room code.
  const inProgress = room.phase !== 'waiting' && room.phase !== 'game-end';
  if (inProgress) {
    room.markDisconnect(userId, () => {
      broadcastRoomState(io, room);
      if (roomIsAbandoned(room)) {
        console.log(`[room] ${room.code} abandoned — deleting`);
        deleteRoom(room.code);
      }
    });
    broadcastRoomState(io, room);
    return;
  }

  room.removePlayer(userId);
  if (roomIsAbandoned(room)) {
    console.log(`[room] ${room.code} empty — deleting`);
    deleteRoom(room.code);
  } else {
    broadcastRoomState(io, room);
  }
}

function normalizeConfig(cfg: Partial<RoomConfig>): RoomConfig {
  const isSolo = !!cfg.isSolo;
  return {
    maxPlayers: clamp(Number(cfg.maxPlayers ?? 4), 2, 4),
    // Solo (vs IA) is locked to a single round — it's a quick training mode.
    rounds: isSolo ? 1 : clamp(Number(cfg.rounds ?? 5), 1, 10),
    isPrivate: cfg.isPrivate !== false,
    isSolo,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Math.round(Number.isFinite(n) ? n : lo)));
}

function broadcastRoomState(io: Server, room: Room): void {
  io.to(roomChannel(room.code)).emit('room:state', room.publicState());
}

function sendPrivateHand(socket: Sock, room: Room): void {
  socket.emit('game:hand', room.privateHand(socket.data.user.id));
}

function sendPrivateHandsAll(io: Server, room: Room): void {
  for (const p of room.players) {
    if (p.isBot) continue;
    io.to(roomChannel(room.code))
      .fetchSockets()
      .then((sockets) => {
        const target = sockets.find((s) => (s.data as SocketData).user.id === p.id);
        if (target) {
          target.emit('game:hand', room.privateHand(p.id));
        }
      });
  }
}

function startRound(io: Server, room: Room): void {
  room.startRound(() => {
    broadcastRoomState(io, room);
    sendPrivateHandsAll(io, room);
    runBotTurnIfNeeded(io, room);
  });
  broadcastRoomState(io, room);
  sendPrivateHandsAll(io, room);
}

function openSnapAndAdvance(io: Server, room: Room): void {
  sendPrivateHandsAll(io, room);
  room.openSnapWindow(() => {
    advanceTurn(io, room);
  });
  broadcastRoomState(io, room);
}

function finishPower(io: Server, room: Room): void {
  // Powers only happen after a discard; close out turn the same way.
  openSnapAndAdvance(io, room);
}

function advanceTurn(io: Server, room: Room): void {
  const { roundOver } = room.endTurn();
  if (roundOver) {
    const results = room.endRound();
    io.to(roomChannel(room.code)).emit('game:round-end', { results });
    broadcastRoomState(io, room);
    if (room.isGameOver()) {
      // Show results for ~6s, then finalize the game (persists stats).
      setTimeout(() => finalizeAndPersist(io, room), 6000);
    } else {
      // Auto-advance to next round after a pause for results.
      setTimeout(() => startRound(io, room), 6000);
    }
    return;
  }
  broadcastRoomState(io, room);
  runBotTurnIfNeeded(io, room);
}

function finalizeAndPersist(io: Server, room: Room): void {
  const final = room.finalizeGame();
  const summary = room.perPlayerSummary();
  // Lowest cumulative total wins. Ties: every player at the lowest score is a winner.
  const minScore = summary.length > 0 ? Math.min(...summary.map((p) => p.totalScore)) : 0;
  // Solo games (vs bots) are training, not ranked — skip persistence entirely.
  if (room.config.isSolo) {
    console.log(`[stats] skipping solo game (training mode, not recorded)`);
  } else {
    try {
      recordGameOutcome({
        mode: 'multi',
        roundsCount: room.config.rounds,
        finishedAt: Date.now(),
        players: summary.map((p) => ({
          userId: p.id,
          pseudo: p.pseudo,
          finalScore: p.totalScore,
          isWinner: p.totalScore === minScore,
          combosCalled: p.combosCalled,
          combosWon: p.combosWon,
          snapsFailed: p.snapsFailed,
        })),
      });
    } catch (err) {
      console.error('[stats] failed to record game outcome', err);
    }
  }
  io.to(roomChannel(room.code)).emit('game:end', { results: final });
  broadcastRoomState(io, room);
}

/* ── Bot driver ── */

function addBots(room: Room, count: number): void {
  for (let i = 0; i < count; i++) {
    const id = 'bot_' + newPlayerId();
    room.addPlayer({ id, pseudo: pickRandomBotName(), isBot: true });
  }
}

function runBotTurnIfNeeded(io: Server, room: Room): void {
  const current = room.players[room.currentTurnIdx];
  if (!current?.isBot) return;
  setTimeout(() => playBotTurn(io, room, current.id), 1200);
}

function playBotTurn(io: Server, room: Room, botId: string): void {
  if (!room.isCurrentTurn(botId)) return;
  const opening = decideOpening(room, botId);
  if (opening.kind === 'combo') {
    const result = room.callCombo(botId);
    if (result.ok) {
      io.to(roomChannel(room.code)).emit('game:event', { type: 'combo', actorId: botId });
    }
    advanceTurn(io, room);
    return;
  }
  const drawn = room.draw(botId, opening.kind === 'draw-discard' ? 'discard' : 'deck');
  if (!drawn.ok || !drawn.card) {
    advanceTurn(io, room);
    return;
  }
  io.to(roomChannel(room.code)).emit('game:event', {
    type: 'bot-drew',
    actorId: botId,
    fromDiscard: opening.kind === 'draw-discard',
  });
  const after = decideAfterDraw(room, botId, drawn.card);
  if (after.kind === 'swap' && typeof after.idx === 'number') {
    room.swap(botId, after.idx);
    io.to(roomChannel(room.code)).emit('game:event', { type: 'swap', actorId: botId, idx: after.idx });
  } else {
    const r = room.discardDrawn(botId);
    io.to(roomChannel(room.code)).emit('game:event', {
      type: 'discard',
      actorId: botId,
      card: r.card,
      powerType: r.powerType ?? null,
    });
    // Bots auto-resolve their power on a random target after a short delay.
    if (r.powerType) {
      autoResolveBotPower(io, room, botId, r.powerType);
      return;
    }
  }
  openSnapAndAdvance(io, room);
}

function autoResolveBotPower(
  io: Server,
  room: Room,
  botId: string,
  type: 'self-peek' | 'opponent-peek' | 'swap'
): void {
  const pickSlot = (hand: { length: number; [i: number]: unknown }): number => {
    const filled: number[] = [];
    for (let i = 0; i < hand.length; i++) if (hand[i]) filled.push(i);
    if (filled.length === 0) return 0;
    return filled[Math.floor(Math.random() * filled.length)];
  };
  setTimeout(() => {
    if (type === 'self-peek') {
      const me = room.players.find((p) => p.id === botId);
      if (me) room.resolveSelfPeek(botId, pickSlot(me.hand));
    } else if (type === 'opponent-peek') {
      const opp = room.players.find((p) => p.id !== botId);
      if (opp) room.resolveOpponentPeek(botId, opp.id, pickSlot(opp.hand));
    } else {
      const opp = room.players.find((p) => p.id !== botId);
      const me = room.players.find((p) => p.id === botId);
      if (opp && me) {
        room.resolveSwap(botId, pickSlot(me.hand), opp.id, pickSlot(opp.hand));
      }
    }
    finishPower(io, room);
  }, 800);
}
