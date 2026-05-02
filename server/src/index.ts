import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { authRouter, ensureAdmin } from './auth.js';
import { config, desktopClientGateEnabled } from './config.js';
import './db.js'; // initializes schema
import { setupSocketServer } from './socket.js';
import { statsRouter } from './stats.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '64kb' }));
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: false,
    // The desktop client adds this header on every API call.
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Combo-Client'],
  })
);

// Gate every /api/* route behind the desktop-client secret AND a version
// check when configured. /api/health stays open so monitoring / curl can
// probe the server.
async function requireDesktopClient(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!desktopClientGateEnabled) return next();
  const presented = req.header('X-Combo-Client');
  if (!presented || presented !== config.desktopClientSecret) {
    res.status(403).json({ error: 'desktop_client_required' });
    return;
  }
  const versionCheck = await checkClientVersion(req.header('X-Combo-Version'));
  if (!versionCheck.ok) {
    res.status(403).json({
      error: 'version_outdated',
      latestVersion: versionCheck.latest,
      clientVersion: versionCheck.client,
    });
    return;
  }
  next();
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// Resolve the latest .exe URL via the GitHub API and redirect straight to it.
// Avoids the user having to click through the GitHub releases page.
app.get('/download', async (_req, res) => {
  try {
    const url = await resolveLatestExeUrl();
    res.redirect(302, url);
  } catch (err) {
    console.error('[download] failed to resolve latest exe', err);
    // Fallback: send the user to the releases page so they can pick manually.
    res.redirect(302, config.desktopDownloadUrl);
  }
});

app.use('/api/auth', requireDesktopClient, authRouter);
app.use('/api/stats', requireDesktopClient, statsRouter);

// Serve the built frontend OR the download landing page depending on whether
// the desktop-client gate is on. With the gate enabled the SPA is shipped
// inside the .exe — the web server only needs to advertise where to grab it.
if (config.isProd) {
  if (desktopClientGateEnabled) {
    app.get('*', (_req, res) => {
      res.set('Content-Type', 'text/html; charset=utf-8').send(landingPage());
    });
  } else {
    const distDir = path.resolve(__dirname, '../../app/dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }
}

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: config.corsOrigin, credentials: false },
  pingTimeout: 25000,
  pingInterval: 20000,
});

// Same desktop-client gate at the socket handshake.
io.use(async (socket, next) => {
  if (!desktopClientGateEnabled) return next();
  const auth = socket.handshake.auth as { client?: string; version?: string };
  if (!auth.client || auth.client !== config.desktopClientSecret) {
    return next(new Error('desktop_client_required'));
  }
  const versionCheck = await checkClientVersion(auth.version);
  if (!versionCheck.ok) {
    // socket.io passes the message back to the client as the connect_error.
    return next(new Error('version_outdated'));
  }
  next();
});

setupSocketServer(io);

httpServer.listen(config.port, () => {
  const gate = desktopClientGateEnabled ? 'desktop-only' : 'open';
  console.log(`[combo-server] listening on :${config.port} (${config.nodeEnv}, ${gate})`);
  void ensureAdmin();
});

/** In-memory cache of the latest GitHub release — avoids hitting the API
 *  rate limit (60 unauthenticated req/h) on every download click and every
 *  socket handshake. */
interface ReleaseCache {
  exeUrl: string;
  /** Plain semver, e.g. "0.1.16" (the GitHub tag's leading "v" is stripped). */
  version: string;
  expiresAt: number;
}
let releaseCache: ReleaseCache | null = null;
const RELEASE_CACHE_TTL_MS = 5 * 60 * 1000;

interface GithubReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface GithubReleaseResponse {
  tag_name?: string;
  assets?: GithubReleaseAsset[];
}

