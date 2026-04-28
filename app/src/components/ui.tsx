import type { CSSProperties, ReactNode } from 'react';
import type { User, Page as PageId } from '../types';

/* ──────── Logo ──────── */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <div className="logo" style={{ fontSize: size, lineHeight: 1 }}>
      Combo
    </div>
  );
}

/* ──────── Button ──────── */
interface ButtonProps {
  children: ReactNode;
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
  style?: CSSProperties;
}

export function Button({
  children,
  variant = 'primary',
  size,
  onClick,
  disabled,
  type = 'button',
  className = '',
  style,
}: ButtonProps) {
  const sizeClass = size ? `btn-${size}` : '';
  return (
    <button
      type={type}
      className={`btn btn-${variant} ${sizeClass} ${className}`}
      onClick={onClick}
      disabled={disabled}
      style={style}
    >
      {children}
    </button>
  );
}

/* ──────── Input ──────── */
interface InputProps {
  label?: string;
  type?: string;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  maxLength?: number;
  suffix?: string;
  error?: string;
}

export function Input({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoFocus,
  maxLength,
  suffix,
  error,
}: InputProps) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
      {label && (
        <span
          style={{
            fontSize: 12,
            color: 'var(--ink-2)',
            fontWeight: 500,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
      )}
      <div style={{ position: 'relative', width: '100%' }}>
        <input
          type={type}
          className="input"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          maxLength={maxLength}
          style={suffix ? { paddingRight: 60 } : undefined}
        />
        {suffix && (
          <span
            style={{
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--ink-3)',
            }}
          >
            {suffix}
          </span>
        )}
      </div>
      {error && <span style={{ fontSize: 12, color: 'var(--crimson)' }}>{error}</span>}
    </label>
  );
}

/* ──────── Modal ──────── */
interface ModalProps {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  width?: number;
  dismissable?: boolean;
}

