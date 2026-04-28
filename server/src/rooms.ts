import { genRoomCode, Room } from './room.js';
import type { RoomConfig } from './types.js';

const rooms = new Map<string, Room>();

export function createRoom(config: RoomConfig): Room {
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = genRoomCode();
    if (!rooms.has(code)) {
      const r = new Room(code, config);
      rooms.set(code, r);
      return r;
    }
  }
  throw new Error('Failed to allocate a unique room code');
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase());
}

export function deleteRoom(code: string): void {
  const r = rooms.get(code);
  if (r) {
    r.destroy();
    rooms.delete(code);
  }
}

export function listRoomsForUser(userId: string): Room[] {
  return [...rooms.values()].filter((r) => r.players.some((p) => p.id === userId));
}
