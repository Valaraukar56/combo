// Persists the most recent room code so the user can rejoin a game they
// left or got disconnected from while the server's grace window is still open.

const KEY = 'combo_last_room';

export function getLastRoomCode(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveLastRoomCode(code: string): void {
  try {
    localStorage.setItem(KEY, code);
  } catch {
    /* storage unavailable */
  }
}

export function clearLastRoomCode(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}
