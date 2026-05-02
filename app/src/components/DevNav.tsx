import { useState } from 'react';
import { useGame } from '../lib/game';
import type { Page } from '../types';

interface DevNavProps {
  onJump: (page: Page) => void;
}

export function DevNav({ onJump }: DevNavProps) {
  const { roomState, triggerDevPower } = useGame();
  const [open, setOpen] = useState(false);
  const [powerPickerOpen, setPowerPickerOpen] = useState(false);
  const screens: Page[] = [
    'home',
    'login',
    'register',
    'lobby',
    'waitingroom',
    'memorize',
    'table',
    'power',
    'snap',
    'endround',
    'endgame',
    'rules',
    'leaderboard',
    'history',
    'profile',
    'settings',
  ];

  const handleClick = (s: Page) => {
    if (s === 'power') {
      if (!roomState) {
        // No room — just navigate; the trigger needs a live room.
        onJump(s);
        setOpen(false);
        return;
      }
      setPowerPickerOpen(true);
      return;
    }
    onJump(s);
    setOpen(false);
  };

  const triggerPower = (rank: 'J' | 'Q' | 'K') => {
    triggerDevPower(rank).catch((err) => console.error('[dev] trigger power failed', err));
    setPowerPickerOpen(false);
    setOpen(false);
  };
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 80,
        left: 16,
        zIndex: 9999,
        fontFamily: 'var(--font-body)',
      }}
    >
      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: 48,
            left: 0,
            background: 'var(--bg-elevated)',
            border: '1.5px solid var(--gold)',
            borderRadius: 'var(--radius)',
            padding: 12,
            boxShadow: 'var(--shadow-lg)',
            minWidth: 200,
          }}
        >
          <div className="eyebrow" style={{ color: 'var(--gold)', marginBottom: 8 }}>
            Dev — Aller à
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {screens.map((s) => (
              <button
                key={s}
                onClick={() => handleClick(s)}
                style={{
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--ink-2)',
                  padding: '6px 10px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(200,169,110,0.1)';
                  e.currentTarget.style.color = 'var(--gold-bright)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--ink-2)';
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
      {powerPickerOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: 48,
            left: 0,
            background: 'var(--bg-elevated)',
            border: '1.5px solid var(--gold)',
            borderRadius: 'var(--radius)',
            padding: 12,
            boxShadow: 'var(--shadow-lg)',
            minWidth: 220,
          }}
        >
          <div className="eyebrow" style={{ color: 'var(--gold)', marginBottom: 8 }}>
            Dev — Déclencher pouvoir
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(
              [
                { rank: 'J', label: 'J ♥ — regarder une carte à soi' },
                { rank: 'Q', label: 'Q ♥ — regarder une carte adverse' },
                { rank: 'K', label: 'K ♥ — échanger une carte' },
              ] as const
            ).map((p) => (
              <button
                key={p.rank}
                onClick={() => triggerPower(p.rank)}
                style={{
                  textAlign: 'left',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--ink)',
                  padding: '8px 10px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(200,169,110,0.12)';
                  e.currentTarget.style.color = 'var(--gold-bright)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--ink)';
                }}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setPowerPickerOpen(false)}
              style={{
                marginTop: 4,
                background: 'transparent',
                border: 'none',
                color: 'var(--ink-3)',
                padding: '6px 10px',
                cursor: 'pointer',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
              }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'var(--bg-elevated)',
          border: '1.5px solid var(--gold)',
          color: 'var(--gold-bright)',
          padding: '8px 14px',
          borderRadius: 'var(--radius-sm)',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        ◆ Nav · {open ? '×' : '+'}
      </button>
    </div>
  );
}
