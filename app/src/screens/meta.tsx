import { Children, useEffect, useState, type ReactNode } from 'react';
import {
  Avatar,
  Button,
  Input,
  Page,
  ScoreBadge,
  SectionHeading,
  SideRail,
  Tabs,
} from '../components/ui';
import { PlayingCard } from '../components/Card';
import { useToast } from '../components/Toast';
import { useAuth } from '../lib/auth';
import { api, type HistoryEntry, type LeaderboardEntry, type UserStats } from '../lib/api';
import type { Page as PageId } from '../types';

interface NavProps {
  onNavigate: (p: PageId) => void;
}

/* ──────── Rules ──────── */
export function RulesScreen({ onNavigate }: NavProps) {
  const { user, logout } = useAuth();
  return (
    <Page bg="bg-deep">
      <div style={{ display: 'flex', minHeight: '100%' }}>
        <SideRail active="rules" onNavigate={onNavigate} user={user} onLogout={logout} />
        <div style={{ flex: 1, padding: '40px 56px', overflow: 'auto' }}>
          <SectionHeading
            eyebrow="Le manuel"
            title="Règles du jeu"
            sub="Combo se joue en plusieurs manches. À chaque manche, le score le plus bas l'emporte."
            level="h1"
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 28,
              marginTop: 40,
            }}
          >
            <RuleCard
              num="1"
              title="Distribution"
              body="Chaque joueur reçoit 4 cartes face cachée. Au début de la manche, vous mémorisez secrètement vos 2 cartes du bas pendant 6 secondes."
            />
            <RuleCard
              num="2"
              title="Tour de jeu"
              body="À votre tour, piochez dans la pile ou la défausse. Vous pouvez ensuite échanger la carte avec une de vos 4 cartes, ou la défausser directement."
            />
            <RuleCard
              num="3"
              title="Snap (claque)"
              body="À tout moment pendant la partie, vous pouvez défausser une de vos cartes du même rang que la défausse. Réussi = elle disparaît. Raté = +1 carte de pénalité."
            />
            <RuleCard
              num="4"
              title="Crier Combo"
              body="Au début de votre tour (avant de piocher), criez 'Combo' si vous pensez avoir le score le plus bas. Tous les autres joueurs jouent un dernier tour, puis tout le monde révèle. Vous gagnez la manche uniquement si votre score est strictement le plus bas — en cas d'égalité avec un autre joueur, vous prenez +10 pts de pénalité et c'est l'autre joueur qui gagne."
            />
          </div>

          <h2 className="display" style={{ fontSize: 28, marginTop: 56, marginBottom: 20 }}>
            Pouvoirs des cartes
          </h2>
          <p
            style={{
              fontSize: 13,
              color: 'var(--ink-2)',
              marginBottom: 16,
              fontStyle: 'italic',
            }}
          >
            Seules les <strong style={{ color: 'var(--red)' }}>têtes rouges (♦/♥)</strong> activent
            un pouvoir lorsqu'elles sont posées sur la défausse (depuis la pioche, pas depuis la
            défausse).
          </p>
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}
          >
            {[
              {
                rank: 'J',
                label: 'Valet rouge',
                desc: "Regardez secrètement l'une de vos cartes.",
              },
              {
                rank: 'Q',
                label: 'Dame rouge',
                desc: "Regardez secrètement la carte d'un adversaire.",
              },
              {
                rank: 'K',
                label: 'Roi rouge',
                desc: "Échangez une de vos cartes avec celle d'un adversaire (sans regarder).",
              },
            ].map((p) => (
              <div
                key={p.rank}
                className="panel"
                style={{ display: 'flex', gap: 16, alignItems: 'center' }}
              >
                <PlayingCard rank={p.rank} suit="♥" size="md" />
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 13,
                      fontFamily: 'var(--font-mono)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                    }}
                  >
                    <span style={{ color: 'var(--ink-2)' }}>{p.rank}</span>
                    <span style={{ color: 'var(--red)', fontSize: 16 }}>♥</span>
                    <span style={{ color: 'var(--ink-3)' }}>/</span>
                    <span style={{ color: 'var(--red)', fontSize: 16 }}>♦</span>
                  </div>
                  <div className="display" style={{ fontSize: 18, marginTop: 4 }}>
                    {p.label}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--ink-2)',
                      marginTop: 6,
                      lineHeight: 1.5,
                    }}
                  >
                    {p.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <h2 className="display" style={{ fontSize: 28, marginTop: 56, marginBottom: 20 }}>
            Comptage des points
          </h2>
          <div
            className="panel"
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <Row label="As" value="0 pt" tone="gold" />
            <Row label="2 — 10" value="Valeur faciale" />
            <Row label="Valet" value="11 pts" />
            <Row label="Dame" value="12 pts" />
            <Row label="Roi" value="13 pts" />
          </div>
        </div>
      </div>
    </Page>
  );
}

