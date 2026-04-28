import { useEffect, useState, type ReactNode } from 'react';
import { Avatar, Button, GameTopBar, Modal, Page, SectionHeading } from '../components/ui';
import { PlayingCard } from '../components/Card';
import { useToast } from '../components/Toast';
import { useAuth } from '../lib/auth';
import { useGame, type PublicPlayer } from '../lib/game';
import type { Card } from '../types';

/* ──────── Memorize phase ──────── */
export function MemorizeScreen() {
  const { roomState, privateHand } = useGame();
  const [progress, setProgress] = useState(100);

  // Drive a 6-second visual countdown locally; phase is server-controlled.
  useEffect(() => {
    if (roomState?.phase !== 'memorize') return;
    setProgress(100);
    const start = Date.now();
    let raf = 0;
    const tick = () => {
      const elapsed = Date.now() - start;
      const p = Math.max(0, 100 - (elapsed / 6000) * 100);
      setProgress(p);
      if (p > 0) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [roomState?.phase]);

  if (!roomState) return null;

  const knownCount = privateHand.filter((c) => c).length;

  return (
    <Page bg="bg-felt">
      <GameTopBar
        leftLabel={`Salon ${roomState.code}`}
        rightContent={
          <span className="eyebrow" style={{ color: 'var(--gold)' }}>
            Manche {roomState.round} / {roomState.config.rounds}
          </span>
        }
      />

      <div
        style={{
          minHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 40,
          position: 'relative',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div className="eyebrow" style={{ color: 'var(--gold)', marginBottom: 10 }}>
            Phase de mémorisation
          </div>
          <h1 className="display" style={{ fontSize: 56, margin: 0, color: 'var(--ink)' }}>
            Mémorisez !
          </h1>
          <div
            style={{
              marginTop: 12,
              color: 'var(--ink-2)',
              fontSize: 16,
              fontStyle: 'italic',
              fontFamily: 'var(--font-display)',
              maxWidth: 540,
            }}
          >
            Cachez votre écran à vos adversaires. {knownCount} carte{knownCount > 1 ? 's' : ''}{' '}
            visibles — retenez-les bien.
          </div>
        </div>

        {/* Card layout — top row (3,4) hidden, bottom row (1,2) revealed */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 24,
            padding: 32,
            background: 'rgba(0,0,0,0.3)',
            border: '1.5px solid var(--border)',
            borderRadius: 'var(--radius)',
            backdropFilter: 'blur(8px)',
          }}
        >
          {[2, 3].map((i) => (
            <PlayingCard key={'top-' + i} faceDown size="lg" />
          ))}
          {[0, 1].map((i) => {
            const c = privateHand[i];
            return c ? (
              <PlayingCard
                key={'bot-' + i}
                rank={c.rank}
                suit={c.suit}
                size="lg"
                highlight="memorize"
              />
            ) : (
              <PlayingCard key={'bot-' + i} faceDown size="lg" />
            );
          })}
        </div>

        <div
          style={{
            marginTop: 40,
            width: 360,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div className="eyebrow">Temps restant</div>
          <div
            style={{
              width: '100%',
              height: 4,
              background: 'rgba(0,0,0,0.4)',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: progress + '%',
                height: '100%',
                background: 'linear-gradient(90deg, var(--gold-bright), var(--gold))',
                transition: 'width 80ms linear',
              }}
            />
          </div>
        </div>
      </div>
    </Page>
  );
}

/* ──────── Game Table ──────── */
export function GameTableScreen() {
  const { user } = useAuth();
  const {
    roomState,
    privateHand,
    privateHoles,
    drawnCard,
    fromDiscard,
    draw,
    swap,
    discard,
    snap,
    callCombo,
    leaveRoom,
  } = useGame();
  const toast = useToast();
  const [showRules, setShowRules] = useState(false);
  const [comboCalled, setComboCalled] = useState(false);

  useEffect(() => {
    if (roomState?.comboCallerId) {
      setComboCalled(true);
      const t = setTimeout(() => setComboCalled(false), 2000);
      return () => clearTimeout(t);
    }
  }, [roomState?.comboCallerId]);

  if (!roomState || !user) return null;

  const me = roomState.players.find((p) => p.id === user.id);
  if (!me) return null;
  const opponents = roomState.players.filter((p) => p.id !== user.id);

  const isMyTurn = roomState.currentTurnPlayerId === user.id;
  const phase = roomState.phase;

  const opponentTop = opponents[2] ?? null;
  const opponentLeft = opponents[1] ?? null;
  const opponentRight = opponents[0] ?? null;

  const tryAction = (fn: () => Promise<unknown>) => {
    fn().catch((err) => toast.push((err as Error).message ?? 'Action refusée', 'danger'));
  };

  return (
    <Page bg="bg-felt" className="game-table">
      <GameTopBar
        leftLabel={`Salon ${roomState.code} · Manche ${roomState.round}/${roomState.config.rounds}`}
        rightContent={
          <button
            onClick={() => setShowRules(true)}
            className="btn btn-ghost btn-sm"
            style={{ borderColor: 'var(--border)' }}
          >
            Règles
          </button>
        }
        onBack={() => leaveRoom()}
      />

      {/* Top opponent */}
      {opponentTop && (
        <div
          style={{
            position: 'absolute',
            top: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <PlayerBadge player={opponentTop} />
          <div style={{ transform: 'rotate(180deg)' }}>
            <OpponentHand count={opponentTop.handCount} holes={opponentTop.holes} />
          </div>
        </div>
      )}

      {/* Left opponent */}
      {opponentLeft && (
        <SideOpponentLive player={opponentLeft} side="left" />
      )}

      {/* Right opponent */}
      {opponentRight && (
        <SideOpponentLive player={opponentRight} side="right" />
      )}

      {/* Center: deck + drawn card + discard */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 60,
        }}
      >
        <div
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
        >
          <div className="eyebrow" style={{ color: 'var(--ink-2)' }}>
            Pioche
          </div>
          <div
            onClick={() => isMyTurn && phase === 'turn' && !drawnCard && tryAction(() => draw('deck'))}
            style={{
              cursor: isMyTurn && phase === 'turn' && !drawnCard ? 'pointer' : 'default',
              position: 'relative',
            }}
          >
            <div style={{ position: 'absolute', top: 4, left: 4 }}>
              <PlayingCard faceDown size="lg" />
            </div>
            <div style={{ position: 'absolute', top: 2, left: 2 }}>
              <PlayingCard faceDown size="lg" />
            </div>
            <div style={{ position: 'relative' }}>
              <PlayingCard
                faceDown
                size="lg"
                highlight={isMyTurn && phase === 'turn' && !drawnCard ? 'selected' : null}
              />
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-2)', fontFamily: 'var(--font-mono)' }}>
            {roomState.deckCount} cartes
          </div>
        </div>

        {drawnCard && (
          <div
            className="fade-in-scale"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div className="eyebrow" style={{ color: 'var(--gold)' }}>
              Carte piochée
            </div>
            <PlayingCard
              rank={drawnCard.rank}
              suit={drawnCard.suit}
              size="lg"
              highlight="memorize"
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              {!fromDiscard && (
                <Button size="sm" variant="ghost" onClick={() => tryAction(discard)}>
                  Défausser
                </Button>
              )}
              <span className="eyebrow" style={{ color: 'var(--ink-3)', alignSelf: 'center' }}>
                OU REMPLACEZ ↓
              </span>
            </div>
          </div>
        )}

        <div
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
        >
          <div className="eyebrow" style={{ color: 'var(--ink-2)' }}>
            Défausse
          </div>
          <div
            onClick={() => isMyTurn && phase === 'turn' && !drawnCard && tryAction(() => draw('discard'))}
            style={{ cursor: isMyTurn && phase === 'turn' && !drawnCard && roomState.discardTop ? 'pointer' : 'default' }}
          >
            {roomState.discardTop ? (
              <PlayingCard
                rank={roomState.discardTop.rank}
                suit={roomState.discardTop.suit}
                size="lg"
              />
            ) : (
              <div
                style={{
                  width: 96,
                  height: 138,
                  border: '1.5px dashed var(--border)',
                  borderRadius: 7,
                }}
              />
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-2)', fontFamily: 'var(--font-mono)' }}>
            {phase === 'snap-window' ? <span style={{ color: 'var(--crimson)' }}>SNAP ?</span> : '—'}
          </div>
        </div>
      </div>

      {/* My zone (bottom) */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '24px 40px 32px',
          background: 'linear-gradient(0deg, rgba(0,0,0,0.5) 0%, transparent 100%)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            maxWidth: 1100,
            margin: '0 auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar name={me.pseudo} size={44} ring={isMyTurn ? 'gold' : null} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{me.pseudo}</div>
              <div className="eyebrow" style={{ color: 'var(--gold)' }}>
                {isMyTurn ? 'À vous de jouer' : "C'est pas votre tour"}
              </div>
            </div>
          </div>

          <MyHand
            cards={privateHand}
            holes={privateHoles}
            handCount={me.handCount}
            canSwap={isMyTurn && phase === 'turn' && !!drawnCard}
            canSnap={phase === 'snap-window'}
            onSwap={(idx) => tryAction(() => swap(idx))}
            onSnap={(idx) => tryAction(() => snap(idx))}
          />

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              alignItems: 'flex-end',
            }}
          >
            <Button
              variant="primary"
              size="lg"
              disabled={!isMyTurn || phase !== 'turn' || !!drawnCard}
              onClick={() => tryAction(callCombo)}
            >
              Crier{' '}
              <em
                style={{
                  fontFamily: 'var(--font-display)',
                  fontStyle: 'italic',
                  marginLeft: 4,
                  fontSize: 18,
                }}
              >
                Combo !
              </em>
            </Button>
            <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
              ⚡ Snap : cliquez sur une carte de votre main quand{' '}
              <span style={{ color: 'var(--crimson)' }}>SNAP ?</span> est affiché
            </span>
          </div>
        </div>
      </div>

      {comboCalled && roomState.comboCallerId && (
        <ComboCallOverlay
          name={roomState.players.find((p) => p.id === roomState.comboCallerId)?.pseudo ?? '?'}
        />
      )}

      <Modal open={showRules} onClose={() => setShowRules(false)} width={560}>
        <RulesQuickRef onClose={() => setShowRules(false)} />
      </Modal>
    </Page>
  );
}

function PlayerBadge({ player }: { player: PublicPlayer }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 14px',
        background: player.isCurrentTurn ? 'rgba(200, 169, 110, 0.08)' : 'rgba(0,0,0,0.25)',
        border: '1.5px solid',
        borderColor: player.isCurrentTurn ? 'var(--gold)' : 'var(--border)',
        borderRadius: 'var(--radius)',
        backdropFilter: 'blur(6px)',
        minWidth: 140,
      }}
    >
      <Avatar name={player.pseudo} size={28} ring={player.isCurrentTurn ? 'gold' : null} />
      <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{player.pseudo}</span>
      {player.isComboCaller && (
        <span
          style={{
            fontSize: 9,
            color: 'var(--gold)',
            fontFamily: 'var(--font-mono)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          COMBO
        </span>
      )}
    </div>
  );
}

interface SelfCardGridProps {
  handCount: number;
  holes?: number[];
  cardSize: 'sm' | 'md' | 'lg';
  labelSize: number;
  renderSlot: (i: number) => ReactNode;
}

function SelfCardGrid({ handCount, holes = [], cardSize, labelSize, renderSlot }: SelfCardGridProps) {
  const orderedIndices = [2, 3, 0, 1].filter((i) => i < Math.max(handCount, 4));
  const extras: number[] = [];
  for (let i = 4; i < handCount; i++) extras.push(i);
  const slot = (i: number) => (
    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      {holes.includes(i) ? <EmptySlot size={cardSize} /> : renderSlot(i)}
      <div style={{ fontSize: labelSize, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
        #{i + 1}
      </div>
    </div>
  );
  const gap = cardSize === 'sm' ? 8 : cardSize === 'md' ? 12 : 16;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap }}>
        {orderedIndices.map(slot)}
      </div>
      {extras.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: 8,
            paddingLeft: 8,
            borderLeft: '1.5px dashed var(--crimson)',
          }}
        >
          {extras.map(slot)}
        </div>
      )}
    </div>
  );
}

