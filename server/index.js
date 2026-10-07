import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import sqlite3 from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3001);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const DATA_DIR = join(process.cwd(), 'data');
const DB_PATH = join(DATA_DIR, 'tools.db');

mkdirSync(DATA_DIR, { recursive: true });
const db = new sqlite3(DB_PATH);

function nowIso() {
  return new Date().toISOString();
}

function generateInviteToken() {
  return randomUUID().slice(0, 8).toUpperCase();
}

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value);
}

function ensureSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('manager', 'worker')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sites (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tools (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      serial TEXT NOT NULL,
      condition TEXT NOT NULL,
      location TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      assigned_to TEXT,
      site_id TEXT,
      last_checked_out TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      worker_name TEXT NOT NULL,
      site_name TEXT NOT NULL,
      note TEXT,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const manager = db.prepare('SELECT * FROM users WHERE id = ?').get('manager-1');
  if (!manager) {
    db.prepare('INSERT INTO users (id, name, role, created_at) VALUES (?, ?, ?, ?)').run(
      'manager-1',
      'Admin Manager',
      'manager',
      nowIso()
    );
  }

  const defaultSites = [
    { id: 'site-1', name: 'North Tower' },
    { id: 'site-2', name: 'West Apartments' },
    { id: 'site-3', name: 'Warehouse' },
  ];
  for (const site of defaultSites) {
    const exists = db.prepare('SELECT 1 FROM sites WHERE id = ?').get(site.id);
    if (!exists) {
      db.prepare('INSERT INTO sites (id, name) VALUES (?, ?)').run(site.id, site.name);
    }
  }

  const toolCount = db.prepare('SELECT COUNT(*) AS count FROM tools').get().count;
  if (toolCount === 0) {
    db.prepare(
      `INSERT INTO tools (id, name, category, serial, condition, location, status, assigned_to, site_id, last_checked_out, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'tool-1',
      'DeWalt Drill Driver',
      'Power Tools',
      'DW-1001',
      'Good',
      'Warehouse',
      'available',
      null,
      null,
      null,
      nowIso()
    );

    db.prepare(
      `INSERT INTO tools (id, name, category, serial, condition, location, status, assigned_to, site_id, last_checked_out, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'tool-2',
      'Bosch Circular Saw',
      'Cutting Tools',
      'BS-2241',
      'Fair',
      'North Tower',
      'checked_out',
      'worker-1',
      'site-1',
      nowIso(),
      nowIso()
    );

    const workerOne = db.prepare('SELECT * FROM users WHERE name = ? AND role = ?').get('Mike Johnson', 'worker');
    if (!workerOne) {
      db.prepare('INSERT INTO users (id, name, role, created_at) VALUES (?, ?, ?, ?)').run(
        'worker-1',
        'Mike Johnson',
        'worker',
        nowIso()
      );
    }
  }

  const activityCount = db.prepare('SELECT COUNT(*) AS count FROM activity').get().count;
  if (activityCount === 0) {
    db.prepare(
      `INSERT INTO activity (id, type, tool_name, worker_name, site_name, note, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'activity-1',
      'checkout',
      'Bosch Circular Saw',
      'Mike Johnson',
      'North Tower',
      'Used for framing',
      new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString()
    );
  }

  if (!getSetting('invite_token')) {
    setSetting('invite_token', generateInviteToken());
  }
}

ensureSchema();

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
  };
}

function sanitizeTool(tool) {
  return {
    id: tool.id,
    name: tool.name,
    category: tool.category,
    serial: tool.serial,
    condition: tool.condition,
    location: tool.location,
    status: tool.status,
    assignedTo: tool.assigned_to,
    siteId: tool.site_id,
    lastCheckedOut: tool.last_checked_out,
    createdAt: tool.created_at,
  };
}

function sanitizeSite(site) {
  return {
    id: site.id,
    name: site.name,
  };
}

function sanitizeActivity(item) {
  return {
    id: item.id,
    type: item.type,
    toolName: item.tool_name,
    workerName: item.worker_name,
    siteName: item.site_name,
    note: item.note,
    timestamp: item.timestamp,
  };
}

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, status: 'healthy' });
});

app.get('/api/auth/invite', (req, res) => {
  res.json({ inviteToken: getSetting('invite_token') });
});

app.post('/api/auth/invite/refresh', requireAuth, (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Only managers can refresh invite codes' });
  }
  const nextToken = generateInviteToken();
  setSetting('invite_token', nextToken);
  res.json({ inviteToken: nextToken });
});

app.post('/api/auth/login', (req, res) => {
  const { name, role, inviteCode } = req.body || {};

  const safeName = String(name || '').trim();
  const safeRole = String(role || 'manager').toLowerCase();

  if (!safeName) {
    return res.status(400).json({ message: 'Name is required' });
  }

  if (safeRole === 'worker') {
    const expectedCode = getSetting('invite_token');
    if (!expectedCode || String(inviteCode || '').toUpperCase() !== expectedCode) {
      return res.status(401).json({ message: 'Invalid invite code' });
    }
  }

  let user = db.prepare('SELECT * FROM users WHERE name = ? AND role = ?').get(safeName, safeRole);
  if (!user) {
    user = {
      id: randomUUID(),
      name: safeName,
      role: safeRole,
      created_at: nowIso(),
    };
    db.prepare('INSERT INTO users (id, name, role, created_at) VALUES (?, ?, ?, ?)').run(
      user.id,
      user.name,
      user.role,
      user.created_at
    );
  }

  const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET, {
    expiresIn: '7d',
  });

  res.json({
    token,
    user: sanitizeUser(user),
  });
});

app.get('/api/users', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM users ORDER BY name ASC').all();
  res.json({ users: rows.map(sanitizeUser) });
});

app.get('/api/sites', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM sites ORDER BY name ASC').all();
  res.json({ sites: rows.map(sanitizeSite) });
});

app.get('/api/tools', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM tools ORDER BY name ASC').all();
  res.json({ tools: rows.map(sanitizeTool) });
});

app.get('/api/activity', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM activity ORDER BY timestamp DESC LIMIT 200').all();
  res.json({ activity: rows.map(sanitizeActivity) });
});

app.post('/api/tools', requireAuth, (req, res) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ message: 'Only managers can add tools' });
  }

  const { name, category, serial, condition, location } = req.body || {};
  if (!name || !category || !serial) {
    return res.status(400).json({ message: 'Name, category, and serial are required' });
  }

  const id = randomUUID();
  const createdAt = nowIso();
  db.prepare(
    `INSERT INTO tools (id, name, category, serial, condition, location, status, assigned_to, site_id, last_checked_out, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'available', NULL, NULL, NULL, ?)`
  ).run(id, name.trim(), category.trim(), serial.trim(), condition || 'Good', location || 'Warehouse', createdAt);

  const row = db.prepare('SELECT * FROM tools WHERE id = ?').get(id);
  res.status(201).json({ tool: sanitizeTool(row) });
});

app.post('/api/tools/check-out', requireAuth, (req, res) => {
  const { toolId, userId, siteId, note } = req.body || {};
  if (!toolId || !userId || !siteId) {
    return res.status(400).json({ message: 'Tool, worker, and site are required' });
  }

  const tool = db.prepare('SELECT * FROM tools WHERE id = ?').get(toolId);
  if (!tool) {
    return res.status(404).json({ message: 'Tool not found' });
  }

  if (tool.status === 'checked_out') {
    return res.status(409).json({ message: 'Tool already checked out' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(siteId);

  if (!user || !site) {
    return res.status(404).json({ message: 'Worker or site not found' });
  }

  const timestamp = nowIso();
  db.prepare(
    `UPDATE tools
     SET status = 'checked_out', assigned_to = ?, site_id = ?, location = ?, last_checked_out = ?
     WHERE id = ?`
  ).run(userId, siteId, site.name, timestamp, toolId);

  const activityId = randomUUID();
  db.prepare(
    `INSERT INTO activity (id, type, tool_name, worker_name, site_name, note, timestamp)
     VALUES (?, 'checkout', ?, ?, ?, ?, ?)`
  ).run(activityId, tool.name, user.name, site.name, note || 'Checked out', timestamp);

  const updatedTool = db.prepare('SELECT * FROM tools WHERE id = ?').get(toolId);
  const latestActivity = db.prepare('SELECT * FROM activity WHERE id = ?').get(activityId);

  res.status(200).json({
    tool: sanitizeTool(updatedTool),
    activity: sanitizeActivity(latestActivity),
  });
});

app.post('/api/tools/:id/check-in', requireAuth, (req, res) => {
  const { id } = req.params;
  const { note } = req.body || {};

  const tool = db.prepare('SELECT * FROM tools WHERE id = ?').get(id);
  if (!tool) {
    return res.status(404).json({ message: 'Tool not found' });
  }

  if (tool.status === 'available') {
    return res.status(409).json({ message: 'Tool is already available' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(tool.assigned_to);
  const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(tool.site_id);
  const timestamp = nowIso();

  db.prepare(
    `UPDATE tools
     SET status = 'available', assigned_to = NULL, site_id = NULL, last_checked_out = ?
     WHERE id = ?`
  ).run(timestamp, id);

  const activityId = randomUUID();
  db.prepare(
    `INSERT INTO activity (id, type, tool_name, worker_name, site_name, note, timestamp)
     VALUES (?, 'checkin', ?, ?, ?, ?, ?)`
  ).run(
    activityId,
    tool.name,
    user ? user.name : 'Unknown worker',
    site ? site.name : 'Unknown site',
    note || 'Returned to warehouse',
    timestamp
  );

  const updatedTool = db.prepare('SELECT * FROM tools WHERE id = ?').get(id);
  const latestActivity = db.prepare('SELECT * FROM activity WHERE id = ?').get(activityId);

  res.status(200).json({
    tool: sanitizeTool(updatedTool),
    activity: sanitizeActivity(latestActivity),
  });
});

app.listen(PORT, () => {
  console.log(`Construction Tools Tracker API running on http://localhost:${PORT}`);
});
