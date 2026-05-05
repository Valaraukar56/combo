import { useState } from 'react';
import { Button, Input, Logo, Page, SectionHeading } from '../components/ui';
import { PlayingCard } from '../components/Card';
import { useToast } from '../components/Toast';
import { useAuth } from '../lib/auth';
import { APP_VERSION, ApiError } from '../lib/api';
import type { Page as PageId } from '../types';

interface NavProps {
  onNavigate: (p: PageId) => void;
}

/* ──────── Home / Landing ──────── */
export function HomeScreen({ onNavigate }: NavProps) {
  return (
    <Page bg="bg-deep">
      <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
        <header
          style={{
            padding: '28px 56px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Logo size={32} />
          <div style={{ display: 'flex', gap: 12 }}>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('login')}>
              Connexion
            </Button>
            <Button variant="primary" size="sm" onClick={() => onNavigate('register')}>
              S'inscrire
            </Button>
          </div>
        </header>

        <main
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 56px',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 80,
              maxWidth: 1200,
              width: '100%',
              alignItems: 'center',
            }}
          >
            <div>
              <div className="eyebrow" style={{ marginBottom: 16 }}>
                Le jeu de mémoire de société
              </div>
              <h1
                className="display"
                style={{ fontSize: 88, lineHeight: 0.95, margin: 0, color: 'var(--ink)' }}
              >
                Mémorisez.
                <br />
                <span className="display-italic" style={{ color: 'var(--gold-bright)' }}>
                  Bluffez.
                </span>
                <br />
                Criez <em style={{ color: 'var(--gold-bright)' }}>Combo.</em>
              </h1>
              <p
                style={{
                  fontSize: 17,
                  color: 'var(--ink-2)',
                  maxWidth: 460,
                  marginTop: 24,
                  lineHeight: 1.6,
                }}
              >
                Un jeu de cartes rapide où la mémoire fait toute la différence. Défiez vos amis en
                ligne, déclenchez des pouvoirs, claquez vos paires — et osez crier Combo au bon
                moment.
              </p>
              <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
                <Button variant="primary" size="lg" onClick={() => onNavigate('register')}>
                  Créer mon compte
                </Button>
              </div>
              <div style={{ display: 'flex', gap: 32, marginTop: 48 }}>
                <Stat label="Joueurs" value="2-4" />
                <Stat label="Durée" value="~10 min" />
                <Stat label="Manches" value="5" />
              </div>
            </div>

            <div
              style={{
                position: 'relative',
                height: 460,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CardSpread />
            </div>
          </div>
        </main>

        <footer
          style={{
            padding: '24px 56px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
            color: 'var(--ink-3)',
            fontFamily: 'var(--font-mono)',
          }}
        >
<span style={{ letterSpacing: '0.2em', textTransform: 'uppercase' }}>v{APP_VERSION}</span>
        </footer>
      </div>
    </Page>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 4 }}>
        {label}
      </div>
      <div className="display" style={{ fontSize: 28, color: 'var(--ink)' }}>
        {value}
      </div>
    </div>
  );
}

function CardSpread() {
  const cards = [
    { rank: 'Q', suit: '♥', rotate: -18, x: -180, y: 30, delay: 0 },
    { rank: '7', suit: '♣', rotate: -8, x: -90, y: -10, delay: 100 },
    { rank: 'A', suit: '♠', rotate: 0, x: 0, y: -30, delay: 200 },
    { rank: 'J', suit: '♦', rotate: 10, x: 90, y: -10, delay: 300 },
    { rank: 'K', suit: '♣', rotate: 20, x: 180, y: 30, delay: 400 },
  ];
  return (
    <>
      <div
        style={{
          position: 'absolute',
          width: 320,
          height: 320,
          background: 'radial-gradient(circle, var(--gold-glow) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />
      {cards.map((c, i) => (
        <div
          key={i}
          className="fade-in-scale"
          style={{
            position: 'absolute',
            transform: `translate(${c.x}px, ${c.y}px) rotate(${c.rotate}deg)`,
            animationDelay: c.delay + 'ms',
            animationFillMode: 'backwards',
          }}
        >
          <PlayingCard rank={c.rank} suit={c.suit} size="lg" />
        </div>
      ))}
    </>
  );
}

/* ──────── Login ──────── */
export function LoginScreen({ onNavigate }: NavProps) {
  const [pseudo, setPseudo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const { login } = useAuth();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!pseudo.trim() || !password) {
      setError('Pseudo et mot de passe requis');
      return;
    }
    setLoading(true);
    try {
      const u = await login(pseudo.trim(), password);
      toast.push(`Bienvenue, ${u.pseudo} !`, 'success');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'invalid_credentials') {
        setError('Pseudo ou mot de passe incorrect');
      } else if (err instanceof ApiError && err.code === 'version_outdated') {
        setError("Version trop ancienne — mets à jour l'application");
      } else {
        setError('Connexion impossible — réessayez');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page bg="bg-deep">
      <div style={{ minHeight: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        <div
          className="bg-felt"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 56,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div
              className="display-italic"
              style={{
                fontSize: 96,
                color: 'var(--gold-bright)',
                lineHeight: 0.9,
                textShadow: '0 4px 30px rgba(200, 169, 110, 0.3)',
              }}
            >
              Combo
            </div>
            <div
              style={{
                marginTop: 24,
                color: 'var(--ink)',
                fontSize: 17,
                maxWidth: 420,
                lineHeight: 1.6,
                fontStyle: 'italic',
                fontFamily: 'var(--font-display)',
              }}
            >
              "La mémoire est l'arme de ceux qui osent."
            </div>
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: -40,
              right: -40,
              transform: 'rotate(15deg)',
              opacity: 0.4,
            }}
          >
            <PlayingCard rank="A" suit="♠" size="lg" />
          </div>
          <div
            style={{
              position: 'absolute',
              top: -20,
              left: -20,
              transform: 'rotate(-12deg)',
              opacity: 0.3,
            }}
          >
            <PlayingCard faceDown size="lg" />
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 56,
          }}
        >
          <form onSubmit={submit} style={{ width: '100%', maxWidth: 380 }}>
            <button
              onClick={() => onNavigate('home')}
              type="button"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--ink-2)',
                fontSize: 13,
                padding: 0,
                cursor: 'pointer',
                marginBottom: 24,
                fontFamily: 'var(--font-body)',
              }}
            >
              ← Retour
            </button>
            <SectionHeading
              eyebrow="Bon retour"
              title="Connexion"
              sub="Reprenez la partie là où vous l'avez laissée."
              level="h1"
            />
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 32 }}
            >
              <Input
                label="Pseudo"
                value={pseudo}
                onChange={setPseudo}
                placeholder="votre_pseudo"
                autoFocus
              />
              <Input
                label="Mot de passe"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
              />
              {error && (
                <div style={{ fontSize: 13, color: 'var(--crimson)' }}>{error}</div>
              )}
              <Button variant="primary" size="lg" type="submit" disabled={loading}>
                {loading ? '…' : 'Se connecter →'}
              </Button>
              <div
                style={{
                  textAlign: 'center',
                  fontSize: 13,
                  color: 'var(--ink-2)',
                  marginTop: 8,
                }}
              >
                Pas encore de compte ?{' '}
                <button
                  type="button"
                  onClick={() => onNavigate('register')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--gold-bright)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                    fontSize: 13,
                    padding: 0,
                  }}
                >
                  Créer un compte
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </Page>
  );
}

