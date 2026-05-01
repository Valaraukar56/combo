import { useEffect, useState, type ReactNode } from 'react';
import {
  Avatar,
  Button,
  Modal,
  Page,
  ScoreBadge,
  SectionHeading,
  SideRail,
} from '../components/ui';
import { PlayingCard } from '../components/Card';
import { useToast } from '../components/Toast';
import { useAuth } from '../lib/auth';
import { useGame } from '../lib/game';
import { api, type UserStats } from '../lib/api';
import type { Page as PageId } from '../types';

interface NavProps {
  onNavigate: (p: PageId) => void;
}

/* ──────── Main Lobby (after login) ──────── */
export function LobbyScreen({ onNavigate }: NavProps) {
  const { user, logout } = useAuth();
  const { createRoom, joinRoom } = useGame();
  const toast = useToast();
  const [showJoin, setShowJoin] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [stats, setStats] = useState<UserStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.myStats().then((s) => {
      if (!cancelled) setStats(s);
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleCreate = async (cfg: { maxPlayers: number; rounds: number; isPrivate: boolean; isSolo: boolean }) => {
    try {
      const code = await createRoom(cfg);
      setShowCreate(false);
      toast.push(`Salon ${code} créé.`, 'success');
    } catch (err) {
      toast.push(`Création impossible : ${(err as Error).message}`, 'danger');
    }
  };

  const handleJoin = async (code: string) => {
    try {
      await joinRoom(code);
      setShowJoin(false);
    } catch (err) {
      toast.push(`Salon introuvable ou plein.`, 'danger');
    }
  };

  const handleSolo = () => {
    handleCreate({ maxPlayers: 4, rounds: 1, isPrivate: true, isSolo: true });
  };

  return (
    <Page bg="bg-deep">
      <div style={{ display: 'flex', minHeight: '100%' }}>
        <SideRail active="lobby" onNavigate={onNavigate} user={user} onLogout={logout} />

        <div style={{ flex: 1, padding: '40px 56px', overflow: 'auto' }}>
          <SectionHeading
            eyebrow={`Bonjour, ${user?.pseudo ?? ''}`}
            title="Prêt à jouer ?"
            sub="Créez une partie privée pour vos amis, rejoignez-en une avec un code, ou affrontez l'IA en solo."
            level="h1"
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 20,
              marginTop: 40,
            }}
          >
            <ActionTile
              eyebrow="Créer"
              title="Nouvelle partie"
              desc="Invitez vos amis avec un code de salon. Vous choisissez les règles."
              cta="Créer une partie"
              accent="gold"
              onClick={() => setShowCreate(true)}
              cards={[
                { rank: 'A', suit: '♠', x: -28, y: 0, rot: -12 },
                { rank: 'A', suit: '♥', x: 0, y: -8, rot: 0 },
                { rank: 'A', suit: '♦', x: 28, y: 0, rot: 12 },
              ]}
            />
            <ActionTile
              eyebrow="Rejoindre"
              title="Code de partie"
              desc="Vous avez reçu un code à 4 lettres ? Rejoignez la partie en un clic."
              cta="Rejoindre →"
              accent="emerald"
              onClick={() => setShowJoin(true)}
              cards={[
                { rank: '7', suit: '♥', x: -16, y: 0, rot: -6 },
                { rank: '7', suit: '♣', x: 16, y: 0, rot: 6 },
              ]}
            />
            <ActionTile
              eyebrow="Solo"
              title="Contre l'IA"
              desc="Entraînez-vous contre 3 bots. Idéal pour apprendre."
              cta="Lancer en solo"
              accent="default"
              onClick={handleSolo}
              cards={[{ rank: 'K', suit: '♣', x: 0, y: 0, rot: 0, faceDown: true }]}
            />
          </div>

          {/* Stats */}
          <div style={{ marginTop: 56 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: 16,
              }}
            >
              <h3 className="display" style={{ fontSize: 22, margin: 0 }}>
                Vos statistiques
              </h3>
              <button
                onClick={() => onNavigate('history')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--gold)',
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                }}
              >
                Voir l'historique →
              </button>
            </div>
            <div
              style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}
            >
              <ScoreBadge score={stats?.gamesPlayed ?? '—'} label="Parties jouées" />
              <ScoreBadge
                score={stats?.gamesWon ?? '—'}
                label="Victoires"
                tone={stats && stats.gamesWon > 0 ? 'gold' : 'default'}
              />
              <ScoreBadge score={stats?.combosWon ?? '—'} label="Combos réussis" />
              <ScoreBadge
                score={stats?.snapsFailed ?? '—'}
                label="Snaps ratés"
                tone={stats && stats.snapsFailed > 0 ? 'danger' : 'default'}
              />
            </div>
          </div>
        </div>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)}>
        <CreateRoomForm onCancel={() => setShowCreate(false)} onCreate={handleCreate} />
      </Modal>
      <Modal open={showJoin} onClose={() => setShowJoin(false)}>
        <JoinRoomForm onCancel={() => setShowJoin(false)} onJoin={handleJoin} />
      </Modal>
    </Page>
  );
}

