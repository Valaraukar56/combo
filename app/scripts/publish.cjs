// Loads variables from .env into process.env, then runs `electron-builder --publish always`.
// This wrapper exists because electron-builder does not auto-load .env files.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // Strip optional surrounding quotes.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
  console.log(`[publish] Loaded env from ${envPath}`);
} else {
  console.warn(`[publish] No .env found at ${envPath}`);
}

if (!process.env.GH_TOKEN) {
  console.error('[publish] GH_TOKEN is not set. Add it to app/.env or set it in your shell.');
  process.exit(1);
}

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['electron-builder', '--publish', 'always'],
  { stdio: 'inherit', env: process.env }
);
process.exit(result.status ?? 1);