function EmptySlot({ size }: { size: 'sm' | 'md' | 'lg' }) {
  const dims = size === 'sm' ? { w: 48, h: 68 } : size === 'lg' ? { w: 96, h: 138 } : { w: 68, h: 96 };
  return (
    <div
      style={{
        width: dims.w,
        height: dims.h,
        border: '1.5px dashed var(--border)',
        borderRadius: 7,
        background: 'rgba(0,0,0,0.2)',
        boxSizing: 'border-box',
      }}
    />
  );
}

function OpponentHand({ count, holes = [] }: { count: number; holes?: number[] }) {
  const slotCount = Math.max(count, 4);
  const orderedIndices = [2, 3, 0, 1].filter((i) => i < slotCount);
  const extras: number[] = [];
  for (let i = 4; i < count; i++) extras.push(i);
  const slot = (i: number) => (
    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      {holes.includes(i) || i >= count ? (
        <EmptySlot size="sm" />
      ) : (
        <PlayingCard faceDown size="sm" />
      )}
      <div style={{ fontSize: 9, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
        #{i + 1}
      </div>
    </div>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {orderedIndices.map(slot)}
      </div>
      {extras.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: 4,
            paddingLeft: 6,
            borderLeft: '1px dashed var(--crimson)',
          }}
        >
          {extras.map(slot)}
        </div>
      )}
    </div>
  );
}