interface ActionTileProps {
  eyebrow: string;
  title: string;
  desc: string;
  cta: string;
  accent: 'gold' | 'emerald' | 'default';
  onClick: () => void;
  cards: { rank: string; suit: string; x: number; y: number; rot: number; faceDown?: boolean }[];
}

function ActionTile({ eyebrow, title, desc, cta, accent, onClick, cards }: ActionTileProps) {
  const [hover, setHover] = useState(false);
  const accentColor =
    accent === 'gold' ? 'var(--gold)' : accent === 'emerald' ? 'var(--emerald)' : 'var(--ink-2)';
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'var(--bg-surface)',
        border: '1.5px solid',
        borderColor: hover ? accentColor : 'var(--border)',
        borderRadius: 'var(--radius)',
        padding: 28,
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all var(--t)',
        position: 'relative',
        overflow: 'hidden',
        minHeight: 280,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hover ? 'var(--shadow-lg)' : 'var(--shadow-sm)',
        fontFamily: 'var(--font-body)',
        color: 'var(--ink)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          display: 'flex',
          height: 100,
          width: 100,
          opacity: hover ? 0.35 : 0.55,
          transition: 'opacity var(--t)',
          pointerEvents: 'none',
        }}
      >
        {cards?.map((c, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: 0,
              right: 50,
              transform: `translate(${c.x}px, ${c.y}px) rotate(${c.rot}deg)`,
            }}
          >
            <PlayingCard rank={c.rank} suit={c.suit} faceDown={c.faceDown} size="sm" />
          </div>
        ))}
      </div>

      <div style={{ position: 'relative' }}>
        <div className="eyebrow" style={{ color: accentColor, marginBottom: 6 }}>
          {eyebrow}
        </div>
        <h3
          className="display"
          style={{
            fontSize: 26,
            margin: '0 0 12px',
            color: hover ? accentColor : 'var(--ink)',
            transition: 'color var(--t)',
          }}
        >
          {title}
        </h3>
        <p
          style={{
            fontSize: 13,
            color: hover ? 'var(--ink)' : 'var(--ink-2)',
            margin: 0,
            lineHeight: 1.5,
            maxWidth: 260,
            transition: 'color var(--t)',
          }}
        >
          {desc}
        </p>
      </div>
      <div
        style={{
          color: accentColor,
          fontWeight: 600,
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          transform: hover ? 'translateX(4px)' : 'translateX(0)',
          transition: 'transform var(--t)',
          position: 'relative',
        }}
      >
        {cta}
      </div>
    </button>
  );
}

/* ──────── Create Room form ──────── */
interface CreateRoomFormProps {
  onCancel: () => void;
  onCreate: (cfg: { maxPlayers: number; rounds: number; isPrivate: boolean; isSolo: boolean }) => void;
}

function CreateRoomForm({ onCancel, onCreate }: CreateRoomFormProps) {
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [rounds, setRounds] = useState(5);

  return (
    <>
      <SectionHeading eyebrow="Nouvelle partie" title="Configurer le salon" level="h2" />
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 24 }}
      >
        <Field label="Nombre de joueurs">
          <SegmentedChoice
            value={maxPlayers}
            options={[
              { v: 2, label: '2' },
              { v: 3, label: '3' },
              { v: 4, label: '4' },
            ]}
            onChange={setMaxPlayers}
          />
        </Field>
        <Field label="Manches">
          <SegmentedChoice
            value={rounds}
            options={[
              { v: 1, label: '1' },
              { v: 3, label: '3' },
              { v: 5, label: '5' },
              { v: 7, label: '7' },
            ]}
            onChange={setRounds}
          />
        </Field>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>
          Le salon est privé : seuls les joueurs avec le code peuvent rejoindre.
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginTop: 32,
          justifyContent: 'flex-end',
        }}
      >
        <Button variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
        <Button
          variant="primary"
          onClick={() => onCreate({ maxPlayers, rounds, isPrivate: true, isSolo: false })}
        >
          Créer le salon →
        </Button>
      </div>
    </>
  );
}

