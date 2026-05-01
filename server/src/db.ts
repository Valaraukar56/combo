import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

mkdirSync(dirname(config.dbPath), { recursive: true });

export const db = new DatabaseSync(config.dbPath);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    pseudo TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS user_stats (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    games_played INTEGER NOT NULL DEFAULT 0,
    games_won INTEGER NOT NULL DEFAULT 0,
    combos_called INTEGER NOT NULL DEFAULT 0,
    combos_won INTEGER NOT NULL DEFAULT 0,
    snaps_failed INTEGER NOT NULL DEFAULT 0,
    total_score INTEGER NOT NULL DEFAULT 0,
    last_played_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    finished_at INTEGER NOT NULL,
    mode TEXT NOT NULL,
    rounds_count INTEGER NOT NULL,
    players_json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS game_players (
    game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pseudo TEXT NOT NULL,
    final_score INTEGER NOT NULL,
    is_winner INTEGER NOT NULL DEFAULT 0,
    combos_called INTEGER NOT NULL DEFAULT 0,
    combos_won INTEGER NOT NULL DEFAULT 0,
    snaps_failed INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (game_id, user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_game_players_user ON game_players(user_id);
`);

// Migrate existing DBs that pre-date the is_admin column.
{
  const cols = db
    .prepare("PRAGMA table_info('users')")
    .all() as { name: string }[];
  if (!cols.some((c) => c.name === 'is_admin')) {
    db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0');
  }
}

// Backfill user_stats rows for any existing user that doesn't have one
// (legacy users registered before user_stats was inserted on signup).
db.exec(`
  INSERT OR IGNORE INTO user_stats (user_id)
  SELECT id FROM users
`);

export interface UserRow {
  id: string;
  pseudo: string;
  password_hash: string;
  created_at: number;
  is_admin: number;
}

export interface StatsRow {
  user_id: string;
  games_played: number;
  games_won: number;
  combos_called: number;
  combos_won: number;
  snaps_failed: number;
  total_score: number;
  last_played_at: number | null;
}

export interface LeaderboardRow {
  user_id: string;
  pseudo: string;
  games_played: number;
  games_won: number;
  combos_won: number;
  total_score: number;
}

export interface GameHistoryRow {
  game_id: string;
  finished_at: number;
  mode: string;
  rounds_count: number;
  players_json: string;
  final_score: number;
  is_winner: number;
}

export const userQueries = {
  insert: db.prepare(
    'INSERT INTO users (id, pseudo, password_hash, created_at) VALUES (?, ?, ?, ?)'
  ),
  insertStats: db.prepare('INSERT INTO user_stats (user_id) VALUES (?)'),
  byId: db.prepare('SELECT * FROM users WHERE id = ?'),
  byPseudo: db.prepare('SELECT * FROM users WHERE pseudo = ? COLLATE NOCASE'),
  setAdmin: db.prepare('UPDATE users SET is_admin = ? WHERE id = ?'),
};

export const statsQueries = {
  byUserId: db.prepare('SELECT * FROM user_stats WHERE user_id = ?'),
  ensureRow: db.prepare('INSERT OR IGNORE INTO user_stats (user_id) VALUES (?)'),
  // We award games_won only when this user has the lowest score AND played a real game.
  applyResult: db.prepare(`
    UPDATE user_stats
    SET games_played = games_played + 1,
        games_won = games_won + ?,
        combos_called = combos_called + ?,
        combos_won = combos_won + ?,
        snaps_failed = snaps_failed + ?,
        total_score = total_score + ?,
        last_played_at = ?
    WHERE user_id = ?
  `),
  topByWins: db.prepare(`
    SELECT u.id AS user_id, u.pseudo, s.games_played, s.games_won, s.combos_won, s.total_score
    FROM user_stats s
    JOIN users u ON u.id = s.user_id
    WHERE s.games_played > 0
    ORDER BY s.games_won DESC, s.combos_won DESC, s.total_score ASC, u.pseudo ASC
    LIMIT ?
  `),
};

export const gameQueries = {
  insertGame: db.prepare(
    'INSERT INTO games (id, finished_at, mode, rounds_count, players_json) VALUES (?, ?, ?, ?, ?)'
  ),
  insertGamePlayer: db.prepare(`
    INSERT INTO game_players
      (game_id, user_id, pseudo, final_score, is_winner, combos_called, combos_won, snaps_failed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),
  recentForUser: db.prepare(`
    SELECT g.id AS game_id, g.finished_at, g.mode, g.rounds_count, g.players_json,
           gp.final_score, gp.is_winner
    FROM game_players gp
    JOIN games g ON g.id = gp.game_id
    WHERE gp.user_id = ?
    ORDER BY g.finished_at DESC
    LIMIT ?
  `),
};
