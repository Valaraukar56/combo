import cors from 'cors';
import express from 'express';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { authRouter } from './auth.js';
import { config } from './config.js';
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
  })
);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

app.use('/api/auth', authRouter);
app.use('/api/stats', statsRouter);

// Serve the built frontend in production.
if (config.isProd) {
  const distDir = path.resolve(__dirname, '../../app/dist');
  app.use(express.static(distDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: config.corsOrigin, credentials: false },
  pingTimeout: 25000,
  pingInterval: 20000,
});

setupSocketServer(io);

httpServer.listen(config.port, () => {
  console.log(`[combo-server] listening on :${config.port} (${config.nodeEnv})`);
});
