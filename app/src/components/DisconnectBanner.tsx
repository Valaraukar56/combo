import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/auth';
import { useGame } from '../lib/game';
import { useToast } from './Toast';

// Mirror of server's RECONNECT_GRACE_MS — kept in sync manually.
const GRACE_MS = 30000;

export function DisconnectBanner() {
  const { user } = useAuth();
  const { roomState } = useGame();
  const toast = useToast();
  const prevConnected = useRef<Map<string, boolean>>(new Map());
  const [disconnectedAt, setDisconnectedAt] = useState<Map<string, number>>(new Map());
  const [now, setNow] = useState(Date.now());

  // Tick a clock for the countdown label (every 500ms is fine — this isn't an animation).
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  // Detect connect/disconnect transitions to stamp the disconnect time and toast on rejoin.
  useEffect(() => {
    if (!roomState) {
      prevConnected.current.clear();
      setDisconnectedAt(new Map());
      return;
    }
    const next = new Map(disconnectedAt);
    let changed = false;
    for (const p of roomState.players) {
      if (p.isBot || p.id === user?.id) continue;
      const wasConnected = prevConnected.current.get(p.id) ?? true;
      if (wasConnected && !p.connected) {
        next.set(p.id, Date.now());
        changed = true;
        toast.push(`${p.pseudo} s'est déconnecté`, 'danger');
      } else if (!wasConnected && p.connected) {
        next.delete(p.id);
        changed = true;
        toast.push(`${p.pseudo} est de retour !`, 'success');
      }
      prevConnected.current.set(p.id, p.connected);
    }
    // Drop entries for players who no longer exist (left the room).
    for (const id of Array.from(next.keys())) {
      if (!roomState.players.some((p) => p.id === id)) {
        next.delete(id);
        changed = true;
      }
    }
    if (changed) setDisconnectedAt(next);
  }, [roomState, user?.id, toast, disconnectedAt]);

  if (!roomState) return null;
  const disconnected = roomState.players.filter(
    (p) => !p.connected && !p.isBot && p.id !== user?.id
  );
  if (disconnected.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 72,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9000,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
        maxWidth: '90vw',
      }}
    >
      {disconnected.map((p) => {
        const since = disconnectedAt.get(p.id) ?? now;
        const elapsed = now - since;
        const secondsLeft = Math.max(0, Math.ceil((GRACE_MS - elapsed) / 1000));
        const expired = elapsed >= GRACE_MS;
        return (
          <div
            key={p.id}
            style={{
              background: 'rgba(40, 18, 18, 0.94)',
              border: `1.5px solid var(--crimson)`,
              borderRadius: 'var(--radius-sm)',
              padding: '12px 18px',
              boxShadow: 'var(--shadow-lg)',
              color: 'var(--ink)',
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              backdropFilter: 'blur(8px)',
              minWidth: 320,
            }}
          >
            <span style={{ color: 'var(--crimson)', fontSize: 18, lineHeight: 1 }}>⚠</span>
            <span>
              <strong style={{ color: 'var(--ink)' }}>{p.pseudo}</strong> s'est déconnecté
            </span>
            <span
              style={{
                color: expired ? 'var(--ink-3)' : 'var(--ink-2)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginLeft: 'auto',
              }}
            >
              {expired ? 'Délai expiré' : `peut revenir · ${secondsLeft}s`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