function RuleCard({ num, title, body }: { num: string; title: string; body: string }) {
  return (
    <div className="panel">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <span
          className="display"
          style={{
            fontSize: 36,
            color: 'var(--gold-bright)',
            fontStyle: 'italic',
            lineHeight: 1,
          }}
        >
          {num}
        </span>
        <h3 className="display" style={{ fontSize: 22, margin: 0 }}>
          {title}
        </h3>
      </div>
      <p style={{ marginTop: 12, color: 'var(--ink-2)', lineHeight: 1.6, fontSize: 14 }}>
        {body}
      </p>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'gold' }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 4px',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <span style={{ color: 'var(--ink)', fontSize: 14 }}>{label}</span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          color: tone === 'gold' ? 'var(--gold-bright)' : 'var(--ink-2)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

/* ──────── Leaderboard ──────── */
export function LeaderboardScreen({ onNavigate }: NavProps) {
  const { user, logout } = useAuth();
  const [scope, setScope] = useState<'global'>('global');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .leaderboard(50)
      .then((res) => {
        if (!cancelled) setEntries(res.entries);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const podium = entries.slice(0, 3);

  return (
    <Page bg="bg-deep">
      <div style={{ display: 'flex', minHeight: '100%' }}>
        <SideRail active="leaderboard" onNavigate={onNavigate} user={user} onLogout={logout} />
        <div style={{ flex: 1, padding: '40px 56px', overflow: 'auto' }}>
          <SectionHeading
            eyebrow="Hall of fame"
            title="Classement"
            sub="Les meilleurs joueurs Combo, classés par victoires."
            level="h1"
          />

          <div style={{ marginTop: 32, marginBottom: 24 }}>
            <Tabs<'global'>
              tabs={[{ id: 'global', label: 'Global' }]}
              value={scope}
              onChange={setScope}
            />
          </div>

          {loading ? (
            <div style={{ color: 'var(--ink-3)', fontStyle: 'italic' }}>Chargement…</div>
          ) : entries.length === 0 ? (
            <EmptyState
              title="Aucune partie terminée pour l'instant"
              sub="Le classement se construit au fur et à mesure que des parties se terminent. Lancez-en une !"
            />
          ) : (
            <>
              {podium.length > 0 && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: 16,
                    marginBottom: 32,
                    alignItems: 'end',
                  }}
                >
                  {arrangePodium(podium).map((p, idx) => {
                    if (!p) return <div key={idx} />;
                    const positions = [2, 1, 3] as const;
                    const realPos = positions[idx];
                    const heights: Record<1 | 2 | 3, number> = { 1: 200, 2: 160, 3: 140 };
                    const colors: Record<1 | 2 | 3, string> = {
                      1: 'var(--gold)',
                      2: '#b8c0c8',
                      3: '#b87a4a',
                    };
                    return (
                      <div
                        key={p.userId}
                        style={{
                          height: heights[realPos],
                          background:
                            realPos === 1 ? 'rgba(200, 169, 110, 0.06)' : 'var(--bg-surface)',
                          border: `1.5px solid ${colors[realPos]}`,
                          borderRadius: 'var(--radius)',
                          padding: 20,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          position: 'relative',
                        }}
                      >
                        <div
                          className="display-italic"
                          style={{
                            position: 'absolute',
                            top: 12,
                            left: 16,
                            fontSize: 56,
                            color: colors[realPos],
                            lineHeight: 0.9,
                            opacity: 0.7,
                          }}
                        >
                          {realPos}
                        </div>
                        <Avatar name={p.pseudo} size={48} ring={realPos === 1 ? 'gold' : null} />
                        <div style={{ fontWeight: 600, fontSize: 16, marginTop: 8 }}>
                          {p.pseudo}
                        </div>
                        <div
                          className="display"
                          style={{
                            fontSize: 20,
                            color: colors[realPos],
                            fontWeight: 700,
                            marginTop: 4,
                          }}
                        >
                          {p.gamesWon} V
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="panel" style={{ padding: 0 }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '60px 1fr 100px 100px 100px',
                    gap: 16,
                    padding: '12px 20px',
                    borderBottom: '1px solid var(--border)',
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: 'var(--ink-3)',
                  }}
                >
                  <span>Rang</span>
                  <span>Joueur</span>
                  <span style={{ textAlign: 'right' }}>Parties</span>
                  <span style={{ textAlign: 'right' }}>Combos</span>
                  <span style={{ textAlign: 'right' }}>Victoires</span>
                </div>
                {entries.map((p) => (
                  <div
                    key={p.userId}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '60px 1fr 100px 100px 100px',
                      gap: 16,
                      padding: '12px 20px',
                      borderBottom: '1px solid var(--border-subtle)',
                      background: p.isMe ? 'rgba(200, 169, 110, 0.04)' : 'transparent',
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 18,
                        color: p.rank <= 3 ? 'var(--gold-bright)' : 'var(--ink-3)',
                        fontWeight: 700,
                      }}
                    >
                      {p.rank}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar name={p.pseudo} size={28} />
                      <span style={{ fontSize: 14, fontWeight: 500 }}>
                        {p.pseudo}{' '}
                        {p.isMe && (
                          <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>(vous)</span>
                        )}
                      </span>
                    </div>
                    <span
                      style={{
                        textAlign: 'right',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 13,
                        color: 'var(--ink-2)',
                      }}
                    >
                      {p.gamesPlayed}
                    </span>
                    <span
                      style={{
                        textAlign: 'right',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 13,
                        color: 'var(--ink-2)',
                      }}
                    >
                      {p.combosWon}
                    </span>
                    <span
                      style={{
                        textAlign: 'right',
                        fontFamily: 'var(--font-display)',
                        fontSize: 17,
                        fontWeight: 700,
                        color: p.isMe ? 'var(--gold-bright)' : 'var(--ink)',
                      }}
                    >
                      {p.gamesWon}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </Page>
  );
}

function arrangePodium(top3: LeaderboardEntry[]): (LeaderboardEntry | undefined)[] {
  // Display order on screen: [2nd, 1st, 3rd]
  return [top3[1], top3[0], top3[2]];
}

/* ──────── History ──────── */
export function HistoryScreen({ onNavigate }: NavProps) {
  const { user, logout } = useAuth();
  const [games, setGames] = useState<HistoryEntry[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([api.history(50), api.myStats()])
      .then(([h, s]) => {
        if (cancelled) return;
        setGames(h.games);
        setStats(s);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return (
    <Page bg="bg-deep">
      <div style={{ display: 'flex', minHeight: '100%' }}>
        <SideRail active="history" onNavigate={onNavigate} user={user} onLogout={logout} />
        <div style={{ flex: 1, padding: '40px 56px', overflow: 'auto' }}>
          <SectionHeading
            eyebrow="Vos parties"
            title="Historique"
            sub="Toutes vos parties passées, gagnées comme perdues."
            level="h1"
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 12,
              marginTop: 32,
              marginBottom: 32,
            }}
          >
            <ScoreBadge score={stats?.gamesPlayed ?? '—'} label="Parties jouées" />
            <ScoreBadge
              score={stats?.gamesWon ?? '—'}
              label="Victoires"
              tone={stats && stats.gamesWon > 0 ? 'gold' : 'default'}
            />
            <ScoreBadge score={stats ? `${stats.winRate}%` : '—'} label="Taux de victoire" />
          </div>

          {loading ? (
            <div style={{ color: 'var(--ink-3)', fontStyle: 'italic' }}>Chargement…</div>
          ) : games.length === 0 ? (
            <EmptyState
              title="Pas encore d'historique"
              sub="Jouez votre première partie pour commencer à remplir cette page."
            />
          ) : (
            <div className="panel" style={{ padding: 0 }}>
              {games.map((g, i) => (
                <div
                  key={g.gameId}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '24px 1fr 200px 80px 80px',
                    gap: 16,
                    padding: '16px 20px',
                    borderBottom:
                      i < games.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    alignItems: 'center',
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: g.won ? 'var(--emerald)' : 'var(--ink-3)',
                      boxShadow: g.won ? '0 0 8px var(--emerald-glow)' : 'none',
                    }}
                  />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{formatDate(g.finishedAt)}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>
                      vs {g.players.filter((p) => p.pseudo !== user?.pseudo).map((p) => p.pseudo).join(', ') || '—'}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--ink-2)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                    }}
                  >
                    {g.mode === 'solo' ? 'Solo IA' : 'Multijoueur'} · {g.roundsCount} manches
                  </div>
                  <div
                    className="display"
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      color: g.won ? 'var(--gold-bright)' : 'var(--ink)',
                      textAlign: 'right',
                    }}
                  >
                    {g.myScore}
                  </div>
                  <div
                    style={{
                      textAlign: 'right',
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      color: g.won ? 'var(--emerald)' : 'var(--crimson)',
                    }}
                  >
                    {g.won ? 'Victoire' : 'Défaite'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
  if (sameDay) return `Aujourd'hui · ${time}`;
  if (isYesterday) return `Hier · ${time}`;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) + ` · ${time}`;
}

/* ──────── Profile ──────── */
export function ProfileScreen({ onNavigate }: NavProps) {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (!user) return;
    api.myStats().then(setStats).catch(() => {});
  }, [user?.id]);

  if (!user) return null;

  return (
    <Page bg="bg-deep">
      <div style={{ display: 'flex', minHeight: '100%' }}>
        <SideRail active="profile" onNavigate={onNavigate} user={user} onLogout={logout} />
        <div style={{ flex: 1, padding: '40px 56px', overflow: 'auto' }}>
          <SectionHeading eyebrow="Votre compte" title="Profil" level="h1" />

          <div
            className="panel"
            style={{ marginTop: 32, display: 'flex', alignItems: 'center', gap: 24 }}
          >
            <Avatar name={user.pseudo} size={88} ring="gold" />
            <div style={{ flex: 1 }}>
              <div className="display" style={{ fontSize: 32 }}>
                {user.pseudo}
              </div>
              <div style={{ display: 'flex', gap: 24, marginTop: 12 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    color: 'var(--ink-3)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}
                >
                  {stats ? `${stats.gamesPlayed} partie${stats.gamesPlayed > 1 ? 's' : ''}` : '—'}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    color: 'var(--ink-3)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}
                >
                  {stats ? `${stats.totalScore} pts cumulés` : '—'}
                </span>
              </div>
            </div>
          </div>

          <h3 className="display" style={{ fontSize: 22, margin: '40px 0 16px' }}>
            Statistiques
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <ScoreBadge score={stats?.gamesPlayed ?? '—'} label="Parties" />
            <ScoreBadge
              score={stats?.gamesWon ?? '—'}
              label="Victoires"
              tone={stats && stats.gamesWon > 0 ? 'gold' : 'default'}
            />
            <ScoreBadge score={stats?.combosWon ?? '—'} label="Combos OK" />
            <ScoreBadge
              score={stats?.snapsFailed ?? '—'}
              label="Snaps ratés"
              tone={stats && stats.snapsFailed > 0 ? 'danger' : 'default'}
            />
          </div>

          <div
            className="panel"
            style={{
              marginTop: 32,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              maxWidth: 480,
            }}
          >
            <div className="eyebrow">Pseudo</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{user.pseudo}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
              Le pseudo n'est pas modifiable pour l'instant. Pour changer, contactez le support.
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <Button variant="ghost" onClick={() => { logout(); toast.push('Déconnecté.'); }}>
                Se déconnecter
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
}

function EmptyState({ title, sub }: { title: string; sub: string }) {
  return (
    <div
      className="panel"
      style={{
        textAlign: 'center',
        padding: '40px 24px',
        color: 'var(--ink-2)',
      }}
    >
      <div className="display" style={{ fontSize: 22, color: 'var(--ink)' }}>
        {title}
      </div>
      <div style={{ marginTop: 8, fontSize: 14, fontStyle: 'italic', fontFamily: 'var(--font-display)' }}>
        {sub}
      </div>
    </div>
  );
}

/* ──────── Settings ──────── */
export function SettingsScreen({ onNavigate }: NavProps) {
  const { user, logout } = useAuth();
  const toast = useToast();

  if (!user) return null;

  return (
    <Page bg="bg-deep">
      <div style={{ display: 'flex', minHeight: '100%' }}>
        <SideRail active="settings" onNavigate={onNavigate} user={user} onLogout={logout} />
        <div style={{ flex: 1, padding: '40px 56px', overflow: 'auto' }}>
          <SectionHeading eyebrow="Préférences" title="Paramètres" level="h1" />

          <div
            style={{
              marginTop: 32,
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
              maxWidth: 640,
            }}
          >
            <SettingsGroup title="Compte">
              <div
                style={{
                  padding: '14px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--crimson)' }}>
                    Supprimer mon compte
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>
                    Action irréversible.
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toast.push('Suppression non implémentée.', 'danger')}
                >
                  Supprimer…
                </Button>
              </div>
            </SettingsGroup>
          </div>
        </div>
      </div>
    </Page>
  );
}

function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  const arr = Children.toArray(children);
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        {title}
      </div>
      <div className="panel" style={{ padding: 0 }}>
        {arr.map((child, i) => (
          <div
            key={i}
            style={{
              borderBottom: i < arr.length - 1 ? '1px solid var(--border-subtle)' : 'none',
            }}
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}