function SideOpponentLive({ player, side }: { player: PublicPlayer; side: 'left' | 'right' }) {
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
      <PlayerBadge player={player} />
      <div style={{ transform: `rotate(${rot}deg)`, padding: '14px 6px' }}>
        <OpponentHand count={player.handCount} holes={player.holes} />
      </div>
    </div>
  );
}

interface MyHandProps {
  cards: (Card | null)[];
  holes: number[];
  handCount: number;
  canSwap: boolean;
  canSnap: boolean;
  onSwap: (idx: number) => void;
  onSnap: (idx: number) => void;
}

function MyHand({ cards, holes, handCount, canSwap, canSnap, onSwap, onSnap }: MyHandProps) {
  // Always render the original 4 base slots (indices 0..3). Holes stay as empty placeholders.
  const orderedIndices = [2, 3, 0, 1];
  const extras: number[] = [];
  for (let i = 4; i < handCount; i++) extras.push(i);
  const isHole = (i: number) => holes.includes(i);

  const renderCard = (i: number) => {
    const c = cards[i];
    const hole = isHole(i);
    const clickable = !hole && (canSwap || canSnap);
    return (
      <div
        key={i}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
      >
        {hole ? (
          <EmptySlot size="md" />
        ) : (
          <PlayingCard
            rank={c?.rank}
            suit={c?.suit}
            faceDown={!c}
            size="md"
            onClick={
              clickable
                ? () => {
                    if (canSwap) onSwap(i);
                    else if (canSnap) onSnap(i);
                  }
                : null
            }
            highlight={c ? 'memorized' : null}
          />
        )}
        <div style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
          {i + 1}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
        {orderedIndices.map(renderCard)}
      </div>
      {extras.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: 8,
            paddingLeft: 8,
            borderLeft: '1.5px dashed var(--crimson)',
          }}
        >
          {extras.map(renderCard)}
        </div>
      )}
    </div>
  );
}

