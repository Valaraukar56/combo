import { Avatar, Button, GameTopBar, Page } from '../components/ui';
import { PlayingCard } from '../components/Card';
import { useAuth } from '../lib/auth';
import { useGame } from '../lib/game';

/* ──────── End of Round ──────── */
export function EndRoundScreen() {
  const { user } = useAuth();
  const { roomState, roundResults, leaveRoom } = useGame();
  if (!roomState || !user) return null;

  const sorted = [...(roundResults ?? [])].sort((a, b) => a.totalScore - b.totalScore);

  return (
    <Page bg="bg-deep">
      <GameTopBar
        leftLabel={`Salon ${roomState.code}`}
        onBack={() => leaveRoom()}
        rightContent={
          <span className="eyebrow" style={{ color: 'var(--gold)' }}>
            Manche {roomState.round} / {roomState.config.rounds}
          </span>
        }
      />

      <div
        style={{
          minHeight: '100%',
          padding: '90px 56px 56px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div className="eyebrow" style={{ color: 'var(--gold)', marginBottom: 8 }}>
          Fin de manche
        </div>
        <h1 className="display" style={{ fontSize: 48, margin: 0, color: 'var(--ink)' }}>
          Décompte des points
        </h1>
        <div
          style={{
            marginTop: 8,
            color: 'var(--ink-2)',
            fontSize: 15,
            fontStyle: 'italic',
            fontFamily: 'var(--font-display)',
          }}
        >
          Le score le plus bas l'emporte. Manche suivante dans 6s…
        </div>

        <div
          style={{
            marginTop: 40,
            width: '100%',
            maxWidth: 880,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {sorted.map((p, i) => {
            const isWinner = i === 0;
            const isMe = p.playerId === user.id;
            return (
              <div
                key={p.playerId}
                className="slide-up"
                style={{
                  background: isWinner ? 'rgba(200, 169, 110, 0.06)' : 'var(--bg-surface)',
                  border: '1.5px solid',
                  borderColor: isWinner
                    ? 'var(--gold)'
                    : isMe
                    ? 'var(--border-strong)'
                    : 'var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '20px 24px',
                  display: 'grid',
                  gridTemplateColumns: '60px 200px 1fr 140px',
                  alignItems: 'center',
                  gap: 24,
                  animationDelay: i * 80 + 'ms',
                  animationFillMode: 'backwards',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 32,
                    fontWeight: 700,
                    color: isWinner ? 'var(--gold-bright)' : 'var(--ink-3)',
                    textAlign: 'center',
                  }}
                >
                  {i + 1}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar name={p.pseudo} size={36} ring={isWinner ? 'gold' : null} />
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>
                      {p.pseudo}{' '}
                      {isMe && (
                        <span
                          style={{
                            color: 'var(--ink-3)',
                            fontSize: 12,
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          (vous)
                        </span>
                      )}
                    </div>
                    {p.isComboCaller && (
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--gold)',
                          fontFamily: 'var(--font-mono)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.1em',
                        }}
                      >
                        A crié Combo
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {p.cards.map((c, j) => (
                    <PlayingCard key={j} rank={c.rank} suit={c.suit} size="sm" />
                  ))}
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: 4,
                  }}
                >
                  {p.comboPenalty > 0 && (
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--crimson)',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      +{p.comboPenalty} pénalité
                    </div>
                  )}
                  <div
                    className="display"
                    style={{
                      fontSize: 32,
                      color: isWinner ? 'var(--gold-bright)' : 'var(--ink)',
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                  >
                    {p.score}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--ink-3)',
                      fontFamily: 'var(--font-mono)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                    }}
                  >
                    Total : {p.totalScore} pts
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Page>
  );
}

/* ──────── End of Game (final ranking) ──────── */
export function EndGameScreen({ onBackLobby }: { onBackLobby: () => void }) {
  const { user } = useAuth();
  const { roomState, finalResults, leaveRoom } = useGame();
  if (!roomState || !user) return null;

  const sorted = [...(finalResults ?? [])].sort((a, b) => a.totalScore - b.totalScore);
  const champion = sorted[0];
  const isViewerWinner = !!champion && champion.playerId === user.id;

  const handleBack = async () => {
    await leaveRoom();
    onBackLobby();
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
          padding: 56,
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '20%',
            left: '10%',
            transform: 'rotate(-15deg)',
            opacity: 0.08,
          }}
        >
          <PlayingCard rank="A" suit="♠" size="lg" />
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: '15%',
            right: '10%',
            transform: 'rotate(20deg)',
            opacity: 0.08,
          }}
        >
          <PlayingCard rank="K" suit="♥" size="lg" />
        </div>

        {champion && (
          <div
            style={{
              textAlign: 'center',
              marginBottom: 48,
              position: 'relative',
              zIndex: 1,
            }}
          >
            <div
              className="eyebrow"
              style={{ color: 'var(--gold)', marginBottom: 12 }}
            >
              {isViewerWinner ? 'Vous remportez la partie' : 'Vainqueur'}
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <Avatar name={champion.pseudo} size={88} ring="gold" />
              <h1
                className="display-italic"
                style={{
                  fontSize: isViewerWinner ? 128 : 88,
                  color: 'var(--gold-bright)',
                  margin: 0,
                  lineHeight: 0.95,
                  textShadow: '0 4px 40px rgba(200, 169, 110, 0.45)',
                  letterSpacing: isViewerWinner ? '0.02em' : 'normal',
                }}
              >
                {isViewerWinner ? 'Victoire' : champion.pseudo}
              </h1>
              <div
                style={{
                  color: 'var(--ink-2)',
                  fontSize: 17,
                  fontStyle: 'italic',
                  fontFamily: 'var(--font-display)',
                }}
              >
                {isViewerWinner
                  ? `${champion.totalScore} points — bravo ${champion.pseudo}`
                  : `${champion.totalScore} points`}
              </div>
            </div>
          </div>
        )}

        <div
          style={{
            width: '100%',
            maxWidth: 720,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            position: 'relative',
            zIndex: 1,
          }}
        >
          {sorted.map((p, i) => {
            const isMe = p.playerId === user.id;
            return (
              <div
                key={p.playerId}
                className="fade-in"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 40px 1fr 80px',
                  gap: 16,
                  alignItems: 'center',
                  padding: '14px 20px',
                  background: i === 0 ? 'rgba(200, 169, 110, 0.06)' : 'var(--bg-surface)',
                  border: '1px solid',
                  borderColor: i === 0 ? 'var(--gold)' : 'var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  animationDelay: i * 100 + 'ms',
                  animationFillMode: 'backwards',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 24,
                    fontWeight: 700,
                    color: i === 0 ? 'var(--gold-bright)' : 'var(--ink-3)',
                  }}
                >
                  {i + 1}
                </div>
                <Avatar name={p.pseudo} size={32} />
                <div style={{ fontSize: 14, fontWeight: 500 }}>
                  {p.pseudo}{' '}
                  {isMe && (
                    <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>(vous)</span>
                  )}
                </div>
                <div
                  className="display"
                  style={{
                    fontSize: 22,
                    color: i === 0 ? 'var(--gold-bright)' : 'var(--ink)',
                    fontWeight: 700,
                    textAlign: 'right',
                  }}
                >
                  {p.totalScore}
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 40,
            display: 'flex',
            gap: 12,
            position: 'relative',
            zIndex: 1,
          }}
        >
          <Button variant="primary" size="lg" onClick={handleBack}>
            Retour à l'accueil →
          </Button>
        </div>
      </div>
    </Page>
  );
}
