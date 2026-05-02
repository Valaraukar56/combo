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

// Gate every /api/* route behind the desktop-client secret when configured.
// /api/health stays open so monitoring / curl can probe the server.
function requireDesktopClient(req: Request, res: Response, next: NextFunction): void {
  if (!desktopClientGateEnabled) return next();
  const presented = req.header('X-Combo-Client');
  if (presented && presented === config.desktopClientSecret) return next();
  res.status(403).json({ error: 'desktop_client_required' });
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
io.use((socket, next) => {
  if (!desktopClientGateEnabled) return next();
  const presented = (socket.handshake.auth as { client?: string })?.client;
  if (presented && presented === config.desktopClientSecret) return next();
  next(new Error('desktop_client_required'));
});

setupSocketServer(io);

httpServer.listen(config.port, () => {
  const gate = desktopClientGateEnabled ? 'desktop-only' : 'open';
  console.log(`[combo-server] listening on :${config.port} (${config.nodeEnv}, ${gate})`);
  void ensureAdmin();
});

/** In-memory cache of the latest .exe URL — avoids hitting the GitHub API
 *  rate limit (60 unauthenticated req/h) when many people open the page. */
let exeUrlCache: { url: string; expiresAt: number } | null = null;
const EXE_URL_TTL_MS = 5 * 60 * 1000;

interface GithubReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface GithubReleaseResponse {
  assets?: GithubReleaseAsset[];
}

async function resolveLatestExeUrl(): Promise<string> {
  const now = Date.now();
  if (exeUrlCache && exeUrlCache.expiresAt > now) return exeUrlCache.url;

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

  exeUrlCache = { url: exe.browser_download_url, expiresAt: now + EXE_URL_TTL_MS };
  return exe.browser_download_url;
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
