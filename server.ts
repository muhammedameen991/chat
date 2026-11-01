import express, { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '15mb' }));

// Data storage directory and file for persistent registered users and signals
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'meshchat_data.json');

interface UserRecord {
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
  createdAt: number;
  lastActive: number;
}

interface SignalEnvelope {
  id: string;
  from: string;
  to: string;
  type: string;
  payload: any;
  timestamp: number;
}

interface AppDatabase {
  users: Record<string, UserRecord>;
  signals: SignalEnvelope[];
}

// In-memory state
let db: AppDatabase = {
  users: {},
  signals: [],
};

// Load data from file if exists
function loadDatabase() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      db = JSON.parse(content);
    }
  } catch (err) {
    console.error('Error loading database:', err);
  }
}

// Save data to file safely
function saveDatabase() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving database:', err);
  }
}

loadDatabase();

// Clean up stale signals periodically (older than 2 minutes)
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 1000;
  if (db.signals.length > 0) {
    db.signals = db.signals.filter((s) => s.timestamp > cutoff);
  }
}, 30 * 1000);

// Active SSE client connections map: username -> Response[]
const sseClients = new Map<string, Response[]>();

function dispatchSignalToUser(toUser: string, signal: SignalEnvelope) {
  const clients = sseClients.get(toUser.toLowerCase());
  if (clients && clients.length > 0) {
    const data = `data: ${JSON.stringify(signal)}\n\n`;
    for (const res of clients) {
      try {
        res.write(data);
      } catch (err) {
        // Ignored, handled in close
      }
    }
  }
}

// ================= API ROUTES ================= //

// Health check and WebRTC config
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    registeredUsersCount: Object.keys(db.users).length,
    activeSseConnections: Array.from(sseClients.values()).reduce((sum, list) => sum + list.length, 0),
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
  });
});

// User Registration
app.post('/api/users/register', (req: Request, res: Response) => {
  const { username, displayName, avatar, bio } = req.body || {};
  if (!username || typeof username !== 'string') {
    res.status(400).json({ error: 'Username is required' });
    return;
  }
  const cleanUser = username.trim().toLowerCase();
  if (cleanUser.length < 3 || cleanUser.length > 20 || !/^[a-z0-9_]+$/.test(cleanUser)) {
    res.status(400).json({ error: 'Username must be 3-20 characters alphanumeric or underscore' });
    return;
  }
  if (db.users[cleanUser]) {
    res.status(409).json({ error: 'Username is already taken' });
    return;
  }

  const cleanName = typeof displayName === 'string' && displayName.trim().length > 0
    ? displayName.trim().slice(0, 30)
    : cleanUser;

  const userRecord: UserRecord = {
    username: cleanUser,
    displayName: cleanName,
    avatar: typeof avatar === 'string' && avatar ? avatar : 'avatar_1',
    bio: typeof bio === 'string' ? bio.slice(0, 100) : 'Hey there! I am using MeshChat.',
    createdAt: Date.now(),
    lastActive: Date.now(),
  };

  db.users[cleanUser] = userRecord;
  saveDatabase();

  res.status(201).json({ success: true, user: userRecord });
});

// User Login
app.post('/api/users/login', (req: Request, res: Response) => {
  const { username } = req.body || {};
  if (!username || typeof username !== 'string') {
    res.status(400).json({ error: 'Username is required' });
    return;
  }
  const cleanUser = username.trim().toLowerCase();
  const userRecord = db.users[cleanUser];
  if (!userRecord) {
    res.status(404).json({ error: 'Account not found. Please register first.' });
    return;
  }

  userRecord.lastActive = Date.now();
  saveDatabase();

  res.json({ success: true, user: userRecord });
});

// Heartbeat
app.post('/api/users/heartbeat', (req: Request, res: Response) => {
  const { username } = req.body || {};
  if (username && typeof username === 'string') {
    const clean = username.trim().toLowerCase();
    if (db.users[clean]) {
      db.users[clean].lastActive = Date.now();
    }
  }
  res.json({ ok: true, timestamp: Date.now() });
});

