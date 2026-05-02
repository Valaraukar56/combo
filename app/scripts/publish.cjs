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

// Resolve the electron-builder CLI directly from node_modules so we don't
// depend on npx (which spawns awkwardly on Windows via spawnSync).
const builderCli = path.join(
  __dirname,
  '..',
  'node_modules',
  'electron-builder',
  'out',
  'cli',
  'cli.js'
);

if (!fs.existsSync(builderCli)) {
  console.error(`[publish] Could not find electron-builder CLI at ${builderCli}`);
  process.exit(1);
}

// User-facing release notes for this version. We pass the file directly to
// electron-builder so the GitHub release body (= what shows up in the in-app
// update modal) is the curated text rather than a dump of every commit message
// since the last tag. Bump app/release-notes.md whenever you bump version.
const releaseNotesPath = path.join(__dirname, '..', 'release-notes.md');
const builderArgs = [builderCli, '--publish', 'always'];
if (fs.existsSync(releaseNotesPath)) {
  builderArgs.push(`--config.releaseInfo.releaseNotesFile=${releaseNotesPath}`);
  console.log(`[publish] Using release notes from ${releaseNotesPath}`);
} else {
  console.warn(
    `[publish] No release-notes.md at ${releaseNotesPath} — falling back to commit messages`
  );
}

console.log('[publish] Spawning electron-builder…');
const result = spawnSync(process.execPath, builderArgs, {
  stdio: 'inherit',
  env: process.env,
});
process.exit(result.status ?? 1);
