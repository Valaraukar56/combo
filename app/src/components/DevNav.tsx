import { useState } from 'react';
import type { Page } from '../types';

interface DevNavProps {
  onJump: (page: Page) => void;
}

export function DevNav({ onJump }: DevNavProps) {
  const [open, setOpen] = useState(false);
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
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
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
                onClick={() => {
                  onJump(s);
                  setOpen(false);
                }}
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