/* ──────── Join Room form ──────── */
function JoinRoomForm({
  onCancel,
  onJoin,
}: {
  onCancel: () => void;
  onJoin: (code: string) => void;
}) {
  const [code, setCode] = useState('');
  const submit = () => {
    if (code.length === 4) onJoin(code.toUpperCase());
  };
  return (
    <>
      <SectionHeading
        eyebrow="Rejoindre"
        title="Code de partie"
        sub="Saisissez le code à 4 lettres reçu par votre hôte."
        level="h2"
      />
      <div style={{ marginTop: 28 }}>
        <input
          autoFocus
          value={code}
          onChange={(e) =>
            setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))
          }
          placeholder="XXXX"
          maxLength={4}
          style={{
            width: '100%',
            background: 'var(--bg-deep)',
            border: '1.5px solid var(--border-strong)',
            borderRadius: 'var(--radius-sm)',
            padding: '24px 18px',
            fontFamily: 'var(--font-mono)',
            fontSize: 48,
            letterSpacing: '0.4em',
            textAlign: 'center',
            color: 'var(--gold-bright)',
            outline: 'none',
            textTransform: 'uppercase',
          }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
      </div>
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginTop: 24,
          justifyContent: 'flex-end',
        }}
      >
        <Button variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
        <Button variant="primary" onClick={submit} disabled={code.length !== 4}>
          Rejoindre →
        </Button>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--ink-2)',
          fontWeight: 500,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

interface SegmentedChoiceProps<T extends string | number> {
  value: T;
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
}

