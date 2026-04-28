import type { CardSize, CardHighlight } from '../types';

interface PlayingCardProps {
  rank?: string;
  suit?: string;
  faceDown?: boolean;
  size?: CardSize;
  highlight?: CardHighlight;
  onClick?: (() => void) | null;
  flipped?: boolean;
  animDelay?: number;
}

export function PlayingCard({
  rank,
  suit,
  faceDown = false,
  size = 'md',
  highlight,
  onClick,
  flipped,
  animDelay = 0,
}: PlayingCardProps) {
  const sizeClass = `card-${size}`;
  const isRed = suit === '♥' || suit === '♦';
  const highlightClass = highlight ? `card-highlight-${highlight}` : '';
  const clickable = onClick ? 'card-clickable' : '';

  // If `flipped` prop is provided, use 3D flip animation
  if (flipped !== undefined) {
    return (
      <div
        className={`card ${sizeClass} ${highlightClass} ${clickable}`}
        onClick={onClick ?? undefined}
        style={{ animationDelay: animDelay + 'ms' }}
      >
        <div className={`card-flip ${sizeClass} ${flipped ? 'flipped' : ''}`}>
          <div className="card-face card-face-back">
            <CardBack />
          </div>
          <div className="card-face card-face-front">
            <CardFront rank={rank} suit={suit} isRed={isRed} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`card ${sizeClass} ${highlightClass} ${clickable}`}
      onClick={onClick ?? undefined}
      style={{ animationDelay: animDelay + 'ms' }}
    >
      {faceDown ? <CardBack /> : <CardFront rank={rank} suit={suit} isRed={isRed} />}
    </div>
  );
}

export function CardBack() {
  return (
    <div className="card-back">
      <div className="card-back-inner">
        <span className="card-monogram">C</span>
      </div>
    </div>
  );
}

interface CardFrontProps {
  rank?: string;
  suit?: string;
  isRed: boolean;
}

export function CardFront({ rank, suit, isRed }: CardFrontProps) {
  return (
    <div className={`card-front ${isRed ? 'red' : ''}`}>
      <div className="card-corner">
        <span>{rank}</span>
        <span>{suit}</span>
      </div>
      <div className="card-center">{suit}</div>
      <div className="card-corner card-corner-bottom">
        <span>{rank}</span>
        <span>{suit}</span>
      </div>
    </div>
  );
}
