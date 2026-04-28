import bcrypt from 'bcryptjs';
import { Router, type NextFunction, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { config } from './config.js';
import { db, userQueries, type UserRow } from './db.js';
import type { AuthUser } from './types.js';

const PSEUDO_RE = /^[a-zA-Z0-9_-]{3,16}$/;
const PWD_MIN = 4;

export function signToken(user: AuthUser): string {
  return jwt.sign(
    { sub: user.id, pseudo: user.pseudo, adm: user.isAdmin ? 1 : 0 },
    config.jwtSecret,
    { expiresIn: '30d' }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret) as {
      sub: string;
      pseudo: string;
      adm?: number;
    };
    // Re-read is_admin from DB so a freshly-revoked admin loses access on next request.
    const row = userQueries.byId.get(payload.sub) as UserRow | undefined;
    const isAdmin = row ? !!row.is_admin : !!payload.adm;
    return { id: payload.sub, pseudo: payload.pseudo, isAdmin };
  } catch {
    return null;
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'missing_token' });
    return;
  }
  const user = verifyToken(header.slice(7));
  if (!user) {
    res.status(401).json({ error: 'invalid_token' });
    return;
  }
  req.user = user;
  next();
}

export const authRouter: Router = Router();

authRouter.post('/register', async (req, res) => {
  const { pseudo, password } = req.body ?? {};
  if (typeof pseudo !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'invalid_body' });
    return;
  }
  if (!PSEUDO_RE.test(pseudo)) {
    res.status(400).json({ error: 'invalid_pseudo', message: '3 à 16 caractères, lettres/chiffres/_-' });
    return;
  }
  if (password.length < PWD_MIN) {
    res.status(400).json({ error: 'weak_password', message: `Min ${PWD_MIN} caractères` });
    return;
  }
  const existing = userQueries.byPseudo.get(pseudo) as UserRow | undefined;
  if (existing) {
    res.status(409).json({ error: 'pseudo_taken' });
    return;
  }
  const id = randomUUID();
  const hash = await bcrypt.hash(password, 10);
  db.exec('BEGIN');
  try {
    userQueries.insert.run(id, pseudo, hash, Date.now());
    userQueries.insertStats.run(id);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  const user: AuthUser = { id, pseudo, isAdmin: false };
  res.json({ token: signToken(user), user });
});

authRouter.post('/login', async (req, res) => {
  const { pseudo, password } = req.body ?? {};
  if (typeof pseudo !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'invalid_body' });
    return;
  }
  const row = userQueries.byPseudo.get(pseudo) as UserRow | undefined;
  if (!row) {
    res.status(401).json({ error: 'invalid_credentials' });
    return;
  }
  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) {
    res.status(401).json({ error: 'invalid_credentials' });
    return;
  }
  const user: AuthUser = { id: row.id, pseudo: row.pseudo, isAdmin: !!row.is_admin };
  res.json({ token: signToken(user), user });
});

authRouter.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

/**
 * Bootstrap an admin account on server start, driven by env vars:
 *   ADMIN_PSEUDO      pseudo to promote/create (default: "admin")
 *   ADMIN_PASSWORD    password used only when creating the user
 *
 * - If a user with the pseudo exists, it is promoted to admin (no password change).
 * - If it does not exist and ADMIN_PASSWORD is set, the user is created with admin = 1.
 * - Otherwise nothing happens (no silent default password in production).
 */
export async function ensureAdmin(): Promise<void> {
  const pseudo = process.env.ADMIN_PSEUDO ?? 'admin';
  const existing = userQueries.byPseudo.get(pseudo) as UserRow | undefined;
  if (existing) {
    if (!existing.is_admin) {
      userQueries.setAdmin.run(1, existing.id);
      console.log(`[auth] promoted existing user "${pseudo}" to admin`);
    }
    return;
  }
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    console.log(
      `[auth] no admin user found (pseudo "${pseudo}"). Set ADMIN_PASSWORD to bootstrap one.`
    );
    return;
  }
  if (!PSEUDO_RE.test(pseudo) || password.length < PWD_MIN) {
    console.warn('[auth] ADMIN_PSEUDO/ADMIN_PASSWORD invalid, skipping admin bootstrap');
    return;
  }
  const id = randomUUID();
  const hash = await bcrypt.hash(password, 10);
  db.exec('BEGIN');
  try {
    userQueries.insert.run(id, pseudo, hash, Date.now());
    userQueries.insertStats.run(id);
    userQueries.setAdmin.run(1, id);
    db.exec('COMMIT');
    console.log(`[auth] created admin user "${pseudo}"`);
  } catch (err) {
    db.exec('ROLLBACK');
    console.error('[auth] failed to bootstrap admin', err);
  }
}
