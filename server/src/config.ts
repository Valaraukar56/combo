import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 3001),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-only-secret-change-me',
  dbPath: process.env.DB_PATH ?? './data/combo.db',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
  // Shared secret embedded in the desktop (.exe) build. When set, every API
  // call and socket handshake must present it via the X-Combo-Client header
  // (or handshake.auth.client). Leave unset for local dev — without a secret
  // the gate stays open so the browser still works through Vite.
  desktopClientSecret: process.env.DESKTOP_CLIENT_SECRET ?? '',
  desktopDownloadUrl:
    process.env.DESKTOP_DOWNLOAD_URL ??
    'https://github.com/Valaraukar56/combo/releases/latest',
  // owner/repo used to resolve the latest .exe via the GitHub API on /download.
  githubRepo: process.env.GITHUB_REPO ?? 'Valaraukar56/combo',
};

export const desktopClientGateEnabled = !!config.desktopClientSecret;

if (config.isProd && config.jwtSecret === 'dev-only-secret-change-me') {
  throw new Error('JWT_SECRET must be set in production');
}