/* ──────── COMBO call animation ──────── */
function ComboCallOverlay({ name }: { name: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle, rgba(200, 169, 110, 0.25) 0%, rgba(0,0,0,0.7) 70%)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 50,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          animation: 'combo-zoom 700ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        }}
      >
        <div className="eyebrow" style={{ color: 'var(--ink)', fontSize: 14, marginBottom: 8 }}>
          {name} crie
        </div>
        <div
          className="display-italic"
          style={{
            fontSize: 180,
            color: 'var(--gold-bright)',
            textShadow: '0 8px 60px rgba(200, 169, 110, 0.6)',
            lineHeight: 0.9,
          }}
        >
          Combo !
        </div>
      </div>
    </div>
  );
}

/* ──────── Rules quick ref ──────── */
function RulesQuickRef({ onClose }: { onClose: () => void }) {
  return (
    <>
      <SectionHeading eyebrow="Aide rapide" title="Comment jouer" level="h2" />
      <div
        style={{
          marginTop: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          fontSize: 14,
          color: 'var(--ink-2)',
          lineHeight: 1.6,
        }}
      >
        <div style={{ display: 'flex', gap: 12 }}>
          <span style={{ color: 'var(--gold)' }}>1</span>
          <span>
            <strong style={{ color: 'var(--ink)' }}>Mémorisez</strong> vos 2 cartes du bas en début
            de manche.
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <span style={{ color: 'var(--gold)' }}>2</span>
          <span>
            À votre tour, <strong style={{ color: 'var(--ink)' }}>piochez</strong> (pile ou
            défausse) puis échangez ou défaussez.
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <span style={{ color: 'var(--red)' }}>3</span>
          <span>
            <strong style={{ color: 'var(--ink)' }}>Pouvoirs</strong> — uniquement les{' '}
            <strong style={{ color: 'var(--red)' }}>têtes rouges (♦/♥)</strong> :{' '}
            <strong>J</strong> regardez une de vos cartes · <strong>Q</strong> regardez celle d'un
            adversaire · <strong>K</strong> échangez l'une de vos cartes avec celle d'un adversaire.
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <span style={{ color: 'var(--crimson)' }}>!</span>
          <span>
            <strong style={{ color: 'var(--ink)' }}>Snap :</strong> pendant la fenêtre Snap (3s),
            cliquez sur une de vos cartes du même rang que la défausse pour la jeter. Raté = +1
            carte.
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <span style={{ color: 'var(--gold-bright)' }}>★</span>
          <span>
            Criez <em>Combo</em> au début de votre tour (avant de piocher). Les autres jouent un
            dernier tour, puis tout le monde révèle. Si vous n'avez pas le plus bas, +10 pts de
            pénalité.
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
        <Button variant="primary" onClick={onClose}>
          Compris
        </Button>
      </div>
    </>
  );
}

