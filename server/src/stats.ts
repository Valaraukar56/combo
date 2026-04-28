import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { authMiddleware } from './auth.js';
import {
  db,
  gameQueries,
  statsQueries,
  type GameHistoryRow,
  type LeaderboardRow,
  type StatsRow,
} from './db.js';

export interface GameOutcomeForPlayer {
  userId: string;
  pseudo: string;
  finalScore: number;
  isWinner: boolean;
  combosCalled: number;
  combosWon: number;
  snapsFailed: number;
}

export interface GameOutcome {
  mode: 'multi' | 'solo';
  roundsCount: number;
  finishedAt: number;
  players: GameOutcomeForPlayer[];
}

/**
 * Persist a finished game and update each human player's lifetime stats.
 * Bots are excluded — they don't have rows in the users table.
 */
export function recordGameOutcome(outcome: GameOutcome): void {
  const humans = outcome.players.filter((p) => !p.userId.startsWith('bot_'));
  if (humans.length === 0) return;

  const gameId = 'g_' + randomUUID();
  const playersSummary = JSON.stringify(
    outcome.players.map((p) => ({
      pseudo: p.pseudo,
      score: p.finalScore,
      winner: p.isWinner,
      bot: p.userId.startsWith('bot_'),
    }))
  );

  db.exec('BEGIN');
  try {
    gameQueries.insertGame.run(
      gameId,
      outcome.finishedAt,
      outcome.mode,
      outcome.roundsCount,
      playersSummary
    );
    for (const p of humans) {
      gameQueries.insertGamePlayer.run(
        gameId,
        p.userId,
        p.pseudo,
        p.finalScore,
        p.isWinner ? 1 : 0,
        p.combosCalled,
        p.combosWon,
        p.snapsFailed
      );
      statsQueries.applyResult.run(
        p.isWinner ? 1 : 0,
        p.combosCalled,
        p.combosWon,
        p.snapsFailed,
        p.finalScore,
        outcome.finishedAt,
        p.userId
      );
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export const statsRouter: Router = Router();

statsRouter.get('/me', authMiddleware, (req, res) => {
  const userId = req.user!.id;
  const row = statsQueries.byUserId.get(userId) as StatsRow | undefined;
  if (!row) {
    res.json(emptyStats(userId));
    return;
  }
  res.json({
    gamesPlayed: row.games_played,
    gamesWon: row.games_won,
    combosCalled: row.combos_called,
    combosWon: row.combos_won,
    snapsFailed: row.snaps_failed,
    totalScore: row.total_score,
    lastPlayedAt: row.last_played_at,
    winRate: row.games_played === 0 ? 0 : Math.round((row.games_won / row.games_played) * 100),
  });
});

statsRouter.get('/leaderboard', authMiddleware, (req, res) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 20)));
  const rows = statsQueries.topByWins.all(limit) as unknown as LeaderboardRow[];
  res.json({
    entries: rows.map((r, i) => ({
      rank: i + 1,
      userId: r.user_id,
      pseudo: r.pseudo,
      gamesPlayed: r.games_played,
      gamesWon: r.games_won,
      combosWon: r.combos_won,
      totalScore: r.total_score,
      isMe: r.user_id === req.user!.id,
    })),
  });
});

statsRouter.get('/history', authMiddleware, (req, res) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 20)));
  const rows = gameQueries.recentForUser.all(req.user!.id, limit) as unknown as GameHistoryRow[];
  res.json({
    games: rows.map((r) => ({
      gameId: r.game_id,
      finishedAt: r.finished_at,
      mode: r.mode,
      roundsCount: r.rounds_count,
      players: safeParse(r.players_json),
      myScore: r.final_score,
      won: !!r.is_winner,
    })),
  });
});

function emptyStats(userId: string): unknown {
  return {
    userId,
    gamesPlayed: 0,
    gamesWon: 0,
    combosCalled: 0,
    combosWon: 0,
    snapsFailed: 0,
    totalScore: 0,
    lastPlayedAt: null,
    winRate: 0,
  };
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return [];
  }
}
