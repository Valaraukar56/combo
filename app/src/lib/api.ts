import type { User } from '../types';

const TOKEN_KEY = 'combo_token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((opts.headers as Record<string, string>) ?? {}),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { ...opts, headers });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new ApiError(res.status, data.error ?? 'request_failed', data.message ?? data.error);
  }
  return (await res.json()) as T;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface UserStats {
  gamesPlayed: number;
  gamesWon: number;
  combosCalled: number;
  combosWon: number;
  snapsFailed: number;
  totalScore: number;
  lastPlayedAt: number | null;
  winRate: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  pseudo: string;
  gamesPlayed: number;
  gamesWon: number;
  combosWon: number;
  totalScore: number;
  isMe: boolean;
}

export interface HistoryEntry {
  gameId: string;
  finishedAt: number;
  mode: 'multi' | 'solo';
  roundsCount: number;
  players: { pseudo: string; score: number; winner: boolean; bot: boolean }[];
  myScore: number;
  won: boolean;
}

export const api = {
  register: (pseudo: string, password: string) =>
    request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ pseudo, password }),
    }),
  login: (pseudo: string, password: string) =>
    request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ pseudo, password }),
    }),
  me: () => request<{ user: User }>('/api/auth/me'),
  myStats: () => request<UserStats>('/api/stats/me'),
  leaderboard: (limit = 20) =>
    request<{ entries: LeaderboardEntry[] }>(`/api/stats/leaderboard?limit=${limit}`),
  history: (limit = 20) =>
    request<{ games: HistoryEntry[] }>(`/api/stats/history?limit=${limit}`),
};