/* ──────── Power activation ──────── */
export function PowerScreen() {
  const { user } = useAuth();
  const {
    roomState,
    pendingPower,
    privateHand,
    powerSelfPeek,
    powerOpponentPeek,
    powerSwap,
    powerSkip,
    lastReveal,
    clearReveal,
  } = useGame();
  const toast = useToast();
  const [chosenIdx, setChosenIdx] = useState<number | null>(null);
  const [chosenTargetId, setChosenTargetId] = useState<string | null>(null);
  const [isResolved, setIsResolved] = useState(false);

  useEffect(() => {
    setChosenIdx(null);
    setChosenTargetId(null);
    setIsResolved(false);
    clearReveal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPower?.type]);

  useEffect(() => {
    if (!lastReveal) return;
    setIsResolved(true);
    const t = setTimeout(() => clearReveal(), 5000);
    return () => clearTimeout(t);
  }, [lastReveal, clearReveal]);

  if (!roomState || !user) return null;
  const me = roomState.players.find((p) => p.id === user.id);
  if (!me) return null;

  const isMyPower = roomState.currentTurnPlayerId === user.id && pendingPower;
  const opponents = roomState.players.filter((p) => p.id !== user.id);

  const tryAction = (fn: () => Promise<unknown>) => {
    fn().catch((err) => toast.push((err as Error).message ?? 'Action refusée', 'danger'));
  };

  if (!isMyPower) {
    return (
      <Page bg="bg-felt">
        <GameTopBar leftLabel={`Salon ${roomState.code}`} />
        <div
          style={{
            minHeight: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 40,
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div className="eyebrow" style={{ color: 'var(--gold)', marginBottom: 8 }}>
              Pouvoir en cours
            </div>
            <h1 className="display" style={{ fontSize: 36, margin: 0 }}>
              {roomState.players.find((p) => p.id === roomState.currentTurnPlayerId)?.pseudo ?? '?'}{' '}
              active un pouvoir…
            </h1>
          </div>
        </div>
      </Page>
    );
  }

  const labels: Record<string, { title: string; desc: string }> = {
    'self-peek': {
      title: 'Valet rouge',
      desc: "Cliquez sur une de vos cartes pour la regarder secrètement.",
    },
    'opponent-peek': {
      title: 'Dame rouge',
      desc: "Cliquez sur la carte d'un adversaire pour la regarder secrètement.",
    },
    swap: {
      title: 'Roi rouge',
      desc: "Choisissez l'une de vos cartes, puis celle d'un adversaire pour les échanger.",
    },
  };
  const info = labels[pendingPower.type];

  return (
    <Page bg="bg-felt">
      <GameTopBar leftLabel={`Salon ${roomState.code}`} />
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
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div className="eyebrow" style={{ color: 'var(--gold)', marginBottom: 8 }}>
            Pouvoir activé · {pendingPower.rank}
          </div>
          <h1 className="display" style={{ fontSize: 48, margin: 0, color: 'var(--ink)' }}>
            {info.title}
          </h1>
          <div
            style={{
              marginTop: 10,
              color: 'var(--ink-2)',
              fontSize: 16,
              fontStyle: 'italic',
              fontFamily: 'var(--font-display)',
            }}
          >
            {info.desc}
          </div>
        </div>

        {/* Self-peek: show my hand */}
        {pendingPower.type === 'self-peek' && (
          <div className="panel" style={{ background: 'rgba(0,0,0,0.4)', borderColor: 'var(--gold)' }}>
            <div
              className="eyebrow"
              style={{ color: 'var(--ink-2)', marginBottom: 12, textAlign: 'center' }}
            >
              Vos cartes
            </div>
            <SelfCardGrid
              handCount={me.handCount}
              holes={me.holes}
              cardSize="lg"
              labelSize={11}
              renderSlot={(i) => {
                const isChosen = chosenIdx === i;
                const card = lastReveal && isChosen ? lastReveal.card : null;
                return (
                  <PlayingCard
                    rank={card?.rank}
                    suit={card?.suit}
                    flipped={isChosen && !!card}
                    faceDown={!card}
                    size="lg"
                    highlight={isChosen ? 'selected' : null}
                    onClick={
                      !isResolved && chosenIdx === null
                        ? () => {
                            setChosenIdx(i);
                            tryAction(() => powerSelfPeek(i));
                          }
                        : null
                    }
                  />
                );
              }}
            />
          </div>
        )}

        {/* Opponent-peek: show all opponents' hands */}
        {pendingPower.type === 'opponent-peek' && (
          <div style={{ display: 'flex', gap: 24 }}>
            {opponents.map((opp) => (
              <OpponentHandPicker
                key={opp.id}
                player={opp}
                disabled={isResolved || chosenTargetId !== null}
                chosenIdx={chosenTargetId === opp.id ? chosenIdx : null}
                revealedCard={
                  lastReveal && lastReveal.ownerId === opp.id ? lastReveal.card : null
                }
                onPick={(idx) => {
                  setChosenTargetId(opp.id);
                  setChosenIdx(idx);
                  tryAction(() => powerOpponentPeek(opp.id, idx));
                }}
              />
            ))}
          </div>
        )}

        {/* Swap: pick own then opponent */}
        {pendingPower.type === 'swap' && (
          <SwapPicker
            me={me}
            opponents={opponents}
            disabled={isResolved}
            onSwap={(selfIdx, targetId, targetIdx) => {
              setIsResolved(true);
              tryAction(() => powerSwap(selfIdx, targetId, targetIdx));
            }}
          />
        )}

        {!isResolved && (
          <div style={{ marginTop: 24 }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsResolved(true);
                tryAction(powerSkip);
              }}
            >
              Passer le pouvoir
            </Button>
          </div>
        )}

        <div style={{ marginTop: 32, fontSize: 14, color: 'var(--ink-2)', height: 24 }}>
          {lastReveal && lastReveal.card && (
            <span
              style={{
                color: 'var(--gold-bright)',
                fontFamily: 'var(--font-display)',
                fontStyle: 'italic',
                fontSize: 18,
              }}
            >
              C'était un {lastReveal.card.rank}
              {lastReveal.card.suit}.
            </span>
          )}
        </div>
      </div>
    </Page>
  );
}

interface OpponentHandPickerProps {
  player: PublicPlayer;
  chosenIdx: number | null;
  disabled: boolean;
  revealedCard: Card | null;
  onPick: (idx: number) => void;
}

function OpponentHandPicker({
  player,
  chosenIdx,
  disabled,
  revealedCard,
  onPick,
}: OpponentHandPickerProps) {
  return (
    <div className="panel" style={{ background: 'rgba(0,0,0,0.4)', borderColor: 'var(--border)' }}>
      <div className="eyebrow" style={{ color: 'var(--ink-2)', marginBottom: 12, textAlign: 'center' }}>
        Cartes de {player.pseudo}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {Array.from({ length: player.handCount }).map((_, i) => {
          if (player.holes?.includes(i)) {
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <EmptySlot size="md" />
                <div style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>#{i + 1}</div>
              </div>
            );
          }
          const isChosen = chosenIdx === i;
          const card = revealedCard && isChosen ? revealedCard : null;
          return (
            <div
              key={i}
              onClick={() => !disabled && onPick(i)}
              style={{
                cursor: disabled ? 'default' : 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <PlayingCard
                rank={card?.rank}
                suit={card?.suit}
                flipped={isChosen && !!card}
                faceDown={!card}
                size="md"
                highlight={isChosen ? 'selected' : null}
              />
              <div style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
                #{i + 1}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface SwapPickerProps {
  me: PublicPlayer;
  opponents: PublicPlayer[];
  disabled: boolean;
  onSwap: (selfIdx: number, targetId: string, targetIdx: number) => void;
}

function SwapPicker({ me, opponents, disabled, onSwap }: SwapPickerProps) {
  const [step, setStep] = useState<'self' | 'opponent'>('self');
  const [selfIdx, setSelfIdx] = useState<number | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }}>
      <div className="eyebrow" style={{ color: 'var(--ink-2)' }}>
        {step === 'self'
          ? `Étape 1 — choisissez l'une de vos cartes`
          : `Étape 2 — choisissez la carte d'un adversaire`}
      </div>
      {step === 'self' ? (
        <div className="panel" style={{ background: 'rgba(0,0,0,0.4)', borderColor: 'var(--gold)' }}>
          <SelfCardGrid
            handCount={me.handCount}
            holes={me.holes}
            cardSize="md"
            labelSize={10}
            renderSlot={(i) => (
              <PlayingCard
                faceDown
                size="md"
                highlight={selfIdx === i ? 'selected' : null}
                onClick={
                  disabled
                    ? null
                    : () => {
                        setSelfIdx(i);
                        setStep('opponent');
                      }
                }
              />
            )}
          />
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 16 }}>
          {opponents.map((opp) => (
            <div
              key={opp.id}
              className="panel"
              style={{ background: 'rgba(0,0,0,0.4)', borderColor: 'var(--border)' }}
            >
              <div
                className="eyebrow"
                style={{ color: 'var(--ink-2)', marginBottom: 8, textAlign: 'center' }}
              >
                {opp.pseudo}
              </div>
              <SelfCardGrid
                handCount={opp.handCount}
                holes={opp.holes}
                cardSize="sm"
                labelSize={10}
                renderSlot={(i) => (
                  <PlayingCard
                    faceDown
                    size="sm"
                    onClick={
                      disabled || selfIdx === null
                        ? null
                        : () => onSwap(selfIdx, opp.id, i)
                    }
                  />
                )}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ──────── Snap resolution overlay ──────── */
export function SnapResolutionScreen() {
  const { lastSnap, roomState } = useGame();
  if (!lastSnap || !roomState) return null;
  const actorPseudo = roomState.players.find((p) => p.id === lastSnap.actorId)?.pseudo ?? '?';
  return (
    <div
      style={{
        position: 'fixed',
        top: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        background: lastSnap.success ? 'rgba(111,160,116,0.18)' : 'rgba(192,80,74,0.18)',
        border: '1.5px solid',
        borderColor: lastSnap.success ? 'var(--emerald)' : 'var(--crimson)',
        borderRadius: 'var(--radius)',
        padding: '14px 20px',
        backdropFilter: 'blur(8px)',
        zIndex: 60,
        animation: 'fade-in-scale 280ms ease-out',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div className="eyebrow" style={{ color: lastSnap.success ? 'var(--emerald)' : 'var(--crimson)' }}>
        {lastSnap.success ? '✓ Snap' : '✕ Snap raté'}
      </div>
      <div style={{ fontSize: 14, color: 'var(--ink)' }}>
        <strong>{actorPseudo}</strong>{' '}
        {lastSnap.success
          ? `défausse ${lastSnap.card?.rank ?? ''}${lastSnap.card?.suit ?? ''}`
          : `pénalité (+1 carte)`}
      </div>
    </div>
  );
}