export function Modal({ open, onClose, children, width = 480, dismissable = true }: ModalProps) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={dismissable ? onClose : undefined}>
      <div
        className="panel-elevated fade-in-scale"
        style={{ width, maxWidth: 'calc(100vw - 48px)', padding: 32 }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/* ──────── Avatar ──────── */
interface AvatarProps {
  name?: string;
  size?: number;
  ring?: 'gold' | 'emerald' | null;
}

export function Avatar({ name, size = 36, ring }: AvatarProps) {
  const initials = (name || '?').slice(0, 2).toUpperCase();
  const hue = (name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `linear-gradient(135deg, oklch(45% 0.08 ${hue}), oklch(35% 0.08 ${hue}))`,
        border: ring ? `2px solid var(--${ring})` : `1.5px solid var(--border-strong)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--ink)',
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: size * 0.38,
        flexShrink: 0,
        boxShadow: ring ? `0 0 12px var(--${ring}-glow, transparent)` : 'none',
      }}
    >
      {initials}
    </div>
  );
}

/* ──────── Page wrapper ──────── */
export function Page({
  children,
  className = '',
  bg = 'bg-deep',
}: {
  children: ReactNode;
  className?: string;
  bg?: string;
}) {
  return <div className={`page ${bg} ${className}`}>{children}</div>;
}

/* ──────── Top bar (game) ──────── */
export function GameTopBar({
  leftLabel,
  rightContent,
  onBack,
}: {
  leftLabel?: string;
  rightContent?: ReactNode;
  onBack?: () => void;
}) {
  return (
    <div className="topnav">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid var(--border)',
              color: 'var(--ink)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 13,
              fontFamily: 'var(--font-body)',
            }}
          >
            ← Quitter
          </button>
        )}
        {leftLabel && (
          <span className="eyebrow" style={{ color: 'var(--ink-2)' }}>
            {leftLabel}
          </span>
        )}
      </div>
      <Logo size={22} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>{rightContent}</div>
    </div>
  );
}

/* ──────── Side rail (meta nav) ──────── */
interface SideRailProps {
  active: PageId;
  onNavigate?: (p: PageId) => void;
  user?: User | null;
  onLogout?: () => void;
}

export function SideRail({ active, onNavigate, user, onLogout }: SideRailProps) {
  const items: { id: PageId; label: string; icon: string }[] = [
    { id: 'lobby', label: 'Accueil', icon: '◆' },
    { id: 'rules', label: 'Règles', icon: '§' },
    { id: 'leaderboard', label: 'Classement', icon: '★' },
    { id: 'history', label: 'Historique', icon: '⌘' },
    { id: 'profile', label: 'Profil', icon: '◉' },
    { id: 'settings', label: 'Paramètres', icon: '⚙' },
  ];
  return (
    <div
      style={{
        width: 220,
        background: 'var(--bg-surface)',
        borderRight: '1.5px solid var(--border)',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      <div style={{ padding: '0 8px 24px', borderBottom: '1px solid var(--border)' }}>
        <Logo size={28} />
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--ink-3)',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            marginTop: 4,
          }}
        >
          Le jeu de mémoire
        </div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 16, flex: 1 }}>
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => onNavigate?.(it.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 12px',
              background: active === it.id ? 'rgba(200, 169, 110, 0.1)' : 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: active === it.id ? 'var(--gold-bright)' : 'var(--ink-2)',
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all var(--t-fast)',
              borderLeft: active === it.id ? '2px solid var(--gold)' : '2px solid transparent',
            }}
            onMouseEnter={(e) => {
              if (active !== it.id) e.currentTarget.style.color = 'var(--ink)';
            }}
            onMouseLeave={(e) => {
              if (active !== it.id) e.currentTarget.style.color = 'var(--ink-2)';
            }}
          >
            <span
              style={{
                width: 16,
                textAlign: 'center',
                color: active === it.id ? 'var(--gold)' : 'var(--ink-3)',
              }}
            >
              {it.icon}
            </span>
            {it.label}
          </button>
        ))}
      </nav>

      {user && (
        <div
          style={{
            borderTop: '1px solid var(--border)',
            paddingTop: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Avatar name={user.pseudo} size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--ink)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {user.pseudo}
            </div>
            <button
              onClick={onLogout}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--ink-3)',
                fontSize: 11,
                padding: 0,
                cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              Déconnexion
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────── ScoreBadge ──────── */
interface ScoreBadgeProps {
  score: string | number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'default' | 'gold' | 'danger';
}

export function ScoreBadge({ score, label, size = 'md', tone = 'default' }: ScoreBadgeProps) {
  const sizes = {
    sm: { fs: 18, p: '6px 12px' },
    md: { fs: 28, p: '10px 18px' },
    lg: { fs: 44, p: '16px 28px' },
  } as const;
  const s = sizes[size];
  const colors = {
    default: { bg: 'var(--bg-elevated)', border: 'var(--border)', color: 'var(--ink)' },
    gold: { bg: 'rgba(200, 169, 110, 0.1)', border: 'var(--gold)', color: 'var(--gold-bright)' },
    danger: { bg: 'rgba(192, 80, 74, 0.1)', border: 'var(--crimson)', color: 'var(--crimson)' },
  } as const;
  const c = colors[tone];
  return (
    <div
      style={{
        background: c.bg,
        border: `1.5px solid ${c.border}`,
        borderRadius: 'var(--radius)',
        padding: s.p,
        textAlign: 'center',
        minWidth: 80,
      }}
    >
      {label && (
        <div
          style={{
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--ink-2)',
            marginBottom: 2,
          }}
        >
          {label}
        </div>
      )}
      <div className="display" style={{ fontSize: s.fs, color: c.color, fontWeight: 700 }}>
        {score}
      </div>
    </div>
  );
}

/* ──────── Section heading ──────── */
interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  sub?: string;
  action?: ReactNode;
  level?: 'h1' | 'h2' | 'h3';
}

export function SectionHeading({ eyebrow, title, sub, action, level = 'h2' }: SectionHeadingProps) {
  const Tag = level;
  const sizes = { h1: 36, h2: 28, h3: 22 };
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 24,
        marginBottom: 8,
      }}
    >
      <div>
        {eyebrow && <div className="eyebrow" style={{ marginBottom: 6 }}>{eyebrow}</div>}
        <Tag className="display" style={{ fontSize: sizes[level], margin: 0, color: 'var(--ink)' }}>
          {title}
        </Tag>
        {sub && (
          <div style={{ color: 'var(--ink-2)', fontSize: 14, marginTop: 6, maxWidth: 540 }}>
            {sub}
          </div>
        )}
      </div>
      {action}
    </div>
  );
}

/* ──────── Tab strip ──────── */
interface TabsProps<T extends string> {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}

export function Tabs<T extends string>({ tabs, value, onChange }: TabsProps<T>) {
  return (
    <div style={{ display: 'flex', gap: 0, borderBottom: '1.5px solid var(--border)' }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '12px 18px',
            color: value === t.id ? 'var(--gold-bright)' : 'var(--ink-2)',
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            position: 'relative',
            transition: 'color var(--t-fast)',
          }}
        >
          {t.label}
          {value === t.id && (
            <div
              style={{
                position: 'absolute',
                bottom: -1.5,
                left: 0,
                right: 0,
                height: 2,
                background: 'var(--gold)',
              }}
            />
          )}
        </button>
      ))}
    </div>
  );
}