async function fetchLatestRelease(): Promise<ReleaseCache> {
  const now = Date.now();
  if (releaseCache && releaseCache.expiresAt > now) return releaseCache;

  const apiUrl = `https://api.github.com/repos/${config.githubRepo}/releases/latest`;
  const r = await fetch(apiUrl, {
    headers: {
      'User-Agent': 'combo-server',
      Accept: 'application/vnd.github+json',
    },
  });
  if (!r.ok) throw new Error(`github api ${r.status}`);
  const data = (await r.json()) as GithubReleaseResponse;
  const exe = data.assets?.find(
    (a) => a.name.toLowerCase().endsWith('.exe') && !a.name.toLowerCase().endsWith('.blockmap')
  );
  if (!exe) throw new Error('no .exe asset on the latest release');
  const version = (data.tag_name ?? '').replace(/^v/, '');
  if (!version) throw new Error('latest release has no tag_name');

  releaseCache = {
    exeUrl: exe.browser_download_url,
    version,
    expiresAt: now + RELEASE_CACHE_TTL_MS,
  };
  return releaseCache;
}

async function resolveLatestExeUrl(): Promise<string> {
  return (await fetchLatestRelease()).exeUrl;
}

/** Numeric semver compare. Treats missing/garbage tokens as 0. */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const max = Math.max(pa.length, pb.length);
  for (let i = 0; i < max; i++) {
    const ai = pa[i] ?? 0;
    const bi = pb[i] ?? 0;
    if (ai !== bi) return ai - bi;
  }
  return 0;
}

/** Returns whether the client is allowed in. Fail-open when GitHub is
 *  unreachable so a transient outage never locks the whole user base out. */
async function checkClientVersion(
  client: string | undefined
): Promise<{ ok: boolean; latest?: string; client?: string }> {
  const v = (client ?? '').trim();
  if (!v) return { ok: false, latest: undefined, client: '' };
  try {
    const { version: latest } = await fetchLatestRelease();
    if (compareVersions(v, latest) < 0) return { ok: false, latest, client: v };
    return { ok: true, latest, client: v };
  } catch (err) {
    console.warn('[version] GitHub unreachable, allowing client through:', err);
    return { ok: true, client: v };
  }
}

function landingPage(): string {
  const url = config.desktopDownloadUrl;
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Combo — Application desktop requise</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: radial-gradient(ellipse at top, #1a1410 0%, #0a0805 70%);
    color: #ede4cf; font-family: -apple-system, system-ui, "Segoe UI", sans-serif; }
  .card { max-width: 540px; padding: 48px 44px; text-align: center;
    background: rgba(20, 14, 10, 0.6); border: 1.5px solid #c8a96e;
    border-radius: 12px; box-shadow: 0 20px 80px rgba(0,0,0,0.6); }
  h1 { margin: 0 0 12px; font-size: 56px; font-style: italic; color: #e8c896;
    font-family: Georgia, "Playfair Display", serif; letter-spacing: 0.02em; }
  p { color: #a09a8a; line-height: 1.6; font-size: 15px; margin: 0 0 28px; }
  a.btn { display: inline-block; padding: 14px 28px; font-weight: 600;
    background: linear-gradient(180deg, #e8c896 0%, #c8a96e 100%);
    color: #1a1410; border-radius: 8px; text-decoration: none;
    box-shadow: 0 4px 16px rgba(200,169,110,0.3); }
  a.btn:hover { transform: translateY(-1px); }
  .small { margin-top: 24px; font-size: 12px; color: #6a6356;
    font-family: "SF Mono", Consolas, monospace; letter-spacing: 0.1em; }
</style>
</head>
<body>
  <div class="card">
    <h1>Combo</h1>
    <p>Le jeu est désormais disponible uniquement via l'application desktop. Téléchargez la dernière version pour jouer.</p>
    <a class="btn" href="/download">Télécharger pour Windows ↓</a>
    <div style="margin-top: 14px; font-size: 12px; color: #6a6356;">
      ou <a href="${url}" style="color: #a09a8a;">voir toutes les versions</a>
    </div>
    <div class="small">VERSION DESKTOP REQUISE</div>
  </div>
</body>
</html>`;
}