function SegmentedChoice<T extends string | number>({
  value,
  options,
  onChange,
}: SegmentedChoiceProps<T>) {
  return (
    <div
      style={{
        display: 'flex',
        background: 'var(--bg-deep)',
        border: '1.5px solid var(--border-strong)',
        borderRadius: 'var(--radius-sm)',
        padding: 3,
        gap: 2,
      }}
    >
      {options.map((o) => (
        <button
          key={String(o.v)}
          onClick={() => onChange(o.v)}
          style={{
            flex: 1,
            background: value === o.v ? 'var(--gold)' : 'transparent',
            color: value === o.v ? 'var(--ink-dark)' : 'var(--ink)',
            border: 'none',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all var(--t-fast)',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ──────── Waiting Room ──────── */
export function WaitingRoomScreen() {
  const { user } = useAuth();
  const { roomState, setReady, startGame, leaveRoom } = useGame();
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  if (!roomState) return null;

  const me = roomState.players.find((p) => p.id === user?.id);
  const isHost = !!me?.isHost;
  const ready = !!me?.ready;
  const allReady = roomState.players.every((p) => p.ready || p.isBot);
  const enoughPlayers = roomState.players.length >= 2 || roomState.config.isSolo;

  const copyCode = () => {
    navigator.clipboard?.writeText(roomState.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Page bg="bg-deep">
      <div
        style={{
          minHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 40,
        }}
      >
        <button
          onClick={() => leaveRoom()}
          style={{
            position: 'absolute',
            top: 24,
            left: 24,
            background: 'rgba(0,0,0,0.4)',
            border: '1px solid var(--border)',
            color: 'var(--ink-2)',
            borderRadius: 'var(--radius-sm)',
            padding: '8px 14px',
            cursor: 'pointer',
            fontSize: 13,
            fontFamily: 'var(--font-body)',
          }}
        >
          ← Quitter le salon
        </button>

        <div style={{ width: '100%', maxWidth: 720, textAlign: 'center' }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            Salon — En attente
          </div>
          <h1 className="display" style={{ fontSize: 44, margin: 0 }}>
            {isHost
              ? 'Votre salon est ouvert'
              : `Salon de ${roomState.players.find((p) => p.isHost)?.pseudo ?? '…'}`}
          </h1>

          <div
            style={{
              marginTop: 32,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div className="eyebrow">Partagez ce code</div>
            <button
              onClick={copyCode}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 56,
                letterSpacing: '0.4em',
                color: 'var(--gold-bright)',
                background: 'var(--bg-elevated)',
                border: '1.5px dashed var(--gold)',
                borderRadius: 'var(--radius)',
                padding: '20px 40px',
                cursor: 'pointer',
                transition: 'all var(--t)',
                position: 'relative',
              }}
            >
              {roomState.code}
              <span
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 12,
                  fontFamily: 'var(--font-body)',
                  fontSize: 11,
                  color: 'var(--ink-2)',
                  letterSpacing: '0.1em',
                }}
              >
                {copied ? '✓ COPIÉ' : 'CLIC = COPIER'}
              </span>
            </button>
          </div>

          <div style={{ marginTop: 48 }}>
            <div className="eyebrow" style={{ marginBottom: 16 }}>
              {roomState.players.length}/{roomState.config.maxPlayers} joueurs
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${roomState.config.maxPlayers}, 1fr)`,
                gap: 12,
              }}
            >
              {Array.from({ length: roomState.config.maxPlayers }).map((_, i) => {
                const p = roomState.players[i];
                if (!p)
                  return (
                    <div
                      key={i}
                      style={{
                        border: '1.5px dashed var(--border)',
                        borderRadius: 'var(--radius)',
                        padding: 24,
                        color: 'var(--ink-3)',
                        fontSize: 13,
                        textAlign: 'center',
                        fontFamily: 'var(--font-body)',
                        background: 'rgba(0,0,0,0.2)',
                        minHeight: 130,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      En attente…
                    </div>
                  );
                return (
                  <div
                    key={p.id}
                    style={{
                      background: p.ready ? 'rgba(111, 160, 116, 0.06)' : 'var(--bg-surface)',
                      border: '1.5px solid',
                      borderColor: p.ready ? 'var(--emerald)' : 'var(--border)',
                      borderRadius: 'var(--radius)',
                      padding: 20,
                      transition: 'all var(--t)',
                      minHeight: 130,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <Avatar name={p.pseudo} size={48} ring={p.ready ? 'emerald' : null} />
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{p.pseudo}</div>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}
                    >
                      {p.isHost && (
                        <span
                          style={{
                            color: 'var(--gold)',
                            fontFamily: 'var(--font-mono)',
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                          }}
                        >
                          Hôte
                        </span>
                      )}
                      {p.isBot && (
                        <span
                          style={{
                            color: 'var(--ink-2)',
                            fontFamily: 'var(--font-mono)',
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                          }}
                        >
                          Bot
                        </span>
                      )}
                      {(p.isHost || p.isBot) && <span style={{ color: 'var(--ink-3)' }}>·</span>}
                      <span className={`status-dot ${p.ready ? 'ready' : 'idle'}`} />
                      <span
                        style={{
                          color: p.ready ? 'var(--emerald)' : 'var(--ink-3)',
                          fontFamily: 'var(--font-mono)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.1em',
                        }}
                      >
                        {p.ready ? 'Prêt' : 'Pas prêt'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            style={{
              marginTop: 40,
              display: 'flex',
              gap: 12,
              justifyContent: 'center',
            }}
          >
            <Button
              variant={ready ? 'ghost' : 'primary'}
              size="lg"
              onClick={() => setReady(!ready).catch(() => toast.push('Erreur', 'danger'))}
            >
              {ready ? '✓ Prêt — Annuler' : 'Je suis prêt'}
            </Button>
            {isHost && (
              <Button
                variant="primary"
                size="lg"
                disabled={!allReady || !enoughPlayers}
                onClick={() => startGame().catch(() => toast.push('Erreur de lancement', 'danger'))}
              >
                {!enoughPlayers
                  ? 'Au moins 2 joueurs requis'
                  : !allReady
                  ? 'En attente des joueurs…'
                  : 'Lancer la partie →'}
              </Button>
            )}
          </div>

          <div
            style={{
              marginTop: 24,
              fontSize: 13,
              color: 'var(--ink-3)',
              fontStyle: 'italic',
              fontFamily: 'var(--font-display)',
            }}
          >
            "La mémoire est l'arme de ceux qui osent."
          </div>
        </div>
      </div>
    </Page>
  );
}
