import { Avatar } from './ui';
import { PlayingCard } from './Card';

interface SideOpponentProps {
  name: string;
  score?: number;
  side?: 'left' | 'right';
  isCurrentTurn?: boolean;
}

/**
 * Compact opponent display for the side seats.
 * Cards arranged in a 2×2 grid rotated 90° so they face inward toward the center.
 */
export function SideOpponent({ name, side = 'left', isCurrentTurn = false }: SideOpponentProps) {
  const rot = side === 'left' ? 90 : -90;
  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        [side]: 28,
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
      }}
    >
      {/* Identity badge */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          padding: '8px 12px',
          background: isCurrentTurn ? 'rgba(200, 169, 110, 0.08)' : 'rgba(0,0,0,0.25)',
          border: '1.5px solid',
          borderColor: isCurrentTurn ? 'var(--gold)' : 'var(--border)',
          borderRadius: 'var(--radius)',
          backdropFilter: 'blur(6px)',
          minWidth: 110,
        }}
      >
        <Avatar name={name} size={32} ring={isCurrentTurn ? 'gold' : null} />
        <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--ink)' }}>{name}</div>
      </div>

      {/* Cards: 2×2 grid, rotated to face center */}
      <div style={{ transform: `rotate(${rot}deg)`, padding: '14px 6px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <PlayingCard faceDown size="sm" />
          <PlayingCard faceDown size="sm" />
          <PlayingCard faceDown size="sm" highlight="memorized" />
          <PlayingCard faceDown size="sm" highlight="memorized" />
        </div>
      </div>
    </div>
  );
}