/* ──────── Register ──────── */
export function RegisterScreen({ onNavigate }: NavProps) {
  const [pseudo, setPseudo] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const { register } = useAuth();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (pseudo.length < 3) {
      setError('Pseudo trop court (min 3)');
      return;
    }
    if (password.length < 4) {
      setError('Mot de passe trop court (min 4)');
      return;
    }
    if (password !== password2) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    setLoading(true);
    try {
      const u = await register(pseudo, password);
      toast.push(`Compte créé. Bienvenue ${u.pseudo} !`, 'success');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'pseudo_taken') setError('Ce pseudo est déjà pris');
        else if (err.code === 'invalid_pseudo')
          setError('Pseudo invalide — 3 à 16 caractères, lettres/chiffres/_-');
        else if (err.code === 'weak_password') setError('Mot de passe trop faible (min 4)');
        else setError('Inscription impossible — réessayez');
      } else {
        setError('Inscription impossible — réessayez');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page bg="bg-deep">
      <div style={{ minHeight: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 56,
          }}
        >
          <form onSubmit={submit} style={{ width: '100%', maxWidth: 380 }}>
            <button
              onClick={() => onNavigate('home')}
              type="button"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--ink-2)',
                fontSize: 13,
                padding: 0,
                cursor: 'pointer',
                marginBottom: 24,
                fontFamily: 'var(--font-body)',
              }}
            >
              ← Retour
            </button>
            <SectionHeading
              eyebrow="Rejoindre"
              title="Créer un compte"
              sub="Choisissez un pseudo, et lancez votre première partie."
              level="h1"
            />
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 32 }}
            >
              <Input
                label="Pseudo"
                value={pseudo}
                onChange={setPseudo}
                placeholder="3 à 16 caractères"
                maxLength={16}
                autoFocus
              />
              <Input
                label="Mot de passe"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="4 caractères minimum"
              />
              <Input
                label="Confirmer"
                type="password"
                value={password2}
                onChange={setPassword2}
                placeholder="••••••••"
              />
              {error && (
                <div style={{ fontSize: 13, color: 'var(--crimson)' }}>{error}</div>
              )}
              <Button variant="primary" size="lg" type="submit" disabled={loading}>
                {loading ? '…' : 'Créer mon compte →'}
              </Button>
              <div
                style={{
                  textAlign: 'center',
                  fontSize: 13,
                  color: 'var(--ink-2)',
                  marginTop: 8,
                }}
              >
                Déjà inscrit ?{' '}
                <button
                  type="button"
                  onClick={() => onNavigate('login')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--gold-bright)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                    fontSize: 13,
                    padding: 0,
                  }}
                >
                  Se connecter
                </button>
              </div>
            </div>
          </form>
        </div>
        <div
          className="bg-felt"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 56,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
            <div
              className="display-italic"
              style={{ fontSize: 80, color: 'var(--gold-bright)', lineHeight: 0.9 }}
            >
              Pas d'email.
            </div>
            <div className="display" style={{ fontSize: 32, color: 'var(--ink)', marginTop: 8 }}>
              Pas de spam.
            </div>
            <div
              style={{
                marginTop: 24,
                color: 'var(--ink-2)',
                fontSize: 15,
                fontStyle: 'italic',
                fontFamily: 'var(--font-display)',
              }}
            >
              Juste un pseudo et un mot de passe.
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
}
