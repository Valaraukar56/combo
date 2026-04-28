import { Avatar } from './ui';
import { PlayingCard } from './Card';
import type { Card, CardSize } from '../types';

interface PlayerBoxProps {
  name: string;
  cards?: Card[];
  isCurrentTurn?: boolean;
  isReady?: boolean;
  score?: number;
  lowCardsCount?: number;
  position?: 'top' | 'bottom' | 'left' | 'right';
  size?: CardSize;
  highlightedIndex?: number;
  revealedIndices?: number[];
  showHand?: boolean;
  hostBadge?: boolean;
}

export function PlayerBox({
  name,
  cards,
  isCurrentTurn,
  isReady,
  score,
  lowCardsCount,
  size = 'sm',
  highlightedIndex,
  revealedIndices = [],
  showHand = false,
  hostBadge,
}: PlayerBoxProps) {
  const cardSize = size;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        padding: '14px 18px',
        background: isCurrentTurn ? 'rgba(200, 169, 110, 0.08)' : 'rgba(0,0,0,0.25)',
        border: '1.5px solid',
        borderColor: isCurrentTurn ? 'var(--gold)' : 'var(--border)',
        borderRadius: 'var(--radius)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        boxShadow: isCurrentTurn ? '0 0 32px var(--gold-glow)' : 'var(--shadow-md)',
        transition: 'border var(--t), box-shadow var(--t), background var(--t)',
        minWidth: 160,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
        <Avatar name={name} size={28} ring={isCurrentTurn ? 'gold' : null} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                fontWeight: 600,
                fontSize: 13,
                color: 'var(--ink)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {name}
            </span>
            {hostBadge && (
              <span
                style={{
                  fontSize: 9,
                  color: 'var(--gold)',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                HÔTE
              </span>
            )}
          </div>
          {score !== undefined && (
            <div style={{ fontSize: 11, color: 'var(--ink-2)', fontFamily: 'var(--font-mono)' }}>
              {score} pts
            </div>
          )}
        </div>
        {isReady !== undefined && (
          <span className={`status-dot ${isReady ? 'ready' : 'idle'}`} />
        )}
      </div>

      {/* Cards (if present) */}
      {cards && (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
          {cards.map((c, i) => {
            const isLow = lowCardsCount !== undefined && i < lowCardsCount;
            const isRevealed = revealedIndices.includes(i);
            const showFace = showHand || isRevealed;
            const isHighlighted = highlightedIndex === i;
            return (
              <PlayingCard
                key={i}
                rank={c.rank}
                suit={c.suit}
                faceDown={!showFace}
                size={cardSize}
                highlight={isHighlighted ? 'selected' : isLow ? 'memorized' : null}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
