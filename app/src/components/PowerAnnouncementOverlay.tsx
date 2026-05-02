import { useEffect } from 'react';
import { useGame } from '../lib/game';
import type { PowerAnnouncement } from '../lib/game';

const DISMISS_MS = 2800;

/**
 * Fullscreen overlay shown whenever an opponent uses Q♥ (peek) or K♥ (swap).
 * Mirrors the visual language of the COMBO call overlay so power activations
 * feel as significant as a combo declaration. Auto-dismisses after a few
 * seconds; remounts on every new announcement (each has a unique id).
 */
export function PowerAnnouncementOverlay() {
  const { powerAnnouncement, clearPowerAnnouncement } = useGame();

  useEffect(() => {
    if (!powerAnnouncement) return;
    const t = setTimeout(clearPowerAnnouncement, DISMISS_MS);
    return () => clearTimeout(t);
  }, [powerAnnouncement, clearPowerAnnouncement]);

  if (!powerAnnouncement) return null;

  const { kind } = powerAnnouncement;
  const isPeek = kind === 'peek-on-me' || kind === 'peek-on-other';
  const isOnMe = kind === 'peek-on-me' || kind === 'swap-on-me';
  const accentColor = isOnMe ? 'var(--crimson)' : 'var(--gold-bright)';
  const glow = isOnMe ? 'rgba(178, 34, 52, 0.55)' : 'rgba(200, 169, 110, 0.55)';
  const backdropTint = isOnMe ? 'rgba(80, 18, 24, 0.35)' : 'rgba(200, 169, 110, 0.22)';

  return (
    <div
      // The unique key ensures the animation replays for back-to-back powers.
      key={powerAnnouncement.id}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `radial-gradient(circle, ${backdropTint} 0%, rgba(0,0,0,0.72) 70%)`,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 9000,
        pointerEvents: 'none',
        animation: 'fade-in 220ms ease-out',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          animation: 'combo-zoom 700ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          maxWidth: '90vw',
        }}
      >
        <div
          className="eyebrow"
          style={{
            color: accentColor,
            fontSize: 14,
            marginBottom: 12,
            letterSpacing: '0.18em',
          }}
        >
          {renderEyebrow(powerAnnouncement)}
        </div>
        <div
          className="display-italic"
          style={{
            fontSize: 96,
            color: accentColor,
            textShadow: `0 8px 60px ${glow}`,
            lineHeight: 0.95,
            margin: 0,
          }}
        >
          {isPeek ? '👁' : '🔄'}
        </div>
        <div
          className="display"
          style={{
            fontSize: 38,
            color: 'var(--ink)',
            marginTop: 16,
            lineHeight: 1.1,
          }}
        >
          {renderTitle(powerAnnouncement)}
        </div>
        <div
          style={{
            marginTop: 12,
            fontSize: 16,
            color: 'var(--ink-2)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.04em',
          }}
        >
          {renderSubtitle(powerAnnouncement)}
        </div>
      </div>
    </div>
  );
}

function renderEyebrow(a: PowerAnnouncement): string {
  switch (a.kind) {
    case 'peek-on-me':
      return `${a.actorPseudo} regarde votre main`;
    case 'peek-on-other':
      return `${a.actorPseudo} regarde une carte`;
    case 'swap-on-me':
      return `${a.actorPseudo} échange avec vous`;
    case 'swap-on-other':
      return `${a.actorPseudo} échange une carte`;
  }
}

function renderTitle(a: PowerAnnouncement): string {
  switch (a.kind) {
    case 'peek-on-me':
      return 'Une de vos cartes est observée';
    case 'peek-on-other':
      return `${a.targetPseudo ?? 'Adversaire'} est observé`;
    case 'swap-on-me':
      return 'Vos cartes ont changé !';
    case 'swap-on-other':
      return `Échange avec ${a.targetPseudo ?? 'un adversaire'}`;
  }
}

function renderSubtitle(a: PowerAnnouncement): string {
  switch (a.kind) {
    case 'peek-on-me':
      return `Carte n°${a.targetSlot}`;
    case 'peek-on-other':
      return `Carte n°${a.targetSlot} de ${a.targetPseudo ?? '?'}`;
    case 'swap-on-me':
      return `Sa n°${a.selfSlot ?? '?'} ↔ Votre n°${a.targetSlot}`;
    case 'swap-on-other':
      return `Sa n°${a.selfSlot ?? '?'} ↔ La n°${a.targetSlot} de ${a.targetPseudo ?? '?'}`;
  }
}