// User Search
app.get('/api/users/search', (req: Request, res: Response) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
  const current = typeof req.query.currentUser === 'string' ? req.query.currentUser.trim().toLowerCase() : '';

  const now = Date.now();
  const results = Object.values(db.users)
    .filter((u) => {
      if (current && u.username === current) return false;
      if (!query) return true;
      return u.username.includes(query) || u.displayName.toLowerCase().includes(query);
    })
    .map((u) => ({
      username: u.username,
      displayName: u.displayName,
      avatar: u.avatar,
      bio: u.bio,
      isOnline: now - u.lastActive < 45 * 1000,
      lastActive: u.lastActive,
    }));

  res.json({ results });
});

// Update Profile
app.patch('/api/users/profile', (req: Request, res: Response) => {
  const { username, displayName, avatar, bio } = req.body || {};
  if (!username || typeof username !== 'string') {
    res.status(400).json({ error: 'Username required' });
    return;
  }
  const clean = username.trim().toLowerCase();
  const user = db.users[clean];
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  if (displayName && typeof displayName === 'string') {
    user.displayName = displayName.trim().slice(0, 30);
  }
  if (avatar && typeof avatar === 'string') {
    user.avatar = avatar;
  }
  if (typeof bio === 'string') {
    user.bio = bio.slice(0, 100);
  }
  user.lastActive = Date.now();
  saveDatabase();

  res.json({ success: true, user });
});

// Delete Account
app.delete('/api/users/account', (req: Request, res: Response) => {
  const { username } = req.body || {};
  if (!username || typeof username !== 'string') {
    res.status(400).json({ error: 'Username required' });
    return;
  }
  const clean = username.trim().toLowerCase();
  if (db.users[clean]) {
    delete db.users[clean];
    db.signals = db.signals.filter((s) => s.from !== clean && s.to !== clean);
    saveDatabase();
  }
  res.json({ success: true });
});

// Send Signaling Message
app.post('/api/signaling/send', (req: Request, res: Response) => {
  const { from, to, type, payload, timestamp } = req.body || {};
  if (!from || !to || !type) {
    res.status(400).json({ error: 'Missing required signaling fields (from, to, type)' });
    return;
  }

  const cleanFrom = String(from).trim().toLowerCase();
  const cleanTo = String(to).trim().toLowerCase();

  const envelope: SignalEnvelope = {
    id: `sig_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    from: cleanFrom,
    to: cleanTo,
    type: String(type),
    payload: payload ?? null,
    timestamp: typeof timestamp === 'number' ? timestamp : Date.now(),
  };

  db.signals.push(envelope);

  // Push to SSE connection if recipient is connected
  dispatchSignalToUser(cleanTo, envelope);

  res.status(200).json({ success: true, signalId: envelope.id });
});

// Poll Signaling Messages (for clients without SSE or during reconnection)
app.get('/api/signaling/poll', (req: Request, res: Response) => {
  const user = typeof req.query.user === 'string' ? req.query.user.trim().toLowerCase() : '';
  const since = Number(req.query.since) || 0;

  if (!user) {
    res.status(400).json({ error: 'Missing "user" query parameter' });
    return;
  }

  // Update user heartbeat on poll
  if (db.users[user]) {
    db.users[user].lastActive = Date.now();
  }

  const signals = db.signals.filter((s) => s.to === user && s.timestamp > since);

  res.json({
    signals,
    serverTime: Date.now(),
  });
});

// Server-Sent Events (SSE) Signaling Stream
app.get('/api/signaling/stream', (req: Request, res: Response) => {
  const user = typeof req.query.user === 'string' ? req.query.user.trim().toLowerCase() : '';
  if (!user) {
    res.status(400).send('Missing user parameter');
    return;
  }

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send initial connected event
  res.write(`data: ${JSON.stringify({ type: 'connected', user, timestamp: Date.now() })}\n\n`);

  // Register client
  const existing = sseClients.get(user) || [];
  existing.push(res);
  sseClients.set(user, existing);

  // Keep alive ping every 15 seconds
  const pingInterval = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch (e) {
      clearInterval(pingInterval);
    }
  }, 15000);

  // Cleanup on close
  req.on('close', () => {
    clearInterval(pingInterval);
    const clients = sseClients.get(user) || [];
    const filtered = clients.filter((c) => c !== res);
    if (filtered.length > 0) {
      sseClients.set(user, filtered);
    } else {
      sseClients.delete(user);
    }
  });
});

// ================= STATIC ASSET & DEV SERVER ================= //

async function startServer() {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`MeshChat full-stack server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
