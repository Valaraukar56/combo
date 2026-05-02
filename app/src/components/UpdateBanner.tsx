import { useEffect, useMemo, useState } from 'react';
import { Button } from './ui';

interface UpdateInfo {
  version: string | null;
  releaseName: string | null;
  releaseNotes: string | null;
}

/**
 * GitHub renders release notes (= the commit message) as HTML — `<p>...</p>`,
 * `<br />`, etc. Electron-updater forwards that HTML verbatim, so without
 * cleaning we'd display the raw markup in our modal. This converts the markup
 * to plain text, drops auto-generated trailers, and appends a stable author
 * line so the modal stays human-readable.
 */
function cleanReleaseNotes(raw: string | null): string | null {
  if (!raw) return null;
  const text = raw
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/?(p|div|span|strong|em|ul|ol|li|h[1-6])[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .split('\n')
    .filter((line) => !/^\s*co-authored-by:/i.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!text) return 'Auteur : Vala';
  return `${text}\n\nAuteur : Vala`;
}

/**
 * Custom in-app modal that replaces the native Windows dialog when an update
 * is downloaded by electron-updater. Only renders inside Electron — in a
 * normal browser tab `window.combo` is undefined and this is a no-op.
 */
export function UpdateBanner() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const bridge = window.combo;
    if (!bridge) return;
    const off = bridge.onUpdateReady((payload) => {
      setInfo(payload);
      setDismissed(false);
    });
    return off;
  }, []);

  const cleanedNotes = useMemo(
    () => (info ? cleanReleaseNotes(info.releaseNotes) : null),
    [info]
  );

  if (!info || dismissed) return null;

  const handleInstall = () => {
    setInstalling(true);
    window.combo?.installUpdate();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(8, 6, 4, 0.72)',
          backdropFilter: 'blur(6px)',
          zIndex: 9998,
          animation: 'fadeIn 200ms ease-out',
        }}
      />
      {/* Modal card */}
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 9999,
          width: 'min(460px, calc(100vw - 48px))',
          background: 'var(--bg-elevated)',
          border: '1.5px solid var(--gold)',
          borderRadius: 'var(--radius)',
          padding: 32,
          boxShadow: 'var(--shadow-lg)',
          fontFamily: 'var(--font-body)',
          color: 'var(--ink)',
          animation: 'popIn 240ms cubic-bezier(.2,.9,.3,1.2)',
        }}
      >
        <div
          className="eyebrow"
          style={{
            color: 'var(--gold)',
            marginBottom: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 14, lineHeight: 1 }}>◆</span>
          <span>Mise à jour</span>
        </div>

        <h2
          className="display"
          style={{
            fontSize: 26,
            margin: '0 0 12px',
            color: 'var(--ink)',
            lineHeight: 1.15,
          }}
        >
          Une nouvelle version de Combo est prête
        </h2>

        <p
          style={{
            fontSize: 14,
            color: 'var(--ink-2)',
            margin: 0,
            lineHeight: 1.55,
          }}
        >
          {info.version ? (
            <>
              La version{' '}
              <strong style={{ color: 'var(--gold-bright)', fontFamily: 'var(--font-mono)' }}>
                v{info.version}
              </strong>{' '}
              a été téléchargée. Redémarrez maintenant pour l'installer, ou continuez de jouer
              et la mise à jour s'appliquera à la prochaine fermeture.
            </>
          ) : (
            <>
              Une nouvelle version a été téléchargée. Redémarrez maintenant pour l'installer, ou
              continuez de jouer et la mise à jour s'appliquera à la prochaine fermeture.
            </>
          )}
        </p>

        {cleanedNotes && (
          <div
            style={{
              marginTop: 18,
              padding: '12px 14px',
              background: 'rgba(200, 169, 110, 0.06)',
              border: '1px solid rgba(200, 169, 110, 0.25)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              color: 'var(--ink-2)',
              lineHeight: 1.5,
              maxHeight: 140,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
            }}
          >
            {cleanedNotes}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            gap: 10,
            marginTop: 28,
            justifyContent: 'flex-end',
          }}
        >
          <Button variant="ghost" onClick={() => setDismissed(true)} disabled={installing}>
            Plus tard
          </Button>
          <Button variant="primary" onClick={handleInstall} disabled={installing}>
            {installing ? 'Redémarrage…' : 'Redémarrer maintenant →'}
          </Button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes popIn {
          from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </>
  );
}
